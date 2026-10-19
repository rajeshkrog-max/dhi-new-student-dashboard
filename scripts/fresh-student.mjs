// A fresh made up student for the browser proofs of the rooms: invited by the demo institute admin, joined, and through the consent gate, so a
// room's per day limits never carry over from an earlier run. Development backend only (the callers run assertLocalDevelopment first).
import { PEOPLE, signIn, signInMember } from "./test-student.mjs";

// A fresh made up student for each run (invited by the demo institute admin, joined, and agreed), so the room's limit of 10 mood changes a day
// never carries over from an earlier run.
export async function freshStudent(browser, base) {
  const unique = `room${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const person = { email: `${unique}@example.test`, name: `Room Proof ${unique.slice(-4)}` };
  const adminState = await signInMember(browser, base, PEOPLE.admin);
  const adminContext = await browser.newContext({ baseURL: base.origin, storageState: adminState });
  const admin = await adminContext.newPage();
  await admin.goto("/staff");
  await admin.locator('[data-room="invites"]:visible').click();
  await admin.getByTestId("invite-role").selectOption("student");
  await admin.getByTestId("invite-name").fill(person.name);
  await admin.getByTestId("invite-email").fill(person.email);
  await admin.getByTestId("invite-class").selectOption({ label: "Class 10 A" });
  await admin.getByTestId("invite-under18").selectOption("no");
  await admin.getByTestId("invite-create").click();
  await admin.getByTestId("staff-done").waitFor({ timeout: 20_000 });
  await adminContext.close();

  const context = await browser.newContext({ baseURL: base.origin });
  const page = await context.newPage();
  await signIn(page, person);
  await page.waitForURL((url) => url.pathname.startsWith("/join"), { timeout: 30_000 });
  await page.getByTestId("join").click();
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 30_000 });
  await page.waitForFunction(() => (document.querySelector('[data-testid="notice-box"]')?.textContent ?? "").includes("privacy@"), null, { timeout: 30_000 });
  await page.getByTestId("notice-box").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await page.waitForFunction(() => !document.querySelector('[data-testid="agree"]')?.hasAttribute("disabled"), null, { timeout: 10_000 });
  await page.getByTestId("agree").click();
  await page.locator('[data-room="mood"]:visible').waitFor({ timeout: 30_000 });
  const state = await context.storageState();
  await context.close();
  return state;
}

