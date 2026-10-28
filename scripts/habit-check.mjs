// Repeatable browser proof of the real habits room (spec house/0007), in a real browser, against the dev server:
//   pnpm dev                          (the house on http://localhost:8080)
//   pnpm habit:check                  (this script)
// A fresh made up student adds a habit, ticks it, reloads and still sees the tick, sees it from a second browser (another device), undoes and ticks
// again, fills the five slots (the button then closes), removes one (a slot opens again), adds a habit that starts later (it shows "Starts" and
// cannot be ticked), and leaves the room open across 04:00 (the screen says the day moved on). Needs the demo institute
// (\`pnpm --filter @dhi/backend exec convex run demo:seed\`) and VITE_TEST_SIGNIN=true in .env.local. It refuses production and any address that is
// not this machine. Each run makes a fresh student, so it can be repeated; the student and their rows stay on the development deployment.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudent } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("habit-check", argUrl);

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

const stamp = Date.now().toString(36).slice(-5);
const inDays = (n) => new Date(Date.now() + (5.5 - 4) * 3600 * 1000 + n * 86400000).toISOString().slice(0, 10);

async function openHabits(page) {
  await page.goto("/dashboard");
  await page.locator('[data-room="habits"]:visible').click();
  await page.getByRole("button", { name: /New habit/ }).waitFor({ timeout: 30_000 });
  // The habits arrive from the server a moment after the room opens.
  await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 30_000 });
}
async function addHabit(page, title, opts = {}) {
  await page.getByRole("button", { name: /New habit/ }).click();
  await page.getByTestId("habit-title").fill(title);
  if (opts.startOn) await page.locator('input[type="date"]').first().fill(opts.startOn);
  await page.getByTestId("habit-create").click();
  await page.getByTestId("habit-title").waitFor({ state: "detached", timeout: 20_000 });
}

