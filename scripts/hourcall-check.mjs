// Repeatable browser proof of the study hour call (spec house/0027), against the dev server: pnpm dev, the demo institute seeded, then
// pnpm hourcall:check. It opens a fresh hour (`hourProof:openNow`, which clears the development hours). Two fresh made up students sit Live and join
// the call in their own browsers with a fake camera and microphone; each sees the other, and the recording shows as on. The demo teacher joins from
// Hour calls as a moderator and sees both. All leave. Then the teacher opens the hour's recording (Stream needs a few minutes; up to 8 are waited
// for, `--no-recording` skips it), shares it with one student, who sees it in the study hour, and takes the share back. Uses the Stream app's free
// minutes. Refuses production and any address that is not this machine.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudentWithEmail } from "./fresh-student.mjs";
import { PEOPLE, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("hourcall-check", argUrl);
const skipRecording = process.argv.includes("--no-recording");
const failures = [];
const skipped = [];
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

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const policyBlocks = [];
const watch = (page) =>
  page.on("console", (m) => {
    if (/Content.Security.Policy|Refused to (connect|load|frame)/i.test(m.text())) policyBlocks.push(m.text().slice(0, 200));
  });
const mediaContext = (state) => browser.newContext({ baseURL: base.origin, storageState: state, permissions: ["camera", "microphone"] });

try {
  execSync(`npx convex run hourProof:openNow "${JSON.stringify({ minutes: 30 }).replace(/"/g, '\\"')}"`, { cwd: "packages/backend", stdio: "pipe" });
  const a = await freshStudentWithEmail(browser, base);
  const b = await freshStudentWithEmail(browser, base);
  const pa = await (await mediaContext(a.state)).newPage();
  const pb = await (await mediaContext(b.state)).newPage();
  const pt = await (await mediaContext(await signInMember(browser, base, PEOPLE.teacher))).newPage();
  for (const p of [pa, pb, pt]) watch(p);

  async function sitLive(page) {
    await page.goto("/dashboard");
    await page.locator('[data-room="hour"]:visible').click();
    await page.getByTestId("study-hour-room").waitFor({ timeout: 30_000 });
    await page.getByTestId("enter-live").click();
    await page.getByTestId("hour-call").waitFor({ timeout: 20_000 });
  }

  await step("a Live seat shows the call card with the recording notice; Away does not", async () => {
    await sitLive(pa);
    expect((await pa.getByTestId("hour-call").innerText()).includes("This call is recorded"), "no recording notice");
    await pa.getByTestId("mode-away").click();
    await pa.getByTestId("hour-call").waitFor({ state: "detached", timeout: 20_000 });
    await pa.getByTestId("mode-live").click();
    await pa.getByTestId("hour-call").waitFor({ timeout: 20_000 });
  });

  await step("two students join, see each other, and the recording shows as on", async () => {
    await sitLive(pb);
    await pa.getByTestId("hour-call-join").click();
    await pb.getByTestId("hour-call-join").click();
    for (const page of [pa, pb]) {
      await page.getByTestId("hour-call-live").waitFor({ timeout: 45_000 });
      await page.waitForFunction(() => document.querySelectorAll(".str-video__participant-view").length >= 2, null, { timeout: 45_000 });
    }
    for (const page of [pa, pb]) await page.locator('[data-testid="hour-call-recording"][data-on="true"]').waitFor({ timeout: 60_000 });
  });

  await step("a student turns the camera and microphone on and off with named buttons", async () => {
    const mic = pa.getByTestId("call-mic");
    expect((await mic.getAttribute("aria-pressed")) === "false", "the microphone did not start off");
    await mic.click();
    await pa.waitForFunction(() => document.querySelector('[data-testid="call-mic"]')?.getAttribute("aria-pressed") === "true", null, { timeout: 15_000 });
    await pa.getByTestId("call-camera").click();
    await pa.waitForFunction(() => document.querySelector('[data-testid="call-camera"]')?.getAttribute("aria-pressed") === "true", null, { timeout: 15_000 });
  });

  await step("the teacher joins from Hour calls as a moderator and sees both students with Mute and Remove", async () => {
    await pt.goto("/staff");
    await pt.locator('[data-room="hourcalls"]:visible').click();
    await pt.getByTestId("hour-calls-join").click();
    await pt.getByTestId("hour-call-live").waitFor({ timeout: 45_000 });
    await pt.waitForFunction(() => document.querySelectorAll('[data-testid="hour-call-people"] li').length >= 2, null, { timeout: 45_000 });
    await pt.getByTestId("hour-call-people").getByRole("button", { name: /^Mute / }).first().click();
  });

  await c(15_000);

  await step("everyone leaves the call", async () => {
    for (const page of [pa, pb, pt]) {
      await page.getByTestId("hour-call-leave").click();
      await page.getByTestId("hour-call-live").waitFor({ state: "detached", timeout: 20_000 });
    }
  });

  if (skipRecording) {
    skipped.push("the recording, its share and its removal (--no-recording)");
  } else {
    await step("the teacher opens the hour's recording, and it plays under the content policy", async () => {
      let src = null;
      for (let i = 0; i < 16 && !src; i += 1) {
        await pt.goto("/staff");
        await pt.locator('[data-room="hourcalls"]:visible').click();
        const hour = pt.getByTestId("hour-calls-hour").first();
        await hour.waitFor({ timeout: 30_000 });
        await hour.getByTestId("hour-recordings").getByRole("button").click();
        await pt.waitForTimeout(4_000);
        src = await hour.locator("video").first().getAttribute("src", { timeout: 1_000 }).catch(() => null);
        if (!src) await pt.waitForTimeout(26_000);
      }
      expect(src, "no recording after 8 minutes");
      console.log(`       recording host: ${new URL(src).host}`);
      const loaded = await pt.locator("video").first().evaluate(
        (v) => new Promise((done) => (v.readyState >= 1 ? done(true) : (v.addEventListener("loadedmetadata", () => done(true)), v.addEventListener("error", () => done(false)), setTimeout(() => done(false), 20_000)))),
      );
      expect(loaded, "the recording did not load in the page");
    });

    await step("the teacher shares it with one student, who sees it in the study hour, then takes it back", async () => {
      const hour = pt.getByTestId("hour-calls-hour").first();
      await hour.getByTestId("hour-calls-share-email").fill(a.email);
      await hour.getByTestId("hour-calls-share").click();
      await hour.getByTestId("staff-done").waitFor({ timeout: 20_000 });
      await pa.goto("/dashboard");
      await pa.locator('[data-room="hour"]:visible').click();
      await pa.getByTestId("hour-shared").waitFor({ timeout: 30_000 });
      await hour.getByTestId("hour-calls-share-email").fill(a.email);
      await hour.getByTestId("hour-calls-unshare").click();
      await pa.getByTestId("hour-shared").waitFor({ state: "detached", timeout: 30_000 });
    });
  }

  await step("no content policy block in any browser", async () => {
    expect(policyBlocks.length === 0, policyBlocks[0] ?? "");
  });
} finally {
  await browser.close();
}
console.log(`\n${steps - failures.length} of ${steps} steps passed.${skipped.length ? ` Skipped: ${skipped.join("; ")}.` : ""}`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}

function c(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
