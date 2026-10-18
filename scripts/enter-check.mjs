// Repeatable browser proof of the house's front door (spec 0008), in a real browser, against the dev server on one address:
//   pnpm --filter dhirise build      (the funnel's built interview, served by the house dev server)
//   pnpm dev                          (the house on http://localhost:8080)
//   pnpm enter:check                  (this script)
// For an adult and for an under 18 student it checks: signed out sees the Enter screen; a new account goes to the interview; a started
// but unfinished check goes back to the interview; a finished check goes to the dashboard with the student's own name; the report's
// "Go to your dashboard" button leads there; Leave ends the session. It signs in with the test form (needs VITE_TEST_SIGNIN=true in
// .env.local and TEST_SIGNIN_ENABLED on the development deployment) and exits with an error if any step fails.
// It refuses to run against production or against any address that is not this machine.
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const PRODUCTION_DEPLOYMENT = "abundant-caiman-975";

const base = new URL(argUrl);
if (!["localhost", "127.0.0.1"].includes(base.hostname)) {
  console.error(`enter-check: refusing ${base.origin}. It only runs against this machine.`);
  process.exit(2);
}
const envFile = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
if (envFile.includes(PRODUCTION_DEPLOYMENT) || process.env.PUBLIC_CONVEX_URL?.includes(PRODUCTION_DEPLOYMENT)) {
  console.error("enter-check: .env.local points at the production deployment. It only runs against development.");
  process.exit(2);
}

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

async function waitForPath(page, prefix, ms = 20_000) {
  await page.waitForURL((url) => url.pathname.startsWith(prefix), { timeout: ms });
}

// One student, start to finish. `minor` adds the guardian tick the server asks for under 18.
async function runStudent(browser, { label, name, age, cls, minor }) {
  console.log(`\n${label}`);
  const context = await browser.newContext({ baseURL: base.origin });
  const page = await context.newPage();
  const tag = `enter${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `${tag}@example.com`;
  const sessionText = () => page.evaluate(async () => (await (await fetch("/api/auth/get-session")).text()).slice(0, 8));

  await step("signed out: the Enter screen shows, with no student text", async () => {
    await page.goto("/enter");
    await page.getByTestId("landing-signin").waitFor({ timeout: 20_000 });
    expect(await page.getByTestId("landing-google").isVisible(), "no Google button");
    expect(!(await page.locator("body").innerText()).includes(name), "a student name is on the signed out screen");
  });

  await step("a brand new account goes to the interview", async () => {
    await page.getByTestId("landing-email").fill(email);
    await page.getByTestId("landing-password").fill("enter-check-pass-1");
    await page.getByTestId("landing-submit").click();
    await waitForPath(page, "/dhiinterviews/");
  });

  await step("a profile with no finished check goes back to the interview", async () => {
    await page.waitForFunction(() => window.DhiSession, null, { timeout: 20_000 });
    const made = await page.evaluate(
      (profile) => window.DhiSession.createProfile(profile),
      { name, age, class: cls, guardianPresent: minor },
    );
    expect(made?.ok === true, `createProfile answered ${JSON.stringify(made)}`);
    await page.goto("/enter");
    await waitForPath(page, "/dhiinterviews/");
  });

  await step("a finished check goes to the dashboard with the student's own name and class", async () => {
    await page.goto("/dhiinterviews/question.html");
    await page.waitForFunction(() => window.DhiStore && window.DhiSession, null, { timeout: 20_000 });
    await page.evaluate(() => {
      for (let n = 1; n <= 18; n += 1) window.DhiStore.answer(n, `q${n}o2`);
    });
    await page.waitForFunction(() => window.DhiSession.pendingCount() === 0, null, { timeout: 30_000 });
    const finished = await page.evaluate(() => window.DhiSession.finish());
    expect(finished?.ok === true, `finish answered ${JSON.stringify(finished)}`);
    await page.goto("/enter");
    await waitForPath(page, "/dashboard");
    await page.getByText(name).first().waitFor({ timeout: 20_000 });
    expect(!(await page.locator("body").innerText()).includes("Suzzy"), "the demo name is on the dashboard");
    await page.getByText(cls).first().waitFor({ timeout: 10_000 }); // the profile card of the side menu (desktop width)
  });

  await step("the report ends with a button to the dashboard, and it leads there", async () => {
    await page.goto("/dhiinterviews/done.html");
    await page.waitForFunction(() => window.DhiSession, null, { timeout: 20_000 });
    const lead = await page.evaluate(
      (guardian) => window.DhiSession.submitLead({ phone: "9876543210", wantsCommunity: false, guardianPresent: guardian }),
      minor,
    );
    expect(lead?.ok === true, `submitLead answered ${JSON.stringify(lead)}`);
    await page.goto("/dhiinterviews/report-student.html");
    const button = page.locator("#goDashboard");
    await button.waitFor({ timeout: 30_000 });
    expect((await button.getAttribute("href")) === "/dashboard", "the button does not point to /dashboard");
    await button.click();
    await waitForPath(page, "/dashboard");
    await page.getByText(name).first().waitFor({ timeout: 20_000 });
  });

  await step("the funnel's challenge page has no countdown and no Ends rule (no end date)", async () => {
    await page.goto("/dhiinterviews/challenge.html");
    await page.waitForSelector("#cpClock", { state: "attached", timeout: 30_000 });
    expect(await page.locator("#cpClock").isHidden(), "the countdown is showing");
    expect(await page.locator("#cpRuleEnd").isHidden(), "the Ends rule is showing");
    await page.goto("/dashboard");
    await page.getByText(name).first().waitFor({ timeout: 20_000 });
  });

  await step("Leave ends the session and returns to the Enter screen; the dashboard is closed again", async () => {
    await page.getByRole("button", { name: /^Leave$/ }).last().click();
    await waitForPath(page, "/enter");
    await page.getByTestId("landing-signin").waitFor({ timeout: 20_000 });
    expect((await sessionText()) === "null", "the session is still alive after Leave");
    await page.goto("/dashboard");
    await waitForPath(page, "/enter");
  });

  await context.close();
}

const browser = await chromium.launch();
try {
  await runStudent(browser, { label: "An adult (20)", name: "Enter Adult", age: 20, cls: "College", minor: false });
  await runStudent(browser, { label: "A student under 18 (15, guardian ticked)", name: "Enter Minor", age: 15, cls: "Class 10", minor: true });
} finally {
  await browser.close();
}

console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
