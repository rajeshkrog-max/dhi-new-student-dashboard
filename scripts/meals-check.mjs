// Repeatable browser proof of the meals room (spec house/0010) and the desk coming soon page (spec house/0016), against the dev server:
//   pnpm dev, then pnpm meals:check. A fresh student adds their own dish with numbers, logs a plate, sees the food group count (never a calorie
//   total), removes the plate, and sees the desk's coming soon page. Needs the demo institute and VITE_TEST_SIGNIN=true in .env.local.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudent } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("meals-check", argUrl);
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
const dishName = `Proof dish ${Date.now().toString(36)}`;

const browser = await chromium.launch();
try {
  const state = await freshStudent(browser, base);
  const context = await browser.newContext({ baseURL: base.origin, storageState: state });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.locator('[data-room="day"]:visible').click();
  await page.getByTestId("meals-room").waitFor({ timeout: 30_000 });

  await step("a student adds a dish of their own with its numbers", async () => {
    await page.getByRole("button", { name: "Add a dish that is not listed" }).click();
    const form = page.getByTestId("custom-dish");
    await form.locator("input").first().fill(dishName);
    await form.locator("select").first().selectOption("dal");
    await form.locator("input").nth(2).fill("1 bowl");
    await form.getByRole("button", { name: "Save dish" }).click();
    await page.getByText("Your dish is saved").waitFor({ timeout: 20_000 });
  });

  await step("the student finds the dish and logs one plate", async () => {
    await page.getByLabel("Find a food (English or Hindi)").fill(dishName);
    const value = await page.locator("select[aria-label='Food'] option", { hasText: dishName }).first().getAttribute("value");
    await page.getByLabel("Food", { exact: true }).selectOption(value);
    await page.getByRole("button", { name: "Log it" }).click();
    await page.getByText("Logged.").waitFor({ timeout: 20_000 });
    const plate = page.getByTestId("meal-plates").getByText(dishName);
    await plate.waitFor({ timeout: 20_000 });
  });

  await step("the day shows the food group count, and no calorie or protein total", async () => {
    const text = await page.getByTestId("meals-room").innerText();
    expect(/Dal or protein 1/.test(text), "the dal count is not shown");
    const bad = text.replace(/Dal or protein/g, "").match(/kcal|calorie|protein \d|energy/i);
    expect(!bad, `a calorie or protein total shows (matched "${bad?.[0]}")`);
  });

  await step("the student removes the plate and the count goes back", async () => {
    await page.getByTestId("meal-plates").locator("li", { hasText: dishName }).getByRole("button", { name: "Remove" }).click();
    await page.getByText("Nothing logged today yet.").waitFor({ timeout: 20_000 });
  });

  await step("the home screen shows the student's own DHI score card with its three lamps, and no rank", async () => {
    await page.locator('[data-room="home"]:visible').click();
    await page.getByTestId("home-score").waitFor({ timeout: 30_000 });
    // The card is drawn before its numbers arrive (aria-busy); read it once they have.
    await page.locator('[data-testid="home-score"][aria-busy="false"]').waitFor({ timeout: 30_000 });
    const text = await page.getByTestId("home-score").innerText();
    for (const lamp of ["Sadhana", "Niyam", "Viveka"]) expect(text.includes(lamp), `${lamp} is missing`);
    expect(!/rank|top of|best in/i.test(text.replace(/never a rank/g, "")), "a ranking word shows on the score card");
    expect(text.includes("Days you logged a meal"), "the presence line is missing");
  });

  await step("the DHI desk shows its coming soon page", async () => {
    await page.locator('[data-room="dhi"]:visible').click();
    await page.getByTestId("coming-soon").waitFor({ timeout: 20_000 });
  });

  await context.close();
} finally {
  await browser.close();
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
