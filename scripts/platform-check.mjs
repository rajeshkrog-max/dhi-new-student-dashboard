// Repeatable browser proof of the two platform follow ups that had none (house spec 0002), in a real browser, against the dev server:
//   pnpm dev                          (the house on http://localhost:8080, with the funnel built: pnpm --filter dhirise build)
//   pnpm platform:check               (this script)
// The funnel link: a made up adult takes the DhiRise check, is invited by the demo institute admin, joins and agrees, then links the check on Your
// data. The download holds their own answers (never a result or a score), unlinking takes them out again, and after a withdrawal the card is gone
// and the page still works. Move staff: the institute admin is never offered the move of a fresh teacher to another institute. The move
// itself is a DHI admin's, and a test inbox can never be one, so the backend suite proves it (`memberMove.test.ts`). Every person is made up. Needs the demo institute (`demo:seed`), VITE_TEST_SIGNIN=true in .env.local and
// TEST_SIGNIN_ENABLED on the development deployment. It refuses to run against production or any address that is not this machine.
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { PEOPLE, signIn, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("platform-check", argUrl);

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
const waitForPath = (page, prefix, timeout = 30_000) => page.waitForURL((url) => url.pathname.startsWith(prefix), { timeout });
const tagOf = (word) => `${word}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
// Letters only, for a name a person would type.
const letters = (n) => Array.from({ length: n }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");

async function showRow(page, listId, row) {
  await page.getByTestId(listId).locator("li").first().waitFor({ timeout: 20_000 });
  for (let more = 0, idle = 0; more < 400 && (await row.count()) === 0; more += 1) {
    const button = page.getByRole("button", { name: "Show more" });
    if ((await button.count()) === 0) {
      if ((idle += 1) > 8) break;
      await page.waitForTimeout(500);
      continue;
    }
    idle = 0;
    await button.first().click();
    await page.waitForTimeout(600);
  }
  await row.first().waitFor({ timeout: 10_000 });
}

async function invite(page, { role, name, email }) {
  await page.locator('[data-room="invites"]:visible').click();
  await page.getByTestId("invite-role").selectOption(role);
  await page.getByTestId("invite-name").fill(name);
  await page.getByTestId("invite-email").fill(email);
  if (role === "student") {
    await page.getByTestId("invite-class").selectOption({ label: "Class 10 A" });
    await page.getByTestId("invite-under18").selectOption("no");
  }
  await page.getByTestId("invite-create").click();
  await page.getByTestId("staff-done").waitFor({ timeout: 20_000 });
}

async function download(page) {
  const [file] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), page.getByTestId("download-data").click()]);
  return JSON.parse(await readFile(await file.path(), "utf8"));
}

const browser = await chromium.launch();
try {
  const adminContext = await browser.newContext({ baseURL: base.origin, storageState: await signInMember(browser, base, PEOPLE.admin) });
  const admin = await adminContext.newPage();
  await admin.goto("/staff");

  console.log("\nThe funnel link");
  const kidContext = await browser.newContext({ baseURL: base.origin });
  const page = await kidContext.newPage();
  const crashes = [];
  page.on("pageerror", (e) => crashes.push(String(e?.message ?? e)));
  const kid = { email: `${tagOf("link")}@example.test`, name: `Link Proof ${letters(5)}` };

  await step("a made up adult takes the DhiRise check before they are invited", async () => {
    await signIn(page, kid);
    await waitForPath(page, "/dhiinterviews/");
    await page.waitForFunction(() => window.DhiSession, null, { timeout: 20_000 });
    const made = await page.evaluate((p) => window.DhiSession.createProfile(p), { name: kid.name, age: 19, class: "College", guardianPresent: false });
    expect(made?.ok === true, `createProfile answered ${JSON.stringify(made)}`);
    await page.goto("/dhiinterviews/question.html");
    await page.waitForFunction(() => window.DhiStore && window.DhiSession, null, { timeout: 20_000 });
    await page.evaluate(() => {
      for (let n = 1; n <= 18; n += 1) window.DhiStore.answer(n, `q${n}o2`);
    });
    await page.waitForFunction(() => window.DhiSession.pendingCount() === 0, null, { timeout: 30_000 });
    const finished = await page.evaluate(() => window.DhiSession.finish());
    expect(finished?.ok === true, `finish answered ${JSON.stringify(finished)}`);
  });

  await step("the institute admin invites them, they join and agree, and Your data offers the link", async () => {
    await invite(admin, { role: "student", ...kid });
    await page.goto("/enter");
    await waitForPath(page, "/join");
    await page.getByTestId("join").click();
    await waitForPath(page, "/dashboard");
    await page.waitForFunction(() => (document.querySelector('[data-testid="notice-box"]')?.textContent ?? "").includes("privacy@"), null, { timeout: 30_000 });
    await page.getByTestId("notice-box").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForFunction(() => !document.querySelector('[data-testid="agree"]')?.hasAttribute("disabled"), null, { timeout: 10_000 });
    await page.getByTestId("agree").click();
    await page.locator('[data-room="data"]:visible').click();
    await page.getByTestId("funnel-link-go").waitFor({ timeout: 20_000 });
    const before = await download(page);
    expect(before.funnel === null, `the download holds the check before the student linked it: ${JSON.stringify(before.funnel)?.slice(0, 300)} keys ${Object.keys(before)}`);
  });

  await step("linking puts their own answers in the download, and never a result or a score", async () => {
    await page.getByTestId("funnel-link-go").click();
    await page.getByTestId("funnel-linked").waitFor({ timeout: 20_000 });
    const file = await download(page);
    const answers = file.funnel?.checks?.[0]?.answers ?? [];
    expect(answers.length === 18, `the download holds ${answers.length} answers, not 18: ${JSON.stringify(file.funnel)?.slice(0, 400)}`);
    expect(file.funnel.profile?.name === kid.name, "the download does not hold the profile they gave the funnel");
    const text = JSON.stringify(file.funnel);
    expect(!/"(score|result|flag|band|level)s?"/i.test(text), "the funnel part of the download holds a result, a score or a flag");
  });

  await step("unlinking takes the check out of the download again", async () => {
    await page.getByTestId("funnel-unlink").click();
    await page.getByTestId("funnel-link-go").waitFor({ timeout: 20_000 });
    expect((await download(page)).funnel === null, "the download still holds the check after unlinking");
  });

  await step("after a withdrawal the card is gone and Your data still works (no crash)", async () => {
    await page.getByTestId("withdraw-consent").click();
    await page.getByRole("heading", { name: "The house is paused for you" }).waitFor({ timeout: 20_000 });
    await page.getByTestId("toggle-data").click();
    await page.getByTestId("restore-consent").waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("funnel-link").count()) === 0, "the funnel card is offered to a student who withdrew");
    expect((await page.getByText("Something went wrong").count()) === 0, "Your data crashed after the withdrawal");
    await page.getByTestId("restore-consent").click();
    await page.getByTestId("toggle-data").click().catch(() => undefined);
    await page.getByText(kid.name).first().waitFor({ timeout: 20_000 });
    expect(crashes.length === 0, `the page threw: ${crashes[0]}`);
  });
  await kidContext.close();

  console.log("\nMove staff");
  const teacher = { email: `${tagOf("move")}@example.test`, name: `Move Proof ${letters(5)}` };

  await step("an institute admin invites a fresh teacher, who joins, and is never offered the move to another institute", async () => {
    await admin.goto("/staff");
    await invite(admin, { role: "teacher", ...teacher });
    await signInMember(browser, base, teacher);
    await admin.reload();
    await admin.locator('[data-room="people"]:visible').click();
    const row = admin.getByTestId("people-list").locator("li", { hasText: teacher.email });
    await showRow(admin, "people-list", row);
    expect((await admin.getByRole("combobox", { name: /to another institute/ }).count()) === 0, "the institute admin is offered Move to institute");
  });
  // The move itself needs a DHI admin, and a test inbox can never claim that role (`houseCore.mayClaimUnverified`), so a browser cannot do it, on
  // purpose. `memberMove.test.ts` in packages/backend proves the move: DHI admin only, staff only, class links ended, `member.move` logged for both.
  console.log("  skip the DHI admin's move itself: a test inbox cannot be a DHI admin by design (covered by packages/backend memberMove.test.ts)");
  await adminContext.close();
} finally {
  await browser.close();
}

console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.log(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
