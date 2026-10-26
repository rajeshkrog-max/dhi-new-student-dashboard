// Repeatable browser proof of the Modules room (spec house/0013), against the dev server:
//   pnpm dev, then `pnpm --filter @dhi/backend exec convex run filmsProof:seedDemo` once, then pnpm modules:check.
// A fresh student opens Modules, sees the films, opens one, finds a jump ahead closed, watches it to the end, sees it kept with its score, and
// after a reload still sees it kept (and the score unchanged). The demo films are 15 second videos. It uses the installed Chrome when there is
// one, because the bundled browser may not play the demo videos. Refuses production and any address that is not this machine.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudent } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("modules-check", argUrl);
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

let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch {
  browser = await chromium.launch();
}
try {
  const state = await freshStudent(browser, base);
  const context = await browser.newContext({ baseURL: base.origin, storageState: state });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await page.locator('[data-room="modules"]:visible').click();
  await page.getByTestId("modules-room").waitFor({ timeout: 30_000 });

  await step("the student sees the approved films and no upload control", async () => {
    await page.getByTestId("film-card").first().waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("film-card").count()) >= 1, "no film shows");
    expect((await page.getByText(/upload/i).count()) === 0 || (await page.getByText(/You cannot upload/i).count()) === 0, "an upload control shows");
  });

  await step("the student opens a film and it loads", async () => {
    await page.getByTestId("film-card").filter({ hasText: "One quiet breath" }).first().click();
    await page.getByTestId("film-video").waitFor({ timeout: 20_000 });
    await page.waitForFunction(() => {
      const v = document.querySelector('[data-testid="film-video"]');
      return v && v.readyState >= 1 && v.duration > 1;
    }, null, { timeout: 30_000 });
  });

  await step("a jump ahead is closed on the screen", async () => {
    await page.evaluate(() => {
      const v = document.querySelector('[data-testid="film-video"]');
      v.currentTime = Math.max(0, v.duration - 1);
    });
    await page.waitForTimeout(1200);
    const at = await page.evaluate(() => document.querySelector('[data-testid="film-video"]').currentTime);
    expect(at < 5, `the video stayed at ${at.toFixed(1)} seconds after a jump to the end`);
  });

  await step("watching to the end keeps the film and shows its score", async () => {
    await page.evaluate(async () => {
      const v = document.querySelector('[data-testid="film-video"]');
      v.muted = true;
      v.currentTime = 0;
      await v.play();
    });
    await page.getByTestId("film-status").filter({ hasText: "Kept" }).waitFor({ timeout: 60_000 });
    expect((await page.getByTestId("film-status").innerText()).includes("10"), "the score is not shown");
  });

  await step("after a reload the film is still kept, and the score is written once", async () => {
    await page.reload();
    await page.locator('[data-room="modules"]:visible').click();
    await page.getByTestId("modules-room").waitFor({ timeout: 30_000 });
    expect((await page.getByTestId("modules-kept").innerText()).startsWith("1/"), "the kept count is not 1");
    expect((await page.getByTestId("modules-score").innerText()) === "10", "the score is not 10");
    // Watch it again: nothing is added.
    await page.getByTestId("film-card").filter({ hasText: "One quiet breath" }).first().click();
    await page.getByTestId("film-video").waitFor({ timeout: 20_000 });
    await page.getByTestId("film-status").filter({ hasText: "Kept" }).waitFor({ timeout: 20_000 });
    await page.getByTestId("film-player").getByRole("button", { name: /Modules/ }).click();
    expect((await page.getByTestId("modules-score").innerText()) === "10", "a replay changed the score");
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
