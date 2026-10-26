// Repeatable browser proof of the weekly parent page (house spec 0022) and the connections on the Progress page (house spec 0023), in a real browser,
// against the dev server and the development backend:
//   pnpm dev, then pnpm parent:check
// A fresh made up student gets a steady month of Brain days (`brainProof:seed`, scenario steady), turns sharing on and makes the private link on Your
// data. The link opens with no sign in and shows the days logged in each room and the three lamps, and nothing else (no mood, note, pattern or
// support words). The look appears in the student's own "Who has looked". While the class is paused the page reads as gone, and it comes back on
// resume (owner, 2026-10-26). Removing the link ends it at once. A second fresh student gets forty days with a clear bedtime and mood difference
// (scenario connected) and sees that connection on Progress. Every person is made up. Needs the demo institute, VITE_TEST_SIGNIN=true in .env.local and
// TEST_SIGNIN_ENABLED on the development deployment; it refuses production and any non local address.
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudentWithEmail } from "./fresh-student.mjs";
import { PEOPLE, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("parent-check", argUrl);
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
const seed = (email, scenario) =>
  execSync(`npx convex run brainProof:seed "${JSON.stringify({ email, scenario }).replace(/"/g, '\\"')}"`, { cwd: "packages/backend", stdio: "pipe" });
// Words that must never reach a parent: a mood, a note, a pattern, the support offer.
// Whole words only: the lamp Sadhana is allowed, the mood sad is not.
const NEVER = /\b(sad|heavy|happy|calm|angry|note|notes|pattern|patterns|support|helpline|Tele-MANAS|counsel\w*)\b/i;

const browser = await chromium.launch();
let admin = null;
let pausedClass = null;
try {
  const kid = await freshStudentWithEmail(browser, base);
  seed(kid.email, "steady");
  const kidContext = await browser.newContext({ baseURL: base.origin, storageState: kid.state });
  const page = await kidContext.newPage();
  const parentContext = await browser.newContext({ baseURL: base.origin });
  const parent = await parentContext.newPage();
  let link = "";

  await step("the student turns sharing on and makes the private link on Your data", async () => {
    await page.goto("/dashboard");
    await page.locator('[data-room="data"]:visible').click();
    await page.getByTestId("toggle-sharing").click();
    await page.getByText("On: a summary").waitFor({ timeout: 20_000 });
    await page.getByTestId("parent-link-make").click();
    await page.getByTestId("parent-link-new").waitFor({ timeout: 20_000 });
    link = await page.getByTestId("parent-link-url").inputValue();
    expect(new URL(link).pathname === "/parent" && new URL(link).hash.length > 40, `the link does not look like /parent#<code>: ${link.slice(0, 40)}`);
  });

  await step("the link opens with no sign in and shows the days logged and the three lamps, and nothing else", async () => {
    await parent.goto(new URL(link).pathname + new URL(link).hash);
    await parent.getByTestId("parent-page").waitFor({ timeout: 30_000 });
    await parent.getByTestId("parent-rooms").waitFor({ timeout: 20_000 });
    await parent.getByTestId("parent-lamps").waitFor({ timeout: 20_000 });
    // The page's own promise ("This page never shows a mood, a note, ...") is left out, so only what is shown is looked at.
    const text = (await parent.getByTestId("parent-page").innerText())
      .split("\n")
      .filter((line) => !/never shows|kabhi mood/i.test(line))
      .join("\n");
    expect(!NEVER.test(text), `the parent page holds a word it must not: ${text.match(NEVER)?.[0]}`);
    expect((await parent.request.get("/api/auth/get-session").then((r) => r.text())).slice(0, 4) === "null", "the parent page has a session");
  });

  await step("the look shows in the student's own Who has looked, as a parent", async () => {
    await page.reload();
    await page.locator('[data-room="data"]:visible').click();
    await page.getByTestId("access-list").waitFor({ timeout: 20_000 });
    expect(/parent/i.test(await page.getByTestId("access-list").innerText()), "the parent's look is not in Who has looked");
  });

  await step("while the class is paused the page reads as gone, and it comes back on resume", async () => {
    const adminContext = await browser.newContext({ baseURL: base.origin, storageState: await signInMember(browser, base, PEOPLE.admin) });
    admin = await adminContext.newPage();
    await admin.goto("/staff");
    await admin.locator('[data-room="classes"]:visible').click();
    const pause = admin.getByRole("button", { name: "Pause logins of Class 10 A" });
    await pause.click();
    pausedClass = admin.getByRole("button", { name: "Resume logins of Class 10 A" });
    await pausedClass.waitFor({ timeout: 20_000 });
    await parent.reload();
    await parent.getByTestId("parent-gone").waitFor({ timeout: 20_000 });
    await pausedClass.click();
    await admin.getByRole("button", { name: "Pause logins of Class 10 A" }).waitFor({ timeout: 20_000 });
    pausedClass = null;
    await parent.reload();
    await parent.getByTestId("parent-lamps").waitFor({ timeout: 20_000 });
  });

  await step("removing the link ends it at once", async () => {
    // The student's page showed the paused screen during the pause, so it is opened again.
    await page.reload();
    await page.locator('[data-room="data"]:visible').click();
    await page.getByTestId("parent-link-remove").click();
    await page.getByTestId("parent-link-make").waitFor({ timeout: 20_000 });
    await parent.reload();
    await parent.getByTestId("parent-gone").waitFor({ timeout: 20_000 });
  });
  await kidContext.close();
  await parentContext.close();

  const other = await freshStudentWithEmail(browser, base);
  seed(other.email, "connected");
  const otherContext = await browser.newContext({ baseURL: base.origin, storageState: other.state });
  const progress = await otherContext.newPage();
  await step("forty days with a clear bedtime and mood difference show that connection on Progress, with the days behind it", async () => {
    await progress.goto("/dashboard");
    await progress.locator('[data-room="progress"]:visible').click();
    await progress.getByTestId("brain-connections").waitFor({ timeout: 30_000 });
    await progress.locator('[data-testid="connection"][data-connection="bedtime_mood"]').waitFor({ timeout: 10_000 });
  });
  await otherContext.close();
} finally {
  // Never leave the demo class paused, even when a step failed half way.
  if (pausedClass) await pausedClass.click().catch(() => undefined);
  await browser.close();
}

console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.log(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
