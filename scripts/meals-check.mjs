// Repeatable browser proof of the meals room (spec house/0010), and that the desk (spec house/0016) opens after it, against the dev server:
//   pnpm dev, then pnpm meals:check. A fresh student adds their own dish with numbers, logs a plate, sees the food group count (never a calorie
//   total), removes the plate, and opens the desk, which shows their coins. Needs the demo institute and VITE_TEST_SIGNIN=true in .env.local.
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

  await step("a student opens Log a plate and adds a dish of their own", async () => {
    await page.getByTestId("meal-open").click();
    await page.getByRole("button", { name: "Add a dish that is not listed" }).click();
    const form = page.getByTestId("custom-dish");
    await form.locator("input").first().fill(dishName);
    await form.locator("select").first().selectOption("dal");
    await form.locator("input").nth(2).fill("1 bowl");
    await form.getByRole("button", { name: "Save dish" }).click();
    await page.getByText("Your dish is saved").waitFor({ timeout: 20_000 });
  });

  await step("the new dish is on the plate with a count of one, and the student logs it", async () => {
    await page.getByLabel("On the plate").getByText(`1 × ${dishName}`).waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "Log it" }).click();
    await page.getByText("Logged.").waitFor({ timeout: 20_000 });
    const plate = page.getByTestId("meal-plates").getByText(dishName);
    await plate.waitFor({ timeout: 20_000 });
  });

  await step("the student finds the dish by search next time", async () => {
    await page.getByTestId("meal-open").click();
    await page.getByLabel("Find a food (English or Hindi)").fill(dishName);
    await page.getByTestId("meal-found").getByText(dishName).waitFor({ timeout: 20_000 });
    await page.keyboard.press("Escape");
  });

  await step("the day shows the food group count, and no calorie or protein total", async () => {
    const groups = await page.getByTestId("meal-groups").innerText();
    expect(/Dal or protein\s+1/.test(groups), "the dal count is not shown");
    const text = await page.getByTestId("meals-room").innerText();
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

  // The desk is real now (house spec 0016) and has its own proof (desk:check); here it only has to open from the menu after the meals room.
  await step("the DHI desk opens from the menu and shows the student's coins", async () => {
    await page.locator('[data-room="dhi"]:visible').click();
    await page.getByTestId("desk-room").waitFor({ timeout: 20_000 });
    await page.getByTestId("desk-coins").waitFor({ timeout: 20_000 });
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
