// Repeatable browser proof of the desk's Learn panel and the new inputs (house specs 0030 and 0031), against the dev server: pnpm dev, the demo
// institute seeded, then pnpm learn:check. A fresh made up student gets a made up practice bank on "Ratios" from a teacher of their class
// (learnProof:bankFor). The topic is on the map under its chapter and found by search; practice marks by code and shows the right option only after an
// answer; a wrong answer comes back under Go back over and is fixed; a written answer reaches the demo teacher with no name and the teacher's mark shows
// to the student; the plan lists the topic; a plain question can be marked as solved; the weekly habit check and a film's two checks save once; and
// Progress shows the measures. Calls the real model on development about two times (a question and a marking). Every person is made up. Refuses
// production and any address that is not this machine.
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudentWithEmail } from "./fresh-student.mjs";
import { PEOPLE, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("learn-check", argUrl);
const failures = [];
let steps = 0;
async function step(label, run) {
  steps += 1;
  try {
    await run();
    console.log(`  ok   ${label}`);
  } catch (error) {
    failures.push(label);
    if (process.env.LEARN_SHOTS) console.log(await globalThis.__page?.getByTestId('learn-plan').innerText().catch(() => ''));
    if (process.env.LEARN_SHOTS) await globalThis.__page?.screenshot({ path: `${process.env.LEARN_SHOTS}/fail-${steps}.png`, fullPage: true }).catch(() => {});
    console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split("\n")[0]}`);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
function run(fn, args) {
  const json = JSON.stringify(args).replace(/"/g, '\\"');
  return JSON.parse(execSync(`npx convex run ${fn} "${json}"`, { cwd: "packages/backend", stdio: "pipe" }).toString() || "null");
}

const browser = await chromium.launch();
try {
  const who = await freshStudentWithEmail(browser, base);
  const bank = run("learnProof:bankFor", { email: who.email });
  const rightOf = (text) => bank.questions.find((q) => text.includes(q.text))?.right;
  const context = await browser.newContext({ baseURL: base.origin, storageState: who.state });
  const page = await context.newPage();
  globalThis.__page = page;
  await page.goto("/dashboard");
  await page.locator('[data-room="dhi"]:visible').click();
  await page.getByTestId("desk-tab-learn").click();

  await step("the topic is on the map under its chapter, and search finds it", async () => {
    await page.getByTestId("learn-topic").filter({ hasText: "Ratios" }).first().waitFor({ timeout: 30_000 });
    expect((await page.getByTestId("learn-topics").innerText()).includes("Chapter 4"), "the chapter heading is missing");
    await page.getByTestId("learn-search").fill("rat");
    await page.getByTestId("learn-topic").filter({ hasText: "Ratios" }).first().waitFor({ timeout: 20_000 });
    await page.getByTestId("learn-search").fill("");
  });

  async function answerRound(wrongFirst) {
    await page.getByTestId("learn-round").waitFor({ timeout: 20_000 });
    let first = true;
    while ((await page.getByTestId("learn-round-done").count()) === 0) {
      const text = await page.locator('[data-testid="learn-round"] legend').innerText();
      const right = rightOf(text);
      const labels = await page.locator('[data-testid="learn-round"] fieldset label').allInnerTexts();
      const idx = labels.findIndex((l) => (wrongFirst && first ? l.trim() !== right : l.trim() === right));
      await page.getByTestId("learn-option").nth(idx).check();
      await page.getByTestId("learn-check").click();
      await page.getByTestId("learn-result").waitFor({ timeout: 20_000 });
      const said = await page.getByTestId("learn-result").getAttribute("data-right");
      expect(said === (wrongFirst && first ? "no" : "yes"), `the mark read ${said}`);
      if (wrongFirst && first) expect((await page.getByTestId("learn-result").innerText()).includes(right), "the right option is not shown after a wrong answer");
      first = false;
      await page.getByTestId("learn-next").click();
    }
    await page.getByTestId("learn-round-close").click();
  }

  await step("practice marks by code: a wrong answer shows the right option, then the round ends", async () => {
    await page.getByTestId("learn-topic").filter({ hasText: "Ratios" }).first().click();
    await page.getByTestId("learn-practise").click();
    expect(!(await page.content()).includes("rightOption"), "the page holds an answer key");
    await answerRound(true);
  });

  await step("the wrong answer waits under Go back over, and answering it right clears it", async () => {
    await page.getByTestId("learn-summary").filter({ hasText: "1 answer to go back over" }).waitFor({ timeout: 20_000 });
    await page.getByTestId("learn-fix").click();
    await answerRound(false);
    await page.getByTestId("learn-summary").filter({ hasText: "0 answers to go back over" }).waitFor({ timeout: 20_000 });
  });

  await step("a written answer goes to a teacher of the class, who sees no name, and the teacher's mark shows to the student", async () => {
    // After a round the panel goes back to the topic it came from.
    if ((await page.getByTestId("learn-topic-page").count()) === 0) await page.getByTestId("learn-topic").filter({ hasText: "Ratios" }).first().click();
    await page.getByTestId("learn-write").click();
    await page.getByTestId("learn-written-input").fill("A ratio compares two amounts, like 2 boys to 3 girls.");
    await page.getByTestId("learn-written-send").click();
    await page.getByTestId("learn-written-note").waitFor({ timeout: 90_000 });
    const answer = page.getByTestId("learn-answer").first();
    await answer.waitFor({ timeout: 20_000 });
    if ((await answer.getAttribute("data-status")) === "marked") await page.getByTestId("learn-dispute").first().click();
    await page.locator('[data-testid="learn-answer"][data-status="teacher"]').first().waitFor({ timeout: 20_000 });
    const teacherState = await signInMember(browser, base, PEOPLE.teacher);
    const tctx = await browser.newContext({ baseURL: base.origin, storageState: teacherState });
    const teacher = await tctx.newPage();
    await teacher.goto("/staff");
    await teacher.locator('[data-room="papers"]:visible').click();
    const item = teacher.getByTestId("written-item").filter({ hasText: "2 boys to 3 girls" });
    await item.first().waitFor({ timeout: 30_000 });
    expect(!(await teacher.getByTestId("written-queue").innerText()).includes(who.email), "the queue shows the student's email");
    await item.first().getByTestId("written-marks").fill("3");
    await item.first().getByTestId("written-save").click();
    await item.first().waitFor({ state: "detached", timeout: 20_000 });
    await tctx.close();
    await page.locator('[data-testid="learn-answer"][data-status="teacher_marked"]').filter({ hasText: "3 of 4 marks" }).first().waitFor({ timeout: 20_000 });
  });

  // The class may hold other maths topics from earlier proofs; the plan puts the least practised first, so it is checked for days and steps, not for Ratios.
  await step("the plan for a maths test lays out the days before the test, each with a step", async () => {
    const day = new Date(Date.now() + 3 * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10);
    await page.getByTestId("learn-plan-subject").selectOption("maths");
    await page.getByTestId("learn-plan-day").fill(day);
    await page.getByTestId("learn-plan-make").click();
    await page.getByTestId("learn-plan-day-row").first().waitFor({ timeout: 20_000 });
    const rows = await page.getByTestId("learn-plan-day-row").allInnerTexts();
    expect(rows.length === 2 && rows.every((r) => /\((practise|remember|go back over)\)/.test(r)), `the plan reads ${rows.join(" | ")}`);
  });

  await step("a plain question's answer can be marked as solving the doubt", async () => {
    await page.getByTestId("desk-tab-ask").click();
    await page.getByTestId("desk-input").fill("What does the ratio 1 to 2 mean? (learn check)");
    await page.getByTestId("desk-ask").click();
    await page.getByTestId("desk-resolve").first().waitFor({ timeout: 90_000 });
    await page.getByTestId("desk-resolve").first().click();
    await page.getByTestId("desk-resolved").first().waitFor({ timeout: 20_000 });
  });

  await step("the weekly habit check saves once and closes for the week", async () => {
    run("habitProof:habitFor", { email: who.email });
    await page.locator('[data-room="habits"]:visible').click();
    await page.getByTestId("habit-feels").waitFor({ timeout: 30_000 });
    for (let i = 0; i < 4; i += 1) await page.getByTestId(`habit-feels-${i}-5`).check({ force: true });
    await page.getByTestId("habit-feels-save").click();
    await page.getByTestId("habit-feels-done").waitFor({ timeout: 20_000 });
  });

  await step("a kept academic film's two checks are answered once", async () => {
    const film = run("learnProof:keepFilm", { email: who.email });
    expect(film !== null, "no approved academic film on development (run filmsProof:seedDemo)");
    await page.locator('[data-room="modules"]:visible').click();
    await page.getByTestId("film-card").filter({ hasText: film.title }).first().click();
    await page.getByTestId("film-checks").waitFor({ timeout: 30_000 });
    const groups = page.locator('[data-testid="film-checks"] fieldset');
    for (let i = 0; i < (await groups.count()); i += 1) await groups.nth(i).getByTestId("film-check-option").first().check();
    await page.getByTestId("film-checks-send").click();
    await page.getByTestId("film-checks-done").waitFor({ timeout: 20_000 });
  });

  await step("Progress shows the measures: an old wrong answer now right, and the habit feels", async () => {
    await page.locator('[data-room="progress"]:visible').click();
    await page.getByTestId("brain-measures").waitFor({ timeout: 30_000 });
    await page.getByTestId("measure-A05").waitFor({ timeout: 30_000 });
    await page.getByTestId("measure-H10").waitFor({ timeout: 30_000 });
    expect((await page.getByTestId("measure-A05").innerText()).includes("1 of 1"), "A05 does not read 1 of 1");
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
