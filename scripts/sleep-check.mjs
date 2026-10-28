// Repeatable browser proof of the real sleep room (spec house/0008), in a real browser, against the dev server:
//   pnpm dev                          (the house on http://localhost:8080)
//   pnpm sleep:check                  (this script)
// A fresh made up student opens Sleep and sees the default night (23:00 to 06:30), saves it, reloads and still sees it as "Saved", sees it
// from a second browser (another device), moves the bed time and saves, and checks the 7 night strip and the read back (not enough nights
// yet, so no usual bedtime). It keeps a tap made during a save, shows the day moving on at 04:00, and checks that the room's copy holds no
// judging word and that staff never see a student's sleep. Needs the demo institute (`pnpm --filter @dhi/backend exec convex run demo:seed`)
// and VITE_TEST_SIGNIN=true in .env.local. It refuses production and any address that is not this machine. Each run makes a fresh student.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { PEOPLE, signInMember } from "./test-student.mjs";
import { freshStudent } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("sleep-check", argUrl);

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

// Opens the Sleep room from the dashboard menu and waits for the server's nights to arrive.
async function openSleep(page) {
  await page.goto("/dashboard");
  await page.locator('[data-room="sleep"]:visible').click();
  await page.getByTestId("sleep-room").waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="sleep-save"]')?.textContent?.includes("Saving"), null, { timeout: 30_000 });
  // The button is disabled until the server's nights arrive, so wait for it to be usable or to say Saved.
  await page.waitForFunction(
    () => {
      const button = document.querySelector('[data-testid="sleep-save"]');
      return button !== null && (!button.disabled || button.textContent.includes("Saved"));
    },
    null,
    { timeout: 30_000 },
  );
}
const bedText = (page) => page.getByTestId("sleep-bed").innerText();
const wakeText = (page) => page.getByTestId("sleep-wake").innerText();
// The bars drawn in the strip (each logged night draws at least one bar).
const barCount = (page) => page.evaluate(() => document.querySelectorAll('[data-testid="sleep-week"] [class*="bg-home/40"]').length);
const saveButton = (page) => page.getByTestId("sleep-save");

const browser = await chromium.launch();
try {
  const state = await freshStudent(browser, base).catch((error) => {
    console.error(`sleep-check: could not make a fresh student (${String(error?.message ?? error).split("\n")[0]}).`);
    console.error("Run `pnpm --filter @dhi/backend exec convex run demo:seed` once on the development deployment, then try again.");
    process.exit(2);
  });
  const context = await browser.newContext({ baseURL: base.origin, storageState: state });
  const page = await context.newPage();
  const second = await (await browser.newContext({ baseURL: base.origin, storageState: state })).newPage();

  await step("a fresh student sees the default night, 23:00 to 06:30, and the save button is enabled", async () => {
    await openSleep(page);
    expect((await bedText(page)) === "23:00", `bed time is ${await bedText(page)}, not 23:00`);
    expect((await wakeText(page)) === "06:30", `wake time is ${await wakeText(page)}, not 06:30`);
    expect(await saveButton(page).isEnabled(), "the save button is disabled before any night is logged");
  });

  await step("saving the night shows Saved (disabled) and the strip draws one bar", async () => {
    await saveButton(page).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="sleep-save"]')?.textContent?.includes("Saved"), null, { timeout: 20_000 });
    expect(!(await saveButton(page).isEnabled()), "the save button is still enabled after saving");
    expect((await barCount(page)) === 1, `the strip draws ${await barCount(page)} bars, not 1`);
  });

  await step("after a reload the same night is read back from the server and still shows Saved", async () => {
    await openSleep(page);
    await page.waitForFunction(() => document.querySelector('[data-testid="sleep-save"]')?.textContent?.includes("Saved"), null, { timeout: 20_000 });
    expect((await bedText(page)) === "23:00" && (await wakeText(page)) === "06:30", "the night did not survive the reload");
  });

  await step("a second browser (another device) sees the same night", async () => {
    await openSleep(second);
    await second.waitForFunction(() => document.querySelector('[data-testid="sleep-save"]')?.textContent?.includes("Saved"), null, { timeout: 20_000 });
    expect((await bedText(second)) === "23:00", "the other device does not see the bed time");
  });

  await step("moving the bed time 15 minutes later makes Save available, and saving it shows the new times", async () => {
    await page.getByRole("button", { name: "Bed 15 minutes later" }).click();
    expect((await bedText(page)) === "23:15", `bed time after one step is ${await bedText(page)}, not 23:15`);
    expect(await saveButton(page).isEnabled(), "Save is not available after a change");
    await saveButton(page).click();
    await page.waitForFunction(() => document.querySelector('[data-testid="sleep-save"]')?.textContent?.includes("Saved"), null, { timeout: 20_000 });
    expect((await bedText(page)) === "23:15", "the saved bed time did not stay on screen");
    expect((await barCount(page)) === 1, "a changed night made a second bar instead of changing the first");
  });

  await step("the other device follows the change without a reload", async () => {
    await second.waitForFunction(() => document.querySelector('[data-testid="sleep-bed"]')?.textContent === "23:15", null, { timeout: 20_000 });
  });

  await step("the read back shows not enough nights yet, and no usual bedtime or average from one night", async () => {
    expect((await page.getByTestId("sleep-usual").innerText()).includes("A few more nights"), "a usual bedtime shows from one night");
    expect((await page.getByTestId("sleep-average").innerText()).includes("A few more nights"), "an average shows from one night");
  });

  await step("a tap made while a save is in flight is kept on the form after the save returns", async () => {
    await page.getByRole("button", { name: "Bed 15 minutes later" }).click();
    await saveButton(page).click();
    await page.getByRole("button", { name: "Bed 15 minutes later" }).click();
    await page.waitForTimeout(2500);
    expect((await bedText(page)) === "23:45", `the tap made during the save was lost (bed is ${await bedText(page)}, not 23:45)`);
    expect(await saveButton(page).isEnabled(), "the save button is not available for the kept tap");
  });

  await step("the room's words hold no judging word and no target", async () => {
    const text = await page.getByTestId("sleep-room").innerText();
    expect(!/\b(short|long|good|bad|enough|weak|target|should|too little|too much)\b/i.test(text), "a judging word shows in the sleep room");
    expect(!text.includes("Draft words"), "the draft mark still shows (the words were approved on 2026-10-28)");
  });

  await step("the day moving past 04:00 is said on the screen", async () => {
    const late = await (await browser.newContext({ baseURL: base.origin, storageState: state })).newPage();
    await late.clock.install({ time: new Date() });
    await openSleep(late);
    await late.clock.fastForward("26:00:00");
    await late.getByTestId("sleep-moved-on").waitFor({ timeout: 20_000 });
  });

  await step("a teacher and an institute admin cannot see a student's sleep", async () => {
    for (const person of [PEOPLE.teacher, PEOPLE.admin]) {
      const staffState = await signInMember(browser, base, person);
      const staffContext = await browser.newContext({ baseURL: base.origin, storageState: staffState });
      const staffPage = await staffContext.newPage();
      await staffPage.goto("/staff");
      await staffPage.locator('[data-room]:visible').first().waitFor({ timeout: 20_000 });
      expect((await staffPage.locator('[data-room="sleep"]').count()) === 0, `${person.name} has a Sleep screen in the staff area`);
      expect(!(await staffPage.locator("body").innerText()).includes("Last night"), `${person.name} sees a student's night`);
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
