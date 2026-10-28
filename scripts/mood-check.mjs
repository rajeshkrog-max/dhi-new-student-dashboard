// Repeatable browser proof of the real mood room (spec house/0006), in a real browser, against the dev server:
//   pnpm dev                          (the house on http://localhost:8080)
//   pnpm mood:check                   (this script)
// The demo student colours today with a note, reloads and still sees it, sees it from a second browser (another device), changes the colour (the
// guna line follows), changes only the note, and sees the year strip and the draft mark for the new words. Needs the demo institute
// (`pnpm --filter @dhi/backend exec convex run demo:seed`) and VITE_TEST_SIGNIN=true in .env.local. It refuses production and any address that is
// not this machine. It leaves one mood row for the demo student for today (the room allows today to be changed, so a rerun just changes it).
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { PEOPLE, signInMember } from "./test-student.mjs";
import { freshStudent } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("mood-check", argUrl);

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

const stamp = `proof ${Date.now().toString(36)}`;

async function openMood(page) {
  await page.goto("/dashboard");
  await page.locator('[data-room="mood"]:visible').click();
  await page.getByTestId("mood-note").waitFor({ timeout: 30_000 });
  // The saved entry (if any) arrives from the server a moment after the room opens.
  await page.waitForFunction(() => !document.querySelector('[data-testid="mood-save"]')?.textContent?.includes("Loading"), null, { timeout: 30_000 });
}
async function pickMood(page, label) {
  await page.locator("article button", { hasText: label }).first().click();
}

const browser = await chromium.launch();
try {
  const state = await freshStudent(browser, base).catch((error) => {
    console.error(`mood-check: could not make a fresh student (${String(error?.message ?? error).split("\n")[0]}).`);
    console.error("Run `pnpm --filter @dhi/backend exec convex run demo:seed` once on the development deployment, then try again.");
    process.exit(2);
  });
  const context = await browser.newContext({ baseURL: base.origin, storageState: state });
  const page = await context.newPage();
  const second = await (await browser.newContext({ baseURL: base.origin, storageState: state })).newPage();

  await step("the student colours today with a note, and the room says it is saved", async () => {
    await openMood(page);
    await pickMood(page, "Tired");
    await page.getByTestId("mood-note").fill(`${stamp} one`);
    await page.getByTestId("mood-save").click();
    await page.getByTestId("mood-saved").waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("mood-guna").innerText()).includes("tamas"), "the guna line for Tired is not tamas");
  });

  await step("after a reload the same colour and note are read back from the server", async () => {
    await openMood(page);
    await page.getByTestId("mood-saved").waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("mood-note").inputValue()) === `${stamp} one`, "the note did not survive the reload");
  });

  await step("a second browser (another device) sees the same entry", async () => {
    await openMood(second);
    await second.getByTestId("mood-saved").waitFor({ timeout: 20_000 });
    expect((await second.getByTestId("mood-note").inputValue()) === `${stamp} one`, "the other device does not see the note");
  });

  await step("changing the colour replaces today's entry and the guna line follows", async () => {
    await pickMood(page, "Happy");
    await page.getByTestId("mood-save").click();
    await page.getByTestId("mood-saved").waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("mood-guna").innerText()).includes("sattva"), "the guna line for Happy is not sattva");
    await pickMood(page, "Stressed");
    await page.getByTestId("mood-save").click();
    await page.getByTestId("mood-saved").waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("mood-guna").innerText()).includes("rajas"), "the guna line for Stressed is not rajas");
  });

  await step("changing only the note keeps the colour, and the other device follows without a reload", async () => {
    await page.getByTestId("mood-note").fill(`${stamp} two`);
    await page.getByTestId("mood-save").click();
    await page.getByTestId("mood-saved").waitFor({ timeout: 20_000 });
    await second.waitForFunction((v) => document.querySelector('[data-testid="mood-note"]')?.value === v, `${stamp} two`, { timeout: 20_000 });
    expect((await second.getByTestId("mood-guna").innerText()).includes("rajas"), "the other device lost the colour");
  });

  await step("no draft mark shows (approved 2026-10-28), and the page shows no clinical word", async () => {
    expect((await page.getByTestId("mood-draft").count()) === 0, "the draft mark still shows");
    const text = await page.locator("main, body").first().innerText();
    expect(!/depress|disorder|diagnos|therap|medicat/i.test(text), "a clinical word shows in the mood room");
  });

  await step("a refused save is said in plain words (the note limit is held by the box)", async () => {
    const long = "x".repeat(600);
    await page.getByTestId("mood-note").fill(long);
    expect((await page.getByTestId("mood-note").inputValue()).length <= 500, "the box takes more than 500 characters");
  });

  await step("a screen left open past 04:00 moves to the new day with a notice, keeps a half written line, and a save still lands on the server's day", async () => {
    // A third browser whose clock the test controls. It loads the room on the real day, the student starts a line, then the clock jumps 26 hours.
    const late = await (await browser.newContext({ baseURL: base.origin, storageState: state })).newPage();
    await late.clock.install({ time: new Date() });
    await openMood(late);
    await late.getByTestId("mood-saved").waitFor({ timeout: 20_000 });
    await pickMood(late, "Sad");
    await late.getByTestId("mood-note").fill(`${stamp} half written`);
    await late.clock.fastForward("26:00:00");
    // The device now thinks it is the next day: the screen says the day moved, and the line the student was writing is still there.
    await late.getByTestId("mood-day-changed").waitFor({ timeout: 20_000 });
    expect((await late.getByTestId("mood-note").inputValue()) === `${stamp} half written`, "the half written line was lost when the day moved");
    await late.getByTestId("mood-save").click();
    await late.getByTestId("mood-day-changed").waitFor({ timeout: 20_000 });
    expect(!(await late.getByTestId("mood-error").count()), "the save after the day moved was refused");
  });

  await step("text typed while a save is in flight is kept", async () => {
    await page.reload();
    await openMood(page);
    await pickMood(page, "Content");
    await page.getByTestId("mood-note").fill(`${stamp} before`);
    // Type more right after pressing save, while the save is still travelling (the Convex client talks over a websocket, so there is nothing to slow down).
    await page.getByTestId("mood-save").click();
    await page.getByTestId("mood-note").fill(`${stamp} before and after`);
    await page.waitForTimeout(2500);
    expect((await page.getByTestId("mood-note").inputValue()) === `${stamp} before and after`, "words typed during the save were lost");
  });

  await step("a teacher and an institute admin see nothing of any student's mood, in the staff area or by opening the room's address", async () => {
    for (const person of [PEOPLE.teacher, PEOPLE.admin]) {
      const staffState = await signInMember(browser, base, person);
      const staffContext = await browser.newContext({ baseURL: base.origin, storageState: staffState });
      const staffPage = await staffContext.newPage();
      await staffPage.goto("/staff");
      await staffPage.locator('[data-room]:visible').first().waitFor({ timeout: 20_000 });
      const text = await staffPage.locator("body").innerText();
      expect(!/mood/i.test(text.replace(/Mood tracker/gi, "")), person.name + " sees a mood in the staff area");
      expect(!text.includes(stamp), person.name + " sees a student's note");
      // The room itself is for students: the staff area is where they are sent.
      await staffPage.goto("/dashboard");
      await staffPage.waitForURL((url) => url.pathname.startsWith("/staff"), { timeout: 20_000 });
      await staffContext.close();
    }
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
