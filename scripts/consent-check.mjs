// Repeatable browser proof of the house consent flow (spec house/0005), in a real browser, against the dev server:
//   pnpm dev                          (the house on http://localhost:8080)
//   pnpm consent:check                (this script)
// A student under 18 is invited by the demo institute admin, joins, and sees only the consent steps (no name, no rooms). "I agree" stays locked
// until the notice is scrolled to the end. They then wait for the school; the admin records the parent's consent on the Parent consent screen and the
// house opens by itself. In Your data the student turns sharing on, downloads their file, withdraws (the house pauses) and brings consent back, and
// finally erases (two step confirm): they are signed out, and the same email cannot be invited again for 30 days (the neutral refusal).
// Needs the demo institute (`pnpm --filter @dhi/backend exec convex run demo:seed`), VITE_TEST_SIGNIN=true in .env.local, TEST_SIGNIN_ENABLED and
// ERASURE_HASH_SECRET on the development deployment. It refuses to run against production or any address that is not this machine.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { PEOPLE, signIn, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("consent-check", argUrl);

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

// The staff lists are oldest first, 25 a page, and the demo institute grows with every proof run, so press Show more until the row shows (up to 400 pages, because every proof run adds students).
async function showRow(admin, listId, row) {
  await admin.getByTestId(listId).locator("li").first().waitFor({ timeout: 20_000 });
  // The button is gone for a moment while a page loads, so it is waited for (up to 4 seconds) before the list is taken as complete.
  for (let more = 0, idle = 0; more < 400 && (await row.count()) === 0; more += 1) {
    const button = admin.getByRole("button", { name: "Show more" });
    if ((await button.count()) === 0) {
      if ((idle += 1) > 8) break;
      await admin.waitForTimeout(500);
      continue;
    }
    idle = 0;
    await button.first().click();
    await admin.waitForTimeout(600);
  }
  await row.waitFor({ timeout: 20_000 });
}
const waitForPath = (page, prefix, ms = 20_000) => page.waitForURL((url) => url.pathname.startsWith(prefix), { timeout: ms });

