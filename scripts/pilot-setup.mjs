// Sets up the made up pilot class on the development deployment (house spec 0021, the checklist), through the real screens: pnpm dev, then
// pnpm pilot:setup. A fresh "Pilot School <tag>" with Class 10 P is made by `rehearsalProof:pilotSetup` (on production the first DHI admin does this
// with their own Google account). The institute admin and the teacher join; the teacher is linked to the class (`rehearsalProof:pilotAssign`, as the
// admin's Classes screen does); ten made up students join and agree after reading the notice; the admin records the parent's consent for the six under
// 18; every student's house opens. It ends with the pause practice: the admin pauses the class, a student sees the paused screen, the admin resumes it.
// Every person is made up (`@example.test`). Refuses production and any address that is not this machine.
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { signIn } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("pilot-setup", argUrl);
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
const helper = (fn, args) => execSync(`npx convex run rehearsalProof:${fn} "${JSON.stringify(args).replace(/"/g, '\\"')}"`, { cwd: "packages/backend", encoding: "utf8" });
const waitForPath = (page, prefix, timeout = 30_000) => page.waitForURL((url) => url.pathname.startsWith(prefix), { timeout });

const tag = Date.now().toString(36).slice(-6);
const made = JSON.parse(helper("pilotSetup", { tag }));
const admin = made.people.find((p) => p.role === "institute_admin");
const teacher = made.people.find((p) => p.role === "teacher");
const students = made.people.filter((p) => p.role === "student");
console.log(`${made.institute}: Class 10 P, ${students.length} made up students (${students.filter((s) => s.under18).length} under 18)`);

async function join(browser, person, place) {
  const context = await browser.newContext({ baseURL: base.origin });
  const page = await context.newPage();
  await signIn(page, person);
  await waitForPath(page, "/join");
  await page.getByTestId("join").click();
  await waitForPath(page, place);
  return { context, page };
}
async function agree(page) {
  await page.waitForFunction(() => (document.querySelector('[data-testid="notice-box"]')?.textContent ?? "").includes("privacy@"), null, { timeout: 30_000 });
  await page.getByTestId("notice-box").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForFunction(() => !document.querySelector('[data-testid="agree"]')?.hasAttribute("disabled"), null, { timeout: 10_000 });
  await page.getByTestId("agree").click();
}

const browser = await chromium.launch();
try {
  let adminPage;
  await step("the institute admin and the teacher join, and the teacher is linked to Class 10 P", async () => {
    adminPage = await join(browser, admin, "/staff");
    const t = await join(browser, teacher, "/staff");
    await t.context.close();
    helper("pilotAssign", { tag });
  });

  const open = [];
  for (const s of students) {
    await step(`${s.name} joins and agrees${s.under18 ? ", and waits for the parent's consent" : ""}`, async () => {
      const page = await join(browser, s, "/dashboard");
      await agree(page.page);
      if (!s.under18) await page.page.locator('[data-room="mood"]:visible').waitFor({ timeout: 30_000 });
      open.push({ s, ...page });
    });
  }

  await step("the admin records the parent's consent for each student under 18, and their houses open", async () => {
    await adminPage.page.locator('[data-room="parent"]:visible').click();
    for (const s of students.filter((x) => x.under18)) {
      const row = adminPage.page.getByTestId("parent-list").locator("li", { hasText: s.name });
      await row.getByRole("button", { name: /^Record consent/ }).click();
      await row.getByText("On file").waitFor({ timeout: 20_000 });
    }
    for (const o of open.filter((x) => x.s.under18)) await o.page.locator('[data-room="mood"]:visible').waitFor({ timeout: 30_000 });
  });

  await step("the pause practice: the admin pauses Class 10 P, a student sees the paused screen, and the resume brings them back", async () => {
    const one = open[0];
    await adminPage.page.locator('[data-room="classes"]:visible').click();
    await adminPage.page.getByRole("button", { name: "Pause logins of Class 10 P" }).click();
    await adminPage.page.getByRole("button", { name: "Resume logins of Class 10 P" }).waitFor({ timeout: 20_000 });
    await one.page.reload();
    await one.page.getByRole("heading", { name: "Your access is paused" }).waitFor({ timeout: 20_000 });
    await adminPage.page.getByRole("button", { name: "Resume logins of Class 10 P" }).click();
    await adminPage.page.getByRole("button", { name: "Pause logins of Class 10 P" }).waitFor({ timeout: 20_000 });
    await one.page.reload();
    await one.page.locator('[data-room="mood"]:visible').waitFor({ timeout: 20_000 });
  });

  for (const o of open) await o.context.close();
  await adminPage?.context.close();
} finally {
  await browser.close();
}
console.log(`\n${steps - failures.length} of ${steps} steps passed. ${made.institute} is ready on development.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
