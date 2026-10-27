// Signed in house members for the browser scripts that need the dashboard or the staff area (spec house/0002, spec house/0003). Each person is
// one of the fixed demo people of the demo institute (`npx convex run demo:seed` on the development deployment, packages/backend/convex/demo.ts),
// who sign in with the test form (an `@example.test` address) and press Join, exactly as a real person does. The accounts and invites are
// reused, so a run does not leave new people behind. Development backend only: callers run assertLocalDevelopment first. Each function returns the
// browser storage state (the session cookie) to seed more browser contexts.
import { execSync } from "node:child_process";

export const PASSWORD = "look-sweep-pass-1";
export const PEOPLE = {
  student: { email: "demo-student@example.test", name: "Demo Student", place: "/dashboard" },
  admin: { email: "demo-admin@example.test", name: "Demo Admin", place: "/staff" },
  teacher: { email: "demo-teacher@example.test", name: "Demo Teacher", place: "/staff" },
  minor: { email: "demo-minor@example.test", name: "Demo Minor", place: "/dashboard" },
  // The invite stays pending: the browser scripts look at the Join page and never press Join for this person.
  newcomer: { email: "demo-newcomer@example.test", name: "Demo Newcomer", place: "/join" },
  // Signed in, but no invite and no membership. The front door sends such a person to the funnel's interview, as it does any new account.
  // Joined, and left at the consent gate: the consent screen is always there to look at (spec house/0005).
  gate: { email: "demo-gate@example.test", name: "Demo Gate", place: "/dashboard" },
  stranger: { email: "demo-stranger@example.test", name: "Demo Stranger", place: "/dhiinterviews" },
  // A test inbox can never claim a counselor invite, so `signInCounselor` makes this person a counselor with a development helper.
  counselor: { email: "demo-counselor@example.test", name: "Demo Counselor", place: "/staff" },
};
// What the sweep's student checks look for (the demo student's name is on the dashboard, and must be on no status page).
export const TEST_STUDENT = PEOPLE.student;

const PLACES = ["/join", "/dashboard", "/staff", "/dhiinterviews"];

/** Signs in with the test form and returns where the front door sent the person. */
export async function signIn(page, person) {
  await page.goto("/enter");
  await page.getByTestId("landing-email").fill(person.email);
  await page.getByTestId("landing-password").fill(PASSWORD);
  await page.getByTestId("landing-submit").click();
  await page.waitForURL((url) => PLACES.some((p) => url.pathname.startsWith(p)), { timeout: 40_000 });
}

/** A person signed in and, unless `join` is false, joined: the storage state of a session that is inside the house. */
export async function signInMember(browser, base, person, { join = true } = {}) {
  const context = await browser.newContext({ baseURL: base.origin });
  const page = await context.newPage();
  await signIn(page, person);
  if (join && new URL(page.url()).pathname.startsWith("/join")) {
    await page.getByTestId("join").click();
    await page.waitForURL((url) => url.pathname.startsWith("/dashboard") || url.pathname.startsWith("/staff"), { timeout: 30_000 });
  }
  const state = await context.storageState();
  await context.close();
  return state;
}

/** A made up counselor, signed in: the first sign in has no house, then `counselProof:makeCounselor` (development only) makes the member. */
export async function signInCounselor(browser, base, person = PEOPLE.counselor) {
  const state = await signInMember(browser, base, person, { join: false });
  const json = JSON.stringify({ email: person.email, name: person.name }).replace(/"/g, '\\"');
  execSync(`npx convex run counselProof:makeCounselor "${json}"`, { cwd: "packages/backend", stdio: "pipe" });
  return state;
}

// Kept for the scripts that asked for a signed in student: the demo student, joined.
export async function signInFinishedStudent(browser, base) {
  return await signInMember(browser, base, PEOPLE.student);
}