const unique = `consent${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const kid = { email: `${unique}@example.test`, name: `Consent Kid ${unique.slice(-4)}` };

const browser = await chromium.launch();
try {
  const adminState = await signInMember(browser, base, PEOPLE.admin).catch((error) => {
    console.error(`consent-check: could not sign in as the demo institute admin (${String(error?.message ?? error).split("\n")[0]}).`);
    console.error("Run `pnpm --filter @dhi/backend exec convex run demo:seed` once on the development deployment, then try again.");
    process.exit(2);
  });
  const adminContext = await browser.newContext({ baseURL: base.origin, storageState: adminState });
  const admin = await adminContext.newPage();
  const kidContext = await browser.newContext({ baseURL: base.origin, acceptDownloads: true });
  const page = await kidContext.newPage();

  await step("an institute admin invites a student marked under 18", async () => {
    await admin.goto("/staff");
    await admin.locator('[data-room="invites"]:visible').click();
    await admin.getByTestId("invite-role").selectOption("student");
    await admin.getByTestId("invite-name").fill(kid.name);
    await admin.getByTestId("invite-email").fill(kid.email);
    await admin.getByTestId("invite-class").selectOption({ label: "Class 10 A" });
    await admin.getByTestId("invite-under18").selectOption("yes");
    await admin.getByTestId("invite-create").click();
    await admin.getByTestId("staff-done").waitFor({ timeout: 20_000 });
  });

  await step("after Join the student sees only the consent steps: no name, no class, no rooms", async () => {
    await signIn(page, kid);
    await waitForPath(page, "/join");
    await page.getByTestId("join").click();
    await waitForPath(page, "/dashboard");
    await page.getByRole("heading", { name: "Before you enter" }).waitFor({ timeout: 20_000 });
    const text = await page.locator("main").innerText();
    expect(!text.includes(kid.name) && !text.includes("Class 10") && !text.includes("Meal Tracker"), "the consent screen shows the student's name, class or rooms");
    // The owner approved the notice on 2026-10-28: no draft mark.
    await page.waitForTimeout(1500);
    expect((await page.getByTestId("draft-mark").count()) === 0, "the draft mark still shows");
  });

  await step("I agree is locked until the notice is scrolled to the end, and the notice is shown as written", async () => {
    const agree = page.getByTestId("agree");
    expect(await agree.isDisabled(), "I agree is open before the notice was read");
    await page.waitForFunction(() => (document.querySelector('[data-testid="notice-box"]')?.textContent ?? "").includes("privacy@"), null, { timeout: 20_000 });
    const words = await page.getByTestId("notice-box").innerText();
    expect(/privacy@dhirise\.com/.test(words) && /Convex/.test(words), "the notice is missing its contact or where data is stored");
    await page.getByTestId("notice-box").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForFunction(() => !document.querySelector('[data-testid="agree"]')?.hasAttribute("disabled"), null, { timeout: 5_000 });
    await agree.click();
  });

  await step("an under 18 student then waits for the school, and still sees no rooms", async () => {
    await page.getByTestId("parent-waiting").waitFor({ timeout: 20_000 });
    expect(!(await page.locator("body").innerText()).includes("Meal Tracker"), "rooms show before the school recorded consent");
  });

  await step("the admin records the parent's consent on the Parent consent screen, and the house opens by itself", async () => {
    await admin.goto("/staff");
    await admin.locator('[data-room="parent"]:visible').click();
    await admin.waitForTimeout(1500);
    expect((await admin.getByTestId("draft-mark").count()) === 0, "the draft mark still shows on the school's screen");
    const row = admin.getByTestId("parent-list").locator("li", { hasText: kid.name });
    await showRow(admin, "parent-list", row);
    await row.getByRole("button", { name: /^Record consent/ }).click();
    await row.getByText("On file").waitFor({ timeout: 20_000 });
    await page.getByText(kid.name).first().waitFor({ timeout: 20_000 });
    await page.getByText("Class 10 A").first().waitFor({ timeout: 10_000 });
  });

  await step("the institute admin sees the Parent consent screen (a DHI admin does not: only the school records it)", async () => {
    // The staff nav for an institute admin lists it; checked here from the admin side only. The DHI admin case is covered by the backend suite.
    expect((await admin.locator('[data-room="parent"]:visible').count()) === 1, "the institute admin does not see Parent consent");
  });

  await step("Your data: sharing is off, turning it on is saved, and the access record starts empty", async () => {
    await page.locator('[data-room="data"]:visible').click();
    await page.getByTestId("your-data").waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("your-data").innerText()).includes("Off"), "sharing does not start off");
    await page.getByTestId("toggle-sharing").click();
    await page.getByText("On: a summary").waitFor({ timeout: 20_000 });
    await page.getByTestId("access-empty").waitFor({ timeout: 10_000 });
  });

  await step("Your data: the download is one JSON file of the student's own data", async () => {
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), page.getByTestId("download-data").click()]);
    const path = await download.path();
    const { readFile } = await import("node:fs/promises");
    const file = JSON.parse(await readFile(path, "utf8"));
    expect(file.schema === "dhi-house-export-v1", "the file has no schema");
    expect(file.profile?.under18 === true && file.sharing?.parentLevel === "summary", "the file does not hold the student's profile and sharing");
    expect(Array.isArray(file.events) && file.rooms && typeof file.rooms === "object", "the file has no events or rooms");
    expect(!JSON.stringify(file).includes(PEOPLE.admin.email), "the file holds somebody else's data");
  });

  await step("withdrawing pauses the house on the next call, and bringing consent back opens it again", async () => {
    await page.getByTestId("withdraw-consent").click();
    await page.getByRole("heading", { name: "The house is paused for you" }).waitFor({ timeout: 20_000 });
    await page.getByTestId("toggle-data").click();
    await page.getByTestId("restore-consent").click();
    await page.getByTestId("toggle-data").click().catch(() => undefined);
    await page.getByText(kid.name).first().waitFor({ timeout: 20_000 });
  });

  await step("the school's withdrawal pauses the student, who cannot undo it themselves", async () => {
    const row = admin.getByTestId("parent-list").locator("li", { hasText: kid.name });
    await row.getByRole("button", { name: /withdrew/ }).click();
    await row.getByText("Withdrawn by school").waitFor({ timeout: 20_000 });
    await page.getByRole("heading", { name: "The house is paused for you" }).waitFor({ timeout: 20_000 });
    await page.getByTestId("toggle-data").click();
    await page.getByText("Only your school can bring it back").waitFor({ timeout: 20_000 }).catch(() => {
      throw new Error("the student is not told only the school can restore");
    });
    expect((await page.getByTestId("restore-consent").count()) === 0, "the student is offered a restore for the school's side");
    await row.getByRole("button", { name: /restored/ }).click();
    await row.getByText("On file").waitFor({ timeout: 20_000 });
    await page.getByTestId("toggle-data").click().catch(() => undefined);
    await page.getByText(kid.name).first().waitFor({ timeout: 20_000 });
  });

  await step("a paused student still reaches Your data (consent state, download, erase) and nothing else", async () => {
    await admin.goto("/staff");
    await admin.locator('[data-room="people"]:visible').click();
    const row = admin.getByTestId("people-list").locator("li", { hasText: kid.email });
    await showRow(admin, "people-list", row);
    await row.getByRole("button", { name: /^Pause/ }).click();
    await row.getByRole("button", { name: /^Bring back/ }).waitFor({ timeout: 20_000 });
    await page.reload();
    await page.getByRole("heading", { name: "Your access is paused" }).waitFor({ timeout: 20_000 });
    await page.getByTestId("paused-data").click();
    await page.getByTestId("your-data").waitFor({ timeout: 20_000 });
    await page.getByTestId("download-data").waitFor({ timeout: 10_000 });
    await page.getByTestId("erase-start").waitFor({ timeout: 10_000 });
    expect((await page.getByTestId("toggle-sharing").count()) === 0 && (await page.getByTestId("access-list").count()) === 0, "a paused student is offered the sharing switch or the access record");
    expect(!(await page.getByTestId("your-data-error").count()), "Your data shows an error for a paused student");
    await row.getByRole("button", { name: /^Bring back/ }).click();
    await row.getByRole("button", { name: /^Pause/ }).waitFor({ timeout: 20_000 });
    await page.reload();
    await page.getByText(kid.name).first().waitFor({ timeout: 20_000 });
  });

  await step("erase asks twice, signs the student out, and the same email is refused neutrally for 30 days", async () => {
    await page.locator('[data-room="data"]:visible').click();
    await page.getByTestId("erase-start").click();
    await page.getByTestId("erase-confirm").waitFor({ timeout: 5_000 });
    await page.getByTestId("erase-yes").click();
    await waitForPath(page, "/enter", 40_000);
    await admin.goto("/staff");
    await admin.locator('[data-room="invites"]:visible').click();
    await admin.getByTestId("invite-role").selectOption("student");
    await admin.getByTestId("invite-name").fill(kid.name);
    await admin.getByTestId("invite-email").fill(kid.email);
    await admin.getByTestId("invite-class").selectOption({ label: "Class 10 A" });
    await admin.getByTestId("invite-under18").selectOption("no");
    await admin.getByTestId("invite-create").click();
    await admin.getByTestId("staff-error").waitFor({ timeout: 20_000 });
    expect(!/erase|blocked|30 days/i.test(await admin.getByTestId("staff-error").innerText()), "the refusal says why the address cannot be invited");
  });

  await kidContext.close();
  await adminContext.close();
} finally {
  await browser.close();
}

console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
