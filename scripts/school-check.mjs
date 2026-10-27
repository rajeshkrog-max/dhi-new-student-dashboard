// Repeatable browser proof of the school report (spec house/0025), against the dev server: pnpm dev, the demo institute seeded, then pnpm school:check.
// The demo teacher opens the report for Class 10 A and sees the totals, the actions and the support card, and no room counts; the institute admin
// opens it and also sees the room counts; the page shows nothing from the rooms or the Brain; a range over 13 weeks is refused in plain words. The
// numbers themselves are proved in convex/schoolReport.test.ts and schoolRules.test.ts. Every person is made up. Refuses production and any address
// that is not this machine.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { PEOPLE, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("school-check", argUrl);
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
  const teacher = await (await browser.newContext({ baseURL: base.origin, storageState: await signInMember(browser, base, PEOPLE.teacher) })).newPage();
  const admin = await (await browser.newContext({ baseURL: base.origin, storageState: await signInMember(browser, base, PEOPLE.admin) })).newPage();

  async function openReport(page, { from, to } = {}) {
    await page.goto("/staff");
    await page.locator('[data-room="report"]:visible').click();
    await page.getByTestId("school-report").waitFor({ timeout: 30_000 });
    await page.getByTestId("school-class").selectOption({ label: "Class 10 A" });
    if (from) await page.getByTestId("school-from").fill(from);
    if (to) await page.getByTestId("school-to").fill(to);
    await page.getByTestId("school-open").click();
  }

  await step("the teacher opens the report for Class 10 A: totals, actions and the support card, and no room counts", async () => {
    await openReport(teacher);
    await teacher.getByTestId("school-totals").waitFor({ timeout: 30_000 });
    const totals = await teacher.getByTestId("school-totals").innerText();
    expect(totals.includes("Class 10 A") && /students? in the class/.test(totals), `the totals read: ${totals.split("\n").join(" | ")}`);
    await teacher.getByTestId("school-actions").waitFor();
    await teacher.getByTestId("school-support").waitFor();
    expect((await teacher.getByTestId("school-rooms").count()) === 0, "a teacher sees room counts");
    expect((await teacher.getByTestId("school-support").innerText()).includes("not a ranking"), "the support card does not say it is not a ranking");
  });

  await step("the institute admin opens it too, with the room counts of the last full month", async () => {
    await openReport(admin);
    await admin.getByTestId("school-totals").waitFor({ timeout: 30_000 });
    await admin.getByTestId("school-rooms").waitFor({ timeout: 30_000 });
    const rooms = await admin.getByTestId("school-rooms").innerText();
    for (const room of ["Mood", "Meals", "Habits", "Sleep", "Study hour", "Modules"]) expect(rooms.includes(room), `no ${room} count`);
  });

  await step("the report says where its numbers come from, and never shows a mood, sleep or meal number", async () => {
    const text = await admin.getByTestId("school-report").innerText();
    expect(text.includes("Nothing here comes from a student's mood"), "the intro is missing");
    expect(!/\b(guna|bedtime|kcal|lamp|Sadhana|Niyam|Viveka)\b/i.test(text), "the report shows something from the rooms or the Brain");
  });

  await step("a range over 13 weeks is refused in plain words", async () => {
    await openReport(teacher, { from: "2026-01-01", to: "2026-10-27" });
    await teacher.getByTestId("school-error").getByText("A report covers at most 13 weeks.").waitFor({ timeout: 20_000 });
  });
} finally {
  await browser.close();
}
console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
