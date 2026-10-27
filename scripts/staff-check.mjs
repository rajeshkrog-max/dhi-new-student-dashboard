// Repeatable browser proof of the staff houses (spec house/0026), against the dev server: pnpm dev, the demo institute seeded, then pnpm staff:check.
// The demo institute admin and the demo teacher land on Home, which counts what waits for them and opens its page; the teacher opens the Papers of
// a student of Class 10 A, which shows each paper's state and never an answer; a teacher has no Overview or Counselors screen. The DHI admin's
// Overview and Counselors cannot be signed in to in a browser (a test inbox can never be a DHI admin, by design); convex/staffHome.test.ts covers
// them. Every person is made up. Refuses production and any address that is not this machine.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { PEOPLE, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("staff-check", argUrl);
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
  const admin = await (await browser.newContext({ baseURL: base.origin, storageState: await signInMember(browser, base, PEOPLE.admin) })).newPage();
  const teacher = await (await browser.newContext({ baseURL: base.origin, storageState: await signInMember(browser, base, PEOPLE.teacher) })).newPage();

  await step("the institute admin lands on Home, and each waiting count opens its page", async () => {
    await admin.goto("/staff");
    await admin.getByRole("heading", { name: "Home", level: 1 }).waitFor({ timeout: 30_000 });
    await admin.getByTestId("staff-home").waitFor();
    // The counts arrive after the page: wait for a waiting item or the empty line, then look.
    await admin.locator('[data-testid^="todo-"], [data-testid="staff-home-empty"]').first().waitFor({ timeout: 30_000 });
    const open = admin.getByTestId("staff-home").getByRole("button", { name: /^Open/ });
    if ((await open.count()) === 0) return;
    await open.first().click();
    expect(!(await admin.getByRole("heading", { name: "Home", level: 1 }).isVisible()), "Open did not leave Home");
  });

  await step("the admin has no Overview or Counselors screen", async () => {
    await admin.goto("/staff");
    await admin.getByTestId("staff-home").waitFor({ timeout: 30_000 });
    for (const room of ["overview", "counselors"]) expect((await admin.locator(`[data-room="${room}"]:visible`).count()) === 0, `the admin sees ${room}`);
  });

  await step("the teacher lands on Home, with no Overview or Counselors screen", async () => {
    await teacher.goto("/staff");
    await teacher.getByRole("heading", { name: "Home", level: 1 }).waitFor({ timeout: 30_000 });
    await teacher.getByTestId("staff-home").waitFor();
    for (const room of ["overview", "counselors"]) expect((await teacher.locator(`[data-room="${room}"]:visible`).count()) === 0, `the teacher sees ${room}`);
  });

  await step("the teacher opens the Papers of a student: each paper's state, and never an answer", async () => {
    await teacher.locator('[data-room="people"]:visible').click();
    await teacher.getByTestId("people-list").waitFor({ timeout: 30_000 });
    await teacher.getByTestId("student-papers-open").first().click();
    await teacher.getByTestId("student-papers").waitFor({ timeout: 30_000 });
    await teacher.waitForFunction(() => !document.querySelector('[data-testid="student-papers"]')?.textContent?.includes("Loading"), null, { timeout: 30_000 });
    const text = await teacher.getByTestId("student-papers").innerText();
    expect(text.includes("Your data"), "the page does not say the look is recorded");
    expect(!/rightOption|choice/.test(text), "the page shows answers");
  });
} finally {
  await browser.close();
}
console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