const browser = await chromium.launch();
try {
  const state = await freshStudent(browser, base).catch((error) => {
    console.error(`habit-check: could not make a fresh student (${String(error?.message ?? error).split("\n")[0]}).`);
    console.error("Run `pnpm --filter @dhi/backend exec convex run demo:seed` once on the development deployment, then try again.");
    process.exit(2);
  });
  const context = await browser.newContext({ baseURL: base.origin, storageState: state });
  const page = await context.newPage();
  const second = await (await browser.newContext({ baseURL: base.origin, storageState: state })).newPage();

  await step("a new student starts with no habits and no draft mark shows (approved 2026-10-28)", async () => {
    await openHabits(page);
    await page.getByText("No habit yet").first().waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("habit-draft").count()) === 0, "the draft mark still shows");
    expect(!/depress|disorder|diagnos|therap|medicat/i.test(await page.locator("body").innerText()), "a clinical word shows in the habits room");
  });

  await step("a habit is added and ticked, and the tick is read back after a reload", async () => {
    await addHabit(page, `Water ${stamp}`);
    await page.getByRole("button", { name: `Done Water ${stamp}` }).click();
    await page.getByRole("button", { name: `Undo Water ${stamp}` }).waitFor({ timeout: 20_000 });
    await openHabits(page);
    await page.getByRole("button", { name: `Undo Water ${stamp}` }).waitFor({ timeout: 20_000 });
  });

  await step("a second browser (another device) sees the same habit and tick", async () => {
    await openHabits(second);
    await second.getByRole("button", { name: `Undo Water ${stamp}` }).waitFor({ timeout: 20_000 });
  });

  await step("undo turns the day back into an unticked day on both devices, and a tick can be made again", async () => {
    await page.getByRole("button", { name: `Undo Water ${stamp}` }).click();
    await page.getByRole("button", { name: `Done Water ${stamp}` }).waitFor({ timeout: 20_000 });
    await second.getByRole("button", { name: `Done Water ${stamp}` }).waitFor({ timeout: 20_000 });
    await page.getByRole("button", { name: `Done Water ${stamp}` }).click();
    await page.getByRole("button", { name: `Undo Water ${stamp}` }).waitFor({ timeout: 20_000 });
  });

  await step("five habits close the New habit button, and removing one opens a slot again", async () => {
    for (let i = 2; i <= 5; i++) await addHabit(page, `Habit ${i} ${stamp}`);
    const newHabit = page.getByRole("button", { name: /New habit/ });
    await page.waitForFunction(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("New habit"))?.hasAttribute("disabled"), null, { timeout: 20_000 });
    expect(await newHabit.isDisabled(), "New habit is open with five habits");
    await page.getByRole("button", { name: `Remove Habit 5 ${stamp}` }).click();
    await page.getByRole("button", { name: `Done Habit 5 ${stamp}` }).waitFor({ state: "detached", timeout: 20_000 });
    await page.waitForFunction(() => ![...document.querySelectorAll("button")].find((b) => b.textContent?.includes("New habit"))?.hasAttribute("disabled"), null, { timeout: 20_000 });
  });

  await step("a habit that starts later shows its start day and cannot be ticked", async () => {
    await addHabit(page, `Later ${stamp}`, { startOn: inDays(3) });
    const card = page.locator("li", { hasText: `Later ${stamp}` }).first();
    await card.getByText(/^Starts /).waitFor({ timeout: 20_000 });
    expect(await card.getByTestId("habit-tick").isDisabled(), "a habit that has not started can be ticked");
  });

  await step("a screen left open past 04:00 says the day moved on", async () => {
    const late = await (await browser.newContext({ baseURL: base.origin, storageState: state })).newPage();
    await late.clock.install({ time: new Date() });
    await openHabits(late);
    await late.getByRole("button", { name: `Undo Water ${stamp}` }).waitFor({ timeout: 20_000 });
    await late.clock.fastForward("26:00:00");
    await late.getByTestId("habit-day-moved").waitFor({ timeout: 20_000 });
  });

  await step("clearing or half typing the start date does not break the room, and Create stays closed until the dates are real", async () => {
    await openHabits(page);
    await page.getByRole("button", { name: `Remove Habit 4 ${stamp}` }).click();
    await page.getByRole("button", { name: `Done Habit 4 ${stamp}` }).waitFor({ state: "detached", timeout: 20_000 });
    await page.getByRole("button", { name: /New habit/ }).click();
    await page.getByTestId("habit-title").fill("Dates " + stamp);
    const start = page.locator('input[type="date"]').first();
    await start.fill("");
    expect(await page.getByTestId("habit-title").isVisible(), "the form disappeared when the start date was cleared");
    expect(await page.getByTestId("habit-create").isDisabled(), "Create is open with a cleared start date");
    await start.fill(inDays(1));
    await page.waitForFunction(() => !document.querySelector('[data-testid="habit-create"]')?.hasAttribute("disabled"), null, { timeout: 5_000 });
    await page.keyboard.press("Escape");
  });

  await step("a phone that slept past 04:00 moves to the new day when it wakes, and yesterday's tick no longer shows as today's", async () => {
    const woke = await (await browser.newContext({ baseURL: base.origin, storageState: state })).newPage();
    await woke.clock.install({ time: new Date() });
    await openHabits(woke);
    await woke.getByRole("button", { name: `Undo Water ${stamp}` }).waitFor({ timeout: 20_000 });
    // The clock jumps (a night asleep) without any timer firing; then the screen is woken.
    await woke.clock.setSystemTime(new Date(Date.now() + 26 * 3600 * 1000));
    await woke.evaluate(() => window.dispatchEvent(new Event("focus")));
    await woke.getByTestId("habit-day-moved").waitFor({ timeout: 20_000 });
    await woke.getByRole("button", { name: `Done Water ${stamp}` }).waitFor({ timeout: 20_000 });
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
