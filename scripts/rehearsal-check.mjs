// The first look of the production rehearsal (docs/launch/PROGRESS.md, Phase 4), on the development deployment only, with made up people:
//   pnpm dev, then pnpm rehearsal:check
// The steps after a deploy in docs/HOUSE-DEPLOY.md section 4, in the real screens. A fresh "Rehearsal School <tag>" is made by the development helper
// `rehearsalProof:setup` (on production the first DHI admin does this with their own Google account). Then: the institute admin and the teacher join and
// land in the staff area; a student under 18 joins, agrees and waits; the admin records the parent's consent and the house opens; an adult student
// joins and agrees; both students open every room once with no error; the admin pauses the class and both are refused, then resumes it; the adult
// downloads their data and erases it, is signed out, and the same email is refused neutrally. Every person is made up. Needs VITE_TEST_SIGNIN=true in
// .env.local and TEST_SIGNIN_ENABLED on the development deployment; it refuses production and any address that is not this machine.
import { execSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { signIn } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("rehearsal-check", argUrl);
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
const waitForPath = (page, prefix, timeout = 30_000) => page.waitForURL((url) => url.pathname.startsWith(prefix), { timeout });
// Every room of the student menu, and what shows that it opened (not the error card).
const ROOMS = ["home", "blog", "papers", "day", "mood", "habits", "sleep", "modules", "dhi", "hour", "counsel", "progress", "data"];

const tag = Date.now().toString(36).slice(-6);
const made = JSON.parse(execSync(`npx convex run rehearsalProof:setup "${JSON.stringify({ tag }).replace(/"/g, '\\"')}"`, { cwd: "packages/backend", encoding: "utf8" }));
const who = (role, under18) => made.people.find((p) => p.role === role && (under18 === undefined || p.email.includes(under18 ? "-minor-" : "-adult-")));
const adminP = who("institute_admin");
const teacherP = who("teacher");
const minorP = who("student", true);
const adultP = who("student", false);
console.log(`${made.institute}: ${made.people.map((p) => p.email).join(", ")}`);

async function join(browser, person, place) {
  const context = await browser.newContext({ baseURL: base.origin });
  const page = await context.newPage();
  page.on("pageerror", (e) => (page.__crashes ??= []).push(String(e?.message ?? e)));
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
async function everyRoom(page) {
  for (const room of ROOMS) {
    await page.locator(`[data-room="${room}"]:visible`).click();
    await page.waitForTimeout(900);
    expect((await page.getByText("Something went wrong").count()) === 0, `the ${room} room shows the error card`);
  }
  expect(!(page.__crashes ?? []).length, `the page threw: ${(page.__crashes ?? [])[0]}`);
}

const browser = await chromium.launch();
let admin;
try {
  await step("the institute admin joins and lands in the staff area of the new school", async () => {
    admin = await join(browser, adminP, "/staff");
    await admin.page.getByText(made.institute).first().waitFor({ timeout: 20_000 });
  });

  await step("the teacher joins and lands in the staff area with no Institutes screen", async () => {
    const teacher = await join(browser, teacherP, "/staff");
    expect((await teacher.page.locator('[data-room="institutes"]:visible').count()) === 0, "a teacher sees the Institutes screen");
    await teacher.context.close();
  });

  let minor;
  await step("the student under 18 joins, agrees after reading the notice, and waits for the school", async () => {
    minor = await join(browser, minorP, "/dashboard");
    await agree(minor.page);
    expect((await minor.page.locator("[data-room]").count()) === 0, "the rooms show before the parent's consent is on file");
  });

  await step("the admin records the parent's consent, and the student's house opens by itself", async () => {
    await admin.page.locator('[data-room="parent"]:visible').click();
    const row = admin.page.getByTestId("parent-list").locator("li", { hasText: minorP.name });
    await row.getByRole("button", { name: /^Record consent/ }).click();
    await row.getByText("On file").waitFor({ timeout: 20_000 });
    await minor.page.locator('[data-room="mood"]:visible').waitFor({ timeout: 30_000 });
  });

  await step("the student under 18 opens every room once, with no error", async () => everyRoom(minor.page));

  let adult;
  await step("the adult student joins, agrees, and opens every room once, with no error", async () => {
    adult = await join(browser, adultP, "/dashboard");
    await agree(adult.page);
    await adult.page.locator('[data-room="mood"]:visible').waitFor({ timeout: 30_000 });
    await everyRoom(adult.page);
  });

  await step("the admin pauses the class and both students see the paused screen, then resumes it and both are back", async () => {
    await admin.page.locator('[data-room="classes"]:visible').click();
    await admin.page.getByRole("button", { name: "Pause logins of Class 9 B" }).click();
    await admin.page.getByRole("button", { name: "Resume logins of Class 9 B" }).waitFor({ timeout: 20_000 });
    for (const s of [minor, adult]) {
      await s.page.reload();
      await s.page.getByRole("heading", { name: "Your access is paused" }).waitFor({ timeout: 20_000 });
    }
    await admin.page.getByRole("button", { name: "Resume logins of Class 9 B" }).click();
    await admin.page.getByRole("button", { name: "Pause logins of Class 9 B" }).waitFor({ timeout: 20_000 });
    for (const s of [minor, adult]) {
      await s.page.reload();
      await s.page.locator('[data-room="mood"]:visible').waitFor({ timeout: 20_000 });
    }
  });

  await step("the adult downloads one file of their own data", async () => {
    await adult.page.locator('[data-room="data"]:visible').click();
    const [file] = await Promise.all([adult.page.waitForEvent("download", { timeout: 30_000 }), adult.page.getByTestId("download-data").click()]);
    const data = JSON.parse(await readFile(await file.path(), "utf8"));
    expect(data.schema === "dhi-house-export-v1" && data.profile?.email === adultP.email, "the file is not the adult's own export");
    expect(!JSON.stringify(data).includes(minorP.email), "the file holds another student's data");
  });

  await step("the adult erases their data (asked twice), is signed out, and the same email is refused neutrally", async () => {
    await adult.page.getByTestId("erase-start").click();
    await adult.page.getByTestId("erase-yes").click();
    await waitForPath(adult.page, "/enter", 40_000);
    await admin.page.locator('[data-room="invites"]:visible').click();
    await admin.page.getByTestId("invite-role").selectOption("student");
    await admin.page.getByTestId("invite-name").fill(adultP.name);
    await admin.page.getByTestId("invite-email").fill(adultP.email);
    await admin.page.getByTestId("invite-class").selectOption({ label: "Class 9 B" });
    await admin.page.getByTestId("invite-under18").selectOption("no");
    await admin.page.getByTestId("invite-create").click();
    await admin.page.getByTestId("staff-error").waitFor({ timeout: 20_000 });
    expect(!/erase|blocked|30 days/i.test(await admin.page.getByTestId("staff-error").innerText()), "the refusal says why the address cannot be invited");
  });
} finally {
  await browser.close();
}

console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.log(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
