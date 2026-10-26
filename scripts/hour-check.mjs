// Repeatable browser proof of the study hour (spec house/0015), against the dev server:
//   pnpm dev, then `pnpm --filter @dhi/backend exec convex run hourProof:openNow '{"minutes":30}'`, then pnpm hour:check.
// Two fresh students of the same school (A and B) sit in the open hour. A sees B (Away), A's chat reaches B, B moves to Do not disturb and A no
// longer sees B while B sees no one and has no chat, A leaves. Refuses production and any address that is not this machine.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { execSync } from "node:child_process";
import { freshStudent, freshStudentWithEmail } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("hour-check", argUrl);
const failures = [];
let steps = 0;
async function step(label, run) {
  steps += 1;
  try {
    await run();
    console.log(`  ok   ${label}`);
  } catch (error) {
    failures.push(label);
    console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split("\n")[0]}`);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.launch();
try {
  const stateA = await freshStudent(browser, base);
  const stateB = await freshStudent(browser, base);
  const contextA = await browser.newContext({ baseURL: base.origin, storageState: stateA });
  const contextB = await browser.newContext({ baseURL: base.origin, storageState: stateB });
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  const message = `Proof message ${Date.now().toString(36)}`;

  async function open(page) {
    await page.goto("/dashboard");
    await page.locator('[data-room="hour"]:visible').click();
    await page.getByTestId("study-hour-room").waitFor({ timeout: 30_000 });
  }

  await step("both students see the open hour, with a countdown and no seat yet", async () => {
    await open(a);
    await open(b);
    expect((await a.getByTestId("hour-remaining").innerText()).includes("Closes in"), "no countdown shows");
    expect((await a.getByTestId("seat-list").count()) === 0, "a seat list shows before sitting");
  });

  await step("A sits Live and B sits Away, and A sees B", async () => {
    await a.getByTestId("enter-live").click();
    await a.getByTestId("my-seat").waitFor({ timeout: 20_000 });
    await b.getByTestId("enter-away").click();
    await b.getByTestId("my-seat").waitFor({ timeout: 20_000 });
    await a.getByTestId("seat-other").first().waitFor({ timeout: 20_000 });
    expect((await a.getByTestId("seat-other").first().innerText()).includes("Away"), "B does not show as Away");
  });

  await step("A's chat message reaches B, and every message is kept (the page says so)", async () => {
    await a.getByTestId("chat-input").fill(message);
    await a.getByTestId("chat-send").click();
    await b.getByTestId("chat-messages").getByText(message).waitFor({ timeout: 20_000 });
    expect((await a.getByTestId("chat").innerText()).includes("kept so a teacher can look"), "the moderation notice is missing");
  });

  await step("B moves to Do not disturb: B has no chat and sees no one, and A no longer sees B", async () => {
    await b.getByTestId("mode-dnd").click();
    await b.getByTestId("chat-closed").waitFor({ timeout: 20_000 });
    expect((await b.getByTestId("seat-other").count()) === 0, "B still sees someone");
    await a.waitForFunction(() => document.querySelectorAll('[data-testid="seat-other"]').length === 0, null, { timeout: 20_000 });
  });

  await step("A leaves and the seat list closes", async () => {
    await a.getByTestId("hour-leave").click();
    await a.getByTestId("enter-live").waitFor({ timeout: 20_000 });
    expect((await a.getByTestId("seat-list").count()) === 0, "the seat list stayed after leaving");
  });

  // The after session card (spec house/0018): a finished stay of 25 minutes is added by the development helper, since the proof cannot wait 20 minutes.
  async function withStay(label, run) {
    await step(label, async () => {
      const who = await freshStudentWithEmail(browser, base);
      const json = JSON.stringify({ email: who.email, minutes: 25 }).replace(/"/g, '\\"');
      execSync(`npx convex run hourProof:addFinishedStay "${json}"`, { cwd: "packages/backend", stdio: "pipe" });
      const context = await browser.newContext({ baseURL: base.origin, storageState: who.state });
      const page = await context.newPage();
      await open(page);
      await page.getByTestId("feedback-card").waitFor({ timeout: 30_000 });
      await run(page);
      await context.close();
    });
  }
  await withStay("a stay of 25 minutes asks for the card, and an answer closes it", async (page) => {
    expect((await page.getByTestId("feedback-card").innerText()).includes("25 minutes"), "the stay length is not shown");
    expect(await page.getByTestId("feedback-save").isDisabled(), "Save is available before both taps");
    await page.getByTestId("feel-okay").click();
    await page.getByTestId("focus-4").click();
    await page.getByTestId("feedback-save").click();
    await page.getByTestId("feedback-card").waitFor({ state: "detached", timeout: 20_000 });
    await page.reload();
    await page.locator('[data-room="hour"]:visible').click();
    await page.getByTestId("study-hour-room").waitFor({ timeout: 30_000 });
    expect((await page.getByTestId("feedback-card").count()) === 0, "the card came back after an answer");
  });
  await withStay("skipping the card closes it, and it does not come back", async (page) => {
    await page.getByTestId("feedback-skip").click();
    await page.getByTestId("feedback-card").waitFor({ state: "detached", timeout: 20_000 });
    await page.reload();
    await page.locator('[data-room="hour"]:visible').click();
    await page.getByTestId("study-hour-room").waitFor({ timeout: 30_000 });
    expect((await page.getByTestId("feedback-card").count()) === 0, "the card came back after a skip");
  });

  await contextA.close();
  await contextB.close();
} finally {
  await browser.close();
}
console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
