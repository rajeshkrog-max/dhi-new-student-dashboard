// Repeatable browser proof of the house's front door (spec 0008), in a real browser, against the dev server on one address:
//   pnpm --filter dhirise build      (the funnel's built interview, served by the house dev server)
//   pnpm dev                          (the house on http://localhost:8080)
//   pnpm enter:check                  (this script)
// For an adult and for an under 18 student it checks: signed out sees the Enter screen; a new account goes to the interview; a started
// but unfinished check goes back to the interview; a finished check goes to the dashboard, which says they are not in a house yet (they have
// no invite); the report's "Go to your dashboard" button leads there; Leave ends the session. Then, for the house (spec house/0002), it checks
// that an institute admin invites a fresh test account from the staff screen, that person sees the Join step, presses Join and lands in their
// class under their own name, and that each role lands in its own place. That part needs the demo institute: run
// `pnpm --filter @dhi/backend exec convex run demo:seed` once on the development deployment. It signs in with the test form (needs VITE_TEST_SIGNIN=true in
// .env.local and TEST_SIGNIN_ENABLED on the development deployment) and exits with an error if any step fails.
// It refuses to run against production or against any address that is not this machine.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { PEOPLE, signIn, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";

// Refuses production, any address that is not this machine, and a funnel build made for production (scripts/local-dev-guard.mjs).
const base = assertLocalDevelopment("enter-check", argUrl);

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

  await step("the root address shows the Enter screen, and a referral link goes to the interview with the code kept", async () => {
    await page.goto("/");
    await page.getByTestId("landing-signin").waitFor({ timeout: 20_000 });
    await page.goto("/?ref=ABC1234");
    await page.waitForURL((url) => url.pathname.startsWith("/dhiinterviews/"), { timeout: 20_000 });
    expect(new URL(page.url()).searchParams.get("ref") === "ABC1234", "the referral code was lost on the way to the interview");
    await page.goto("/enter");
    await page.getByTestId("landing-signin").waitFor({ timeout: 20_000 });
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

  await step("a finished check goes to the dashboard, which says they are not in a house yet (no invite, no name shown)", async () => {
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
    await page.getByRole("heading", { name: "You are not in a house yet" }).waitFor({ timeout: 20_000 });
    const text = await page.locator("body").innerText();
    expect(!text.includes(name) && !text.includes("Suzzy"), "a name is shown to a person who is not in a house");
    expect((await page.locator("[data-room]").count()) === 0, "the house rooms are showing to a person who is not in a house");
  });

  await step("the root address and the old /home address both lead a finished student to the dashboard", async () => {
    await page.goto("/");
    await waitForPath(page, "/dashboard");
    await page.goto("/home");
    await waitForPath(page, "/dashboard");
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
    await page.getByRole("heading", { name: "You are not in a house yet" }).waitFor({ timeout: 20_000 });
  });

  await step("the funnel's challenge page has no countdown and no Ends rule (no end date)", async () => {
    await page.goto("/dhiinterviews/challenge.html");
    await page.waitForSelector("#cpClock", { state: "attached", timeout: 30_000 });
    expect(await page.locator("#cpClock").isHidden(), "the countdown is showing");
    expect(await page.locator("#cpRuleEnd").isHidden(), "the Ends rule is showing");
    await page.goto("/dashboard");
    await page.getByRole("heading", { name: "You are not in a house yet" }).waitFor({ timeout: 20_000 });
  });

  await step("Leave ends the session and returns to the Enter screen; the dashboard is closed again", async () => {
    await page.getByTestId("leave").click();
    await waitForPath(page, "/enter");
    await page.getByTestId("landing-signin").waitFor({ timeout: 20_000 });
    expect((await sessionText()) === "null", "the session is still alive after Leave");
    await page.goto("/dashboard");
    await waitForPath(page, "/enter");
  });

  await context.close();
}

// The house (spec house/0002): an invite made on the staff screen, the Join step, and each role in its own place.
async function runHouse(browser) {
  console.log("\nThe house (people, roles and invites)");
  const unique = `enter${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const guest = { email: `${unique}@example.test`, name: "Enter Student" };

  const adminState = await signInMember(browser, base, PEOPLE.admin).catch((error) => {
    console.error(`enter-check: could not sign in as the demo institute admin (${String(error?.message ?? error).split("\n")[0]}).`);
    console.error("Run `pnpm --filter @dhi/backend exec convex run demo:seed` once on the development deployment, then try again.");
    process.exit(2);
  });
  const adminContext = await browser.newContext({ baseURL: base.origin, storageState: adminState });
  const admin = await adminContext.newPage();

  await step("an institute admin lands in the staff area, which shows no student rooms", async () => {
    await admin.goto("/staff");
    // The staff area opens on Home (house spec 0026).
    await admin.getByRole("heading", { name: "Home", level: 1 }).waitFor({ timeout: 20_000 });
    expect(!(await admin.locator("body").innerText()).includes("Meal Tracker"), "the student rooms show in the staff area");
    await admin.goto("/dashboard");
    await waitForPath(admin, "/staff");
  });

  await step("an invite is made on the staff screen and says where to join", async () => {
    await admin.goto("/staff");
    await admin.locator('[data-room="invites"]:visible').click();
    await admin.getByTestId("invite-role").selectOption("student");
    await admin.getByTestId("invite-name").fill(guest.name);
    await admin.getByTestId("invite-email").fill(guest.email);
    await admin.getByTestId("invite-class").selectOption({ label: "Class 10 A" });
    await admin.getByTestId("invite-under18").selectOption("no");
    await admin.getByTestId("invite-create").click();
    await admin.getByTestId("staff-done").waitFor({ timeout: 20_000 });
    expect((await admin.getByTestId("staff-done").innerText()).includes("/join"), "the Join address is not shown");
    // The same address again is refused with the neutral words, which never say why. (The form empties itself after a success.)
    await admin.getByTestId("invite-name").fill(guest.name);
    await admin.getByTestId("invite-email").fill(guest.email);
    await admin.getByTestId("invite-create").click();
    await admin.getByTestId("staff-error").waitFor({ timeout: 20_000 });
    expect(!/already|member|taken|exists/i.test(await admin.getByTestId("staff-error").innerText()), "the refusal says why an address is in use");
  });

  await step("a class list with a bad row invites nobody and names the row", async () => {
    await admin.locator('[data-room="list"]:visible').click();
    await admin.getByTestId("class-list-text").fill(`Good Student, ${unique}.good@example.test, 10A, no\nBad Student, not an email, 10A, no`);
    await admin.getByTestId("class-list-send").click();
    await admin.getByTestId("class-list-bad").waitFor({ timeout: 20_000 });
    expect((await admin.getByTestId("class-list-bad").innerText()).includes("Row 2"), "the bad row is not named");
    await admin.getByTestId("class-list-text").fill(`Good Student, ${unique}.good@example.test, 10A, no`);
    await admin.getByTestId("class-list-send").click();
    await admin.getByTestId("staff-done").waitFor({ timeout: 20_000 });
  });

  const guestContext = await browser.newContext({ baseURL: base.origin });
  const guestPage = await guestContext.newPage();
  await step("the invited person signs in and sees the Join step, and nothing is made until they press it", async () => {
    await signIn(guestPage, guest);
    await waitForPath(guestPage, "/join");
    await guestPage.getByRole("heading", { name: "You are invited" }).waitFor({ timeout: 20_000 });
    const words = await guestPage.locator("main").innerText();
    expect(words.includes("Demo Institute") && words.includes("Student"), "the institute and the role are not shown");
  });

  await step("pressing Join lands them at the consent gate, and agreeing opens their class under their own name, with the student rooms", async () => {
    await guestPage.getByTestId("join").click();
    await waitForPath(guestPage, "/dashboard");
    // Spec house/0005: a student who has joined sees only the consent steps until they agree (the full flow is pnpm consent:check).
    await guestPage.getByRole("heading", { name: "Before you enter" }).waitFor({ timeout: 20_000 });
    await guestPage.waitForFunction(() => (document.querySelector('[data-testid="notice-box"]')?.textContent ?? "").includes("privacy@"), null, { timeout: 20_000 });
    await guestPage.getByTestId("notice-box").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await guestPage.waitForFunction(() => !document.querySelector('[data-testid="agree"]')?.hasAttribute("disabled"), null, { timeout: 5_000 });
    await guestPage.getByTestId("agree").click();
    await guestPage.getByText(guest.name).first().waitFor({ timeout: 20_000 });
    await guestPage.getByText("Class 10 A").first().waitFor({ timeout: 10_000 });
    // The rooms hold the student's own data now (house specs 0006 to 0020), so there is no sample data note, and Home shows the real score card.
    await guestPage.getByTestId("home-score").waitFor({ timeout: 20_000 });
    expect((await guestPage.getByTestId("sample-note").count()) === 0, "a sample data note is still shown on the dashboard");
    // The greeting card must show all of its content: it once shrank to a strip and clipped its text in the scrolling column (found 2026-10-18).
    const clipped = await guestPage.evaluate(() => {
      const card = document.querySelector("section[aria-label=House] article");
      return card ? card.scrollHeight - card.clientHeight : -1;
    });
    expect(clipped >= 0 && clipped <= 2, `the greeting card is clipped (${clipped}px of its content is cut off)`);
  });

  await step("a student cannot open the staff area, and the front door and /home both lead them to their dashboard", async () => {
    await guestPage.goto("/staff");
    await waitForPath(guestPage, "/dashboard");
    await guestPage.goto("/");
    await waitForPath(guestPage, "/dashboard");
    await guestPage.goto("/home");
    await waitForPath(guestPage, "/dashboard");
  });

  await step("the person who joined shows in the admin's People list, and pausing them locks them out at once", async () => {
    await admin.goto("/staff");
    await admin.locator('[data-room="people"]:visible').click();
    const row = admin.getByTestId("people-list").locator("li", { hasText: guest.email });
    // The list is oldest first, 25 a page, and the demo institute grows with every proof run, so press Show more until the new person shows.
    await admin.getByTestId("people-list").locator("li").first().waitFor({ timeout: 20_000 });
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
    await row.getByRole("button", { name: /^Pause/ }).click();
    await row.getByRole("button", { name: /^Bring back/ }).waitFor({ timeout: 20_000 });
    await guestPage.reload();
    await guestPage.getByRole("heading", { name: "Your access is paused" }).waitFor({ timeout: 20_000 });
    await row.getByRole("button", { name: /^Bring back/ }).click();
    await row.getByRole("button", { name: /^Pause/ }).waitFor({ timeout: 20_000 });
    await guestPage.reload();
    await guestPage.getByText(guest.name).first().waitFor({ timeout: 20_000 });
  });

  await step("Leave ends the session and the dashboard is closed again", async () => {
    await guestPage.getByRole("button", { name: /^Leave$/ }).last().click();
    await waitForPath(guestPage, "/enter");
    await guestPage.goto("/dashboard");
    await waitForPath(guestPage, "/enter");
  });
  await guestContext.close();

  await step("a teacher lands in the staff area with their own screens and no Institutes screen", async () => {
    const teacherState = await signInMember(browser, base, PEOPLE.teacher);
    const context = await browser.newContext({ baseURL: base.origin, storageState: teacherState });
    const page = await context.newPage();
    await page.goto("/staff");
    await page.getByRole("heading", { name: "Home", level: 1 }).waitFor({ timeout: 20_000 });
    expect((await page.locator('[data-room="classes"]:visible').innerText()).includes("My classes"), "a teacher has no My classes screen");
    expect((await page.locator('[data-room="institutes"]:visible').count()) === 0, "a teacher sees the Institutes screen");
    await context.close();
  });
  await adminContext.close();
}

const browser = await chromium.launch();
try {
  await runStudent(browser, { label: "An adult (20)", name: "Enter Adult", age: 20, cls: "College", minor: false });
  await runStudent(browser, { label: "A student under 18 (15, guardian ticked)", name: "Enter Minor", age: 15, cls: "Class 10", minor: true });
  await runHouse(browser);
} finally {
  await browser.close();
}

console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
