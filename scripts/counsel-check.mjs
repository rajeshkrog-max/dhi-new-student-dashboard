// Repeatable browser proof of counseling (spec house/0024), against the dev server: pnpm dev, the funnel built, then pnpm counsel:check.
// A fresh made up counselor (made by `counselProof:makeCounselor`, since a test inbox can never claim a counselor invite) opens the next half hour.
// A fresh made up student books it with a note, cancels and books again. The counselor sees only the first name, class, school and note. The
// session is moved to a minute ago (`counselProof:startNow`), both join the Stream call in two browsers with fake camera and microphone, the
// recording shows as on, both leave. The counselor writes the note (the student reads it), shares the recording with the demo teacher (who sees it
// under Your data) and takes the share back. Last, the recording itself: its address must load under the content policy. Every person is made up.
// Refuses production and any address that is not this machine. Uses the Stream app of the development deployment (STREAM_API_KEY and SECRET).
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudentWithEmail } from "./fresh-student.mjs";
import { PEOPLE, signIn, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("counsel-check", argUrl);
const skipRecording = process.argv.includes("--no-recording");
const failures = [];
const skipped = [];
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
function convexRun(fn, args) {
  const json = JSON.stringify(args).replace(/"/g, '\\"');
  try {
    return execSync(`npx convex run ${fn} "${json}"`, { cwd: "packages/backend", stdio: "pipe" }).toString();
  } catch (error) {
    throw new Error(`${fn}: ${String(error.stderr ?? error).replace(/\s+/g, " ").slice(0, 300)}`);
  }
}

// The next half hour in India, at least two minutes away, as the counselor's day and time fields take it.
const SLOT_MS = 30 * 60 * 1000;
const startsAt = Math.ceil((Date.now() + 2 * 60 * 1000) / SLOT_MS) * SLOT_MS;
const india = new Date(startsAt + 5.5 * 3600_000).toISOString();
const slotDate = india.slice(0, 10);
const slotTime = india.slice(11, 16);

const tag = Date.now().toString(36);
const letters = tag.replace(/[0-9]/g, (d) => "abcdefghij"[Number(d)]);
const counselor = { email: `counsel-${tag}@example.test`, name: `Cn${letters} Madeup`, first: `Cn${letters}` };
const note = `A made up note ${tag}`;
const summary = `A made up summary ${tag}`;

const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const policyBlocks = [];
const watch = (page) =>
  page.on("console", (m) => {
    if (/Content.Security.Policy|Refused to (connect|load|frame)/i.test(m.text())) policyBlocks.push(m.text().slice(0, 200));
  });
const mediaContext = (state) => browser.newContext({ baseURL: base.origin, storageState: state, permissions: ["camera", "microphone"] });

try {
  // The counselor: signed in once (the front door sends a person with no house on to the interview), then made a counselor on development.
  const firstContext = await browser.newContext({ baseURL: base.origin });
  await signIn(await firstContext.newPage(), counselor);
  const counselorState = await firstContext.storageState();
  await firstContext.close();
  convexRun("counselProof:makeCounselor", { email: counselor.email, name: counselor.name });

  const student = await freshStudentWithEmail(browser, base);
  const cContext = await mediaContext(counselorState);
  const sContext = await mediaContext(student.state);
  const c = await cContext.newPage();
  const s = await sContext.newPage();
  watch(c);
  watch(s);

  async function openSessions() {
    await c.goto("/staff");
    await c.locator('[data-room="counsel"]:visible').click();
    await c.getByTestId("counsel-staff").waitFor({ timeout: 30_000 });
  }
  async function openRoom() {
    await s.goto("/dashboard");
    await s.locator('[data-room="counsel"]:visible').click();
    await s.getByTestId("counsel-room").waitFor({ timeout: 30_000 });
  }
  // The counselor's first name is new each run, so it alone finds this run's time.
  const mySlot = () => s.getByTestId("counsel-slot").filter({ hasText: counselor.first });

  await step("the counselor sees only Sessions and Your data", async () => {
    await c.goto("/staff");
    await c.locator('[data-room="counsel"]:visible').waitFor({ timeout: 30_000 });
    const rooms = await c.locator("[data-room]:visible").evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-room")))]);
    expect(rooms.sort().join(",") === "counsel,data", `the counselor sees ${rooms.join(", ")}`);
  });

  await step(`the counselor opens ${slotDate} ${slotTime} (India)`, async () => {
    await openSessions();
    await c.getByTestId("counsel-slot-date").fill(slotDate);
    await c.getByTestId("counsel-slot-time").selectOption(slotTime);
    await c.getByTestId("counsel-open-slot").click();
    await c.getByTestId("staff-done").waitFor({ timeout: 20_000 });
  });

  await step("the student sees the time with the counselor's first name, and books it with a note", async () => {
    await openRoom();
    await mySlot().waitFor({ timeout: 20_000 });
    expect(!(await s.getByTestId("counsel-room").innerText()).includes("Madeup"), "the student sees the counselor's last name");
    await mySlot().click();
    await s.getByTestId("counsel-note").fill(note);
    await s.getByTestId("counsel-book").click();
    await s.getByTestId("counsel-done").waitFor({ timeout: 20_000 });
    await s.getByTestId("counsel-mine").getByText(note).waitFor({ timeout: 20_000 });
  });

  await step("the student cancels, the time is free again, and books it again", async () => {
    await s.getByTestId("counsel-cancel").click();
    await s.getByTestId("counsel-mine").getByText("You cancelled").waitFor({ timeout: 20_000 });
    await mySlot().click();
    await s.getByTestId("counsel-note").fill(note);
    await s.getByTestId("counsel-book").click();
    await s.getByTestId("counsel-cancel").waitFor({ timeout: 20_000 });
  });

  await step("the counselor sees the first name, class, school and note, and nothing more", async () => {
    await openSessions();
    const card = c.getByTestId("counsel-booking").filter({ hasText: note });
    await card.waitFor({ timeout: 20_000 });
    const text = await card.innerText();
    expect(text.includes("Room · Class 10 A · Demo Institute"), `the card reads: ${text.split("\n")[0]}`);
    expect(!text.includes("Proof") && !text.includes("@"), "the card shows more than the first name");
  });

  await step("the session is moved to a minute ago (development helper)", async () => {
    convexRun("counselProof:startNow", { studentEmail: student.email });
  });

  await step("both join the call in their own browser, and each sees two people", async () => {
    await openSessions();
    await openRoom();
    await c.getByTestId("counsel-open-call").first().click();
    await s.getByTestId("counsel-open-call").click();
    await c.getByTestId("counsel-join").click();
    await s.getByTestId("counsel-join").click();
    await c.getByTestId("counsel-call-live").waitFor({ timeout: 45_000 });
    await s.getByTestId("counsel-call-live").waitFor({ timeout: 45_000 });
    for (const page of [c, s]) {
      await page.waitForFunction(() => document.querySelectorAll(".str-video__participant-view").length >= 2, null, { timeout: 45_000 });
    }
  });

  await step("the recording shows as on for both", async () => {
    for (const page of [c, s]) await page.locator('[data-testid="counsel-recording"][data-on="true"]').waitFor({ timeout: 60_000 });
  });

  // Long enough for a recording with something in it.
  await c.waitForTimeout(15_000);

  await step("both leave the call", async () => {
    await s.getByTestId("counsel-leave").click();
    await s.getByTestId("counsel-room").waitFor({ timeout: 20_000 });
    await c.getByTestId("counsel-leave").click();
    await c.getByTestId("counsel-staff").waitFor({ timeout: 20_000 });
  });

  await step("the counselor writes the note after, and the student reads it", async () => {
    const card = c.getByTestId("counsel-booking").filter({ hasText: note });
    await card.getByTestId("counsel-summary").fill(summary);
    await card.getByTestId("counsel-finish").click();
    await card.getByTestId("staff-done").waitFor({ timeout: 20_000 });
    await openRoom();
    await s.getByTestId("counsel-mine").getByText(summary).waitFor({ timeout: 20_000 });
  });

  const teacherState = await signInMember(browser, base, PEOPLE.teacher);
  const tContext = await browser.newContext({ baseURL: base.origin, storageState: teacherState });
  const t = await tContext.newPage();
  watch(t);
  async function teacherShared() {
    await t.goto("/staff");
    await t.locator('[data-room="data"]:visible').click();
    await t.waitForTimeout(3_000);
    return t.getByTestId("counsel-shared").filter({ hasText: counselor.first }).count();
  }

  await step("the counselor shares the recording with a made up teacher, who sees it under Your data", async () => {
    const card = c.getByTestId("counsel-booking").filter({ hasText: note });
    await card.getByTestId("counsel-share-email").fill(PEOPLE.teacher.email);
    await card.getByTestId("counsel-share").click();
    await card.getByText("Shared with 1 person.").waitFor({ timeout: 20_000 });
    expect((await teacherShared()) === 1, "the teacher does not see the shared recording");
  });

  await step("the counselor takes the share back, and the teacher no longer sees it", async () => {
    const card = c.getByTestId("counsel-booking").filter({ hasText: note });
    await card.getByTestId("counsel-share-email").fill(PEOPLE.teacher.email);
    await card.getByTestId("counsel-unshare").click();
    await card.getByText("Shared with 1 person.").waitFor({ state: "detached", timeout: 20_000 });
    expect((await teacherShared()) === 0, "the teacher still sees the recording");
  });
  await tContext.close();

  // Stream needs a little while after the call to finish the file. Ask every 30 seconds for up to 8 minutes.
  if (skipRecording) {
    skipped.push("the recording plays under the content policy (--no-recording)");
  } else {
    await step("the recording appears for the counselor and plays under the content policy", async () => {
      let src = null;
      for (let i = 0; i < 16 && !src; i += 1) {
        await openSessions();
        const card = c.getByTestId("counsel-booking").filter({ hasText: note });
        await card.getByTestId("counsel-recordings").getByRole("button").click();
        await c.waitForTimeout(4_000);
        src = await card.locator("video").first().getAttribute("src", { timeout: 1_000 }).catch(() => null);
        if (!src) await c.waitForTimeout(26_000);
      }
      expect(src, "no recording after 8 minutes");
      console.log(`       recording host: ${new URL(src).host}`);
      const loaded = await c.locator("video").first().evaluate(
        (v) => new Promise((done) => (v.readyState >= 1 ? done(true) : (v.addEventListener("loadedmetadata", () => done(true)), v.addEventListener("error", () => done(false)), setTimeout(() => done(false), 20_000)))),
      );
      expect(loaded, "the recording did not load in the page");
    });
  }

  await step("no content policy block in any browser", async () => {
    expect(policyBlocks.length === 0, policyBlocks[0] ?? "");
  });

  await cContext.close();
  await sContext.close();
} finally {
  await browser.close();
}
console.log(`\n${steps - failures.length} of ${steps} steps passed.${skipped.length ? ` Skipped: ${skipped.join("; ")}.` : ""}`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
