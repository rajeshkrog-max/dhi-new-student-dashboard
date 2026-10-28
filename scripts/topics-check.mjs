// Repeatable browser proof of the topic and subject taps (house spec 0028), against the dev server: pnpm dev, the demo institute seeded, then
// pnpm topics:check. A fresh made up student gets a desk card (topicsProof:openDeskCard sends two made up maths topics to their class, because a real
// card needs a 10 minute sitting). The topic pick shows only after a subject, offers the class's topics newest first, says so when a subject has none,
// clears when the subject changes, and the answer keeps the subject and the topic by its id (the event's shape is in convex/topics.test.ts). Every person is made up. Refuses production and any
// address that is not this machine.
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudentWithEmail } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("topics-check", argUrl);
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
function run(fn, args) {
  const json = JSON.stringify(args).replace(/"/g, '\\"');
  return JSON.parse(execSync(`npx convex run ${fn} "${json}"`, { cwd: "packages/backend", stdio: "pipe" }).toString());
}

const browser = await chromium.launch();
try {
  const who = await freshStudentWithEmail(browser, base);
  const ids = run("topicsProof:openDeskCard", { email: who.email });
  const context = await browser.newContext({ baseURL: base.origin, storageState: who.state });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.locator('[data-room="dhi"]:visible').click();
  const card = page.getByTestId("desk-feeling-card");

  await step("the desk card shows no topic pick until a subject is tapped", async () => {
    await card.waitFor({ timeout: 30_000 });
    expect((await page.getByTestId("desk-topics").count()) === 0, "a topic pick shows before a subject");
  });

  await step("a subject with no papers sent to the class says so", async () => {
    await page.getByTestId("desk-subject-science").click();
    await page.getByTestId("desk-topics").waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("desk-topic").count()) === 0, "a science topic shows with none sent");
    expect((await page.getByTestId("desk-topics").innerText()).includes("No topics"), "the empty note is missing");
  });

  await step("maths offers the class's two topics, newest first, and a tap holds", async () => {
    await page.getByTestId("desk-subject-maths").click();
    await page.getByTestId("desk-topic").first().waitFor({ timeout: 20_000 });
    const names = await page.getByTestId("desk-topic").allInnerTexts();
    expect(names.join(",") === "Decimals,Fractions", `the topics read ${names.join(",")}`);
    await page.getByTestId("desk-topic").filter({ hasText: "Fractions" }).click();
    expect((await page.getByTestId("desk-topic").filter({ hasText: "Fractions" }).getAttribute("aria-pressed")) === "true", "the topic tap did not hold");
  });

  await step("changing the subject clears the topic", async () => {
    await page.getByTestId("desk-subject-science").click();
    await page.getByTestId("desk-subject-maths").click();
    await page.getByTestId("desk-topic").first().waitFor({ timeout: 20_000 });
    expect((await page.locator('[data-testid="desk-topic"][aria-pressed="true"]').count()) === 0, "a topic stayed picked after the subject changed");
  });

  await step("the answer keeps the subject and the topic by its id", async () => {
    await page.getByTestId("desk-feel-okay").click();
    await page.getByTestId("desk-focus-4").click();
    await page.getByTestId("desk-topic").filter({ hasText: "Fractions" }).click();
    await page.getByTestId("desk-feeling-save").click();
    await card.waitFor({ state: "detached", timeout: 20_000 });
    const kept = run("topicsProof:lastDeskCard", { email: who.email });
    expect(kept?.subject === "maths" && kept?.topicId === ids.fractions, `the card kept ${JSON.stringify(kept)}`);
  });

  await context.close();
} finally {
  await browser.close();
}
console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
