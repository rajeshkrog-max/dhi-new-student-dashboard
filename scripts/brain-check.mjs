// Repeatable browser proof of the Brain report on the Progress page (spec house/0019 and house/0020), against the dev server:
//   pnpm dev, then pnpm brain:check
// A fresh made up student sees the empty state and the way into each room. Then a development helper (brainProof:seed) stores the hand made days of
// brainFixtures.ts for them, as the rollup would: a heavy fortnight shows the first chain with the days behind it, the expression note and the support
// offer with the helpline; "does not feel true" hides a pattern and "Show again" brings it back; Hinglish is chosen and remembered; a steady month shows the
// supporting pattern and rising lamps, and the score on Home matches. Refuses production and any address that is not this machine.
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudentWithEmail } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("brain-check", argUrl);
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
function seed(email, scenario) {
  const json = JSON.stringify({ email, scenario }).replace(/"/g, '\\"');
  execSync(`npx convex run brainProof:seed "${json}"`, { cwd: "packages/backend", stdio: "pipe" });
}

const browser = await chromium.launch();
try {
  const who = await freshStudentWithEmail(browser, base);
  const context = await browser.newContext({ baseURL: base.origin, storageState: who.state });
  const page = await context.newPage();

  // A visit can be interrupted by the house's own redirect on the way in (the same address twice); the second try lands.
  async function visitDashboard() {
    try {
      await page.goto("/dashboard");
    } catch (error) {
      if (!String(error?.message ?? error).includes("interrupted by another navigation")) throw error;
      await page.goto("/dashboard");
    }
  }

  async function openProgress() {
    await visitDashboard();
    await page.locator('[data-room="progress"]:visible').click();
    await page.getByTestId("brain-report").waitFor({ timeout: 30_000 });
    await page.getByTestId("brain-lamps").waitFor({ timeout: 30_000 });
  }

  await step("Home shows the real score card and recent exams, and none of the old sample data", async () => {
    await visitDashboard();
    await page.getByTestId("home-score").waitFor({ timeout: 30_000 });
    await page.getByTestId("recent-exams").waitFor({ timeout: 20_000 });
    // The card is drawn before its numbers arrive ("…"), so wait for the real value.
    await page.getByTestId("score-value").filter({ hasText: /Not yet|\d/ }).waitFor({ timeout: 20_000 });
    const text = await page.locator("section[aria-label=House]").innerText();
    for (const old of ["House board", "Lamps matrix", "sample data"]) expect(!text.includes(old), `Home still shows "${old}"`);
    expect((await page.getByTestId("score-value").innerText()).includes("Not yet"), "a new student has a score");
  });

  await step("a new student sees the empty state with the days needed, the sources note (the words are approved, so no words note), and a way into each room", async () => {
    await openProgress();
    expect((await page.getByTestId("brain-empty").innerText()).includes("at least 5 days"), "the empty state does not say how many days are needed");
    await page.getByTestId("brain-draft-sources").waitFor({ timeout: 10_000 });
    expect((await page.getByTestId("brain-draft-words").count()) === 0, "the words draft note still shows");
    expect((await page.getByTestId("pattern").count()) === 0, "a pattern shows with nothing logged");
    expect((await page.getByTestId("brain-score").innerText()).includes("Not yet"), "a score shows with nothing logged");
    await page.getByTestId("open-mood").click();
    await page.getByRole("heading", { name: "Mood Tracker" }).waitFor({ timeout: 20_000 });
  });

  await step("a heavy fortnight shows the chain with the days behind it, the expression note, and the support offer with the helpline", async () => {
    seed(who.email, "heavy");
    await openProgress();
    const pattern = page.locator('[data-testid="pattern"][data-pattern="mood_habits_quiet"]');
    await pattern.waitFor({ timeout: 30_000 });
    const words = await pattern.innerText();
    expect(words.includes("tend to come together") && words.includes("your own days"), "the sentence does not say tend to or speak of the student's own days");
    await pattern.getByText("See the days").click();
    expect((await pattern.getByTestId("evidence-day").count()) === 8, "the evidence does not list the 8 days");
    const first = await pattern.getByTestId("evidence-day").first().innerText();
    expect(first.includes("marked sad or heavy") && first.includes("a habit was open, not ticked"), `the first day does not say what happened: ${first}`);
    await page.getByTestId("expression").waitFor({ timeout: 10_000 });
    const support = await page.getByTestId("brain-support").innerText();
    expect(support.includes("Tele-MANAS on 14416") && support.includes("free"), "the support offer does not name the helpline");
    expect(!/book|appointment/i.test(support), "the support offer promises a booking");
  });

  await step("a day in the list opens the room it came from", async () => {
    const pattern = page.locator('[data-testid="pattern"][data-pattern="mood_habits_quiet"]');
    await pattern.getByRole("button", { name: "Open Mood" }).first().click();
    await page.getByRole("heading", { name: "Mood Tracker" }).waitFor({ timeout: 20_000 });
  });

  await step("'This does not feel true' hides the pattern, says so, and Show again brings it back", async () => {
    await openProgress();
    const pattern = page.locator('[data-testid="pattern"][data-pattern="mood_habits_quiet"]');
    await pattern.getByTestId("hide-pattern").click();
    await page.getByTestId("hidden-patterns").waitFor({ timeout: 20_000 });
    expect((await pattern.count()) === 0, "the pattern stayed after it was hidden");
    expect((await page.getByTestId("hidden-patterns").innerText()).includes("hidden for 30 days"), "the page does not say it is hidden for 30 days");
    await page.reload();
    await page.locator('[data-room="progress"]:visible').click();
    await page.getByTestId("hidden-patterns").waitFor({ timeout: 30_000 });
    expect((await page.locator('[data-testid="pattern"]').count()) === 0, "the pattern came back after a reload");
    await page.getByTestId("show-mood_habits_quiet").click();
    await pattern.waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("hidden-patterns").count()) === 0, "the hidden note stayed after Show again");
  });

  await step("Hinglish is chosen, shows the same days in Hinglish, and is remembered after a reload", async () => {
    await page.getByTestId("lang-hi").click();
    const pattern = page.locator('[data-testid="pattern"][data-pattern="mood_habits_quiet"]');
    expect((await pattern.innerText()).includes("Bhaari din aur uske baad shant din"), "the pattern is not in Hinglish");
    expect((await page.getByTestId("brain-support").innerText()).includes("Tele-MANAS ko 14416 par"), "the support offer is not in Hinglish");
    await page.reload();
    await page.locator('[data-room="progress"]:visible').click();
    await page.getByTestId("brain-report").waitFor({ timeout: 30_000 });
    expect((await page.getByTestId("brain-report").getAttribute("data-lang")) === "hi", "the language was not remembered");
    await page.getByTestId("lang-en").click();
  });

  await step("no ranking or clinical word, no cause word, and no other student appears anywhere on the page", async () => {
    const text = (await page.getByTestId("brain-report").innerText()).replace(/never a rank/gi, "");
    expect(!/\b(weak|average|bright|lazy|failed|topper|rank|depress\w*|disorder|diagnos\w*|because|causes?)\b/i.test(text), "a ranking, clinical or cause word shows on the page");
    expect(!/\b(Demo Student|Demo Minor|classmate)\b/i.test(text), "another student's name shows");
  });

  await step("a steady month shows the supporting pattern, rising lamps, and the same score on Home", async () => {
    seed(who.email, "steady");
    await openProgress();
    await page.locator('[data-testid="pattern"][data-pattern="steady_rhythm"]').waitFor({ timeout: 30_000 });
    expect((await page.getByTestId("pattern").count()) === 1, "more than the supporting pattern shows");
    expect((await page.getByTestId("brain-support").count()) === 0, "the support offer shows for a steady month");
    expect((await page.getByTestId("expression").count()) === 0, "the expression note shows for a steady month");
    expect((await page.getByTestId("movement-sadhana").innerText()).includes("Rising"), "the Sadhana lamp does not say it is rising");
    expect((await page.getByTestId("movement-niyam").innerText()).includes("Rising"), "the Niyam lamp does not say it is rising");
    expect((await page.getByTestId("movement-viveka").innerText()).includes("Not enough days"), "the Viveka lamp claims a movement with no data");
    expect((await page.getByTestId("brain-score").innerText()).trim() === "70", "the score is not 70");
    await page.locator('[data-room="home"]:visible').click();
    await page.getByTestId("score-value").filter({ hasText: /^\s*\d+\s*$/ }).waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("score-value").innerText()).trim() === "70", "Home shows a different score from Progress");
  });

  // House spec 0028: the topic and subject connections, from hand made tagged days, with the subject named in words and nothing from anyone else.
  await step("tagged days show the desk topic and subject connections, the subject in words, and each can be hidden", async () => {
    seed(who.email, "tagged");
    await openProgress();
    const topic = page.locator('[data-testid="connection"][data-connection="topic_desk_papers"]');
    const subject = page.locator('[data-testid="connection"][data-connection="subject_feeling"]');
    await topic.waitFor({ timeout: 30_000 });
    await subject.waitFor({ timeout: 30_000 });
    const topicText = await topic.innerText();
    expect(topicText.includes("90%") && topicText.includes("40%") && topicText.includes("60 topic days"), `the topic connection reads wrong: ${topicText}`);
    const subjectText = await subject.innerText();
    expect(/maths sessions/.test(subjectText) && subjectText.includes("50%") && subjectText.includes("90 sessions"), `the subject connection reads wrong: ${subjectText}`);
    expect(!/seedtopic/.test(await page.getByTestId("brain-report").innerText()), "a topic id shows on the page");
    await subject.getByTestId("hide-connection").click();
    await subject.waitFor({ state: "detached", timeout: 20_000 });
    expect((await topic.count()) === 1, "hiding one connection hid the other");
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
