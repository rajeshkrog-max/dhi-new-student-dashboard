// Repeatable browser proof of the papers, exams and blog screens (spec house/0011, house/0012, house/0014), against the dev server:
//   pnpm dev                          (the house on http://localhost:8080)
//   pnpm exams:check                  (this script)
// The demo teacher builds a multiple choice paper with a long question and a hint for each (a hint that gives the answer away is refused first),
// and sends it to a demo class with a window that is open now. The demo student starts it, finds the rest of the house locked, asks for a hint,
// answers both questions, reloads (what was typed survives) and submits. The teacher reads the answers, marks and confirms; the student sees the
// mark and accepts the feedback. The student then posts to the blog, and the demo teacher approves the post in Reviews, and the student sees it
// shared. Needs the demo institute (`pnpm --filter @dhi/backend exec convex run demo:seed`)
// and VITE_TEST_SIGNIN=true in .env.local. It refuses production and any address that is not this machine. Each run uses a unique paper title.
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { PEOPLE, signInMember } from "./test-student.mjs";

const argUrl = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "http://localhost:8080";
const base = assertLocalDevelopment("exams-blog-check", argUrl);

const failures = [];
let steps = 0;
async function step(label, run) {
  steps += 1;
  try {
    await run();
    console.log(`  ok   ${label}`);
  } catch (error) {
    failures.push(label);
    console.log(
      `  FAIL ${label}\n       ${String(error?.message ?? error)
        .split("\n")
        .slice(0, process.env.PROOF_DEBUG ? 12 : 1)
        .join("\n       ")}`,
    );
    if (process.env.PROOF_DEBUG)
      await globalThis.proofPage
        ?.screenshot({ path: `${process.env.PROOF_DEBUG}/step-${steps}.png` })
        .catch(() => {});
  }
}
// A lazy photo: scrolled into view, then up to 15 seconds for its bytes.
async function photoLoaded(card) {
  const img = card.getByTestId("blog-post-photo");
  await img.scrollIntoViewIfNeeded();
  await img.evaluate((el) =>
    el.complete && el.naturalWidth > 0
      ? null
      : new Promise((done) => {
          el.addEventListener("load", done, { once: true });
          setTimeout(done, 15_000);
        }),
  );
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
// A datetime-local value for the local clock, offset by some minutes.
const localInput = (minutes) => {
  const d = new Date(Date.now() + minutes * 60_000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const title = `Proof paper ${Date.now().toString(36)}`;
const post = `Proof post ${Date.now().toString(36)}`;
// A 1 by 1 PNG, so the proof sends a real picture without a file on disk.
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const story = `Once there was a proof ${Date.now().toString(36)}.`;

// A run that stopped part way may have left the demo student in a sitting, which the server's exam lock would hold them in (house spec 0012 AC-7).
execSync("npx convex run papersProof:resetDemoSitting", { cwd: "packages/backend", stdio: "pipe" });

const browser = await chromium.launch();
try {
  const teacherState = await signInMember(browser, base, PEOPLE.teacher);
  const teacherContext = await browser.newContext({
    baseURL: base.origin,
    storageState: teacherState,
  });
  const teacher = await teacherContext.newPage();

  await step(
    "the teacher builds a paper with a multiple choice and a long question, and saves it",
    async () => {
      await teacher.goto("/staff");
      await teacher.locator('[data-room="papers"]:visible').click();
      await teacher.getByTestId("papers-section").waitFor({ timeout: 20_000 });
      await teacher.getByLabel("Paper title").fill(title);
      // The subject is a pick from the fixed list (house spec 0028).
      await teacher.getByTestId("question-subject").first().selectOption("maths");
      await teacher.getByLabel("Topic").first().fill("Fractions");
      await teacher.getByLabel("Question").first().fill("What is half of four?");
      await teacher.getByLabel("Options, one a line (2 to 6)").fill("one\ntwo\nthree");
      await teacher.getByLabel("Right option (its number, starting at 1)").fill("2");
      await teacher.getByRole("button", { name: "Add long answer" }).click();
      await teacher.getByTestId("question-subject").nth(1).selectOption("english");
      await teacher.getByLabel("Topic").nth(1).fill("Story");
      await teacher.getByLabel("Question").nth(1).fill("Tell a short story.");
      await teacher.getByTestId("question-rubric").fill("Plot and ending");
      // A hint that names the right option is refused, and nothing is saved.
      const hints = teacher.getByLabel(/Hint for the student/);
      await hints.first().fill("The answer is two, count again.");
      await hints.nth(1).fill("Say who, then what happened.");
      await teacher.getByRole("button", { name: "Save paper" }).click();
      await teacher
        .getByRole("alert")
        .filter({ hasText: /give the answer away/ })
        .waitFor({ timeout: 20_000 });
      expect(
        (await teacher.getByText("The paper is saved").count()) === 0,
        "a paper with a hint that gives the answer away was saved",
      );
      await hints.first().fill("Share four things equally.");
      await teacher.getByRole("button", { name: "Save paper" }).click();
      await teacher.getByText("The paper is saved").waitFor({ timeout: 20_000 });
    },
  );

  await step("the teacher sends it to a class with a window open now", async () => {
    await teacher.getByTestId("send-opens").fill(localInput(-60));
    await teacher.getByTestId("send-due").fill(localInput(60));
    const paperValue = await teacher
      .locator("select option", { hasText: title })
      .first()
      .getAttribute("value");
    await teacher.getByTestId("send-paper").selectOption(paperValue);
    await teacher.getByTestId("send-class").selectOption({ index: 1 });
    await teacher.getByRole("button", { name: "Send" }).click();
    await teacher.getByText(/Sent to \d+ student/).waitFor({ timeout: 20_000 });
  });

  const studentState = await signInMember(browser, base, PEOPLE.student);
  const studentContext = await browser.newContext({
    baseURL: base.origin,
    storageState: studentState,
  });
  const student = await studentContext.newPage();
  globalThis.proofPage = student;

  await step("the bell shows the open paper, and its button opens the Exams room", async () => {
    await student.goto("/dashboard");
    await student.getByTestId("home-score").waitFor({ timeout: 30_000 });
    // The bell is drawn twice (the top bar and the wide screen header); only one is on show.
    await student.locator('[data-testid="bell-dot"]:visible').first().waitFor({ timeout: 25_000 });
    await student.locator('[data-testid="bell"]:visible').first().click();
    const list = student.getByTestId("bell-list");
    await list.getByText(new RegExp(`${title} is open now`)).waitFor({ timeout: 20_000 });
    await list.getByRole("button", { name: "Open Exams" }).first().click();
    await student.getByTestId("exams-room").waitFor({ timeout: 20_000 });
  });

  await step("the student sees the paper in Exams and starts it", async () => {
    await student.goto("/dashboard");
    await student.locator('[data-room="papers"]:visible').click();
    const row = student.getByTestId("exam-row").filter({ hasText: title });
    await row.waitFor({ timeout: 25_000 });
    await row.getByRole("button", { name: "Open sitting" }).click();
    await student
      .getByTestId("exam-ready")
      .getByText("A quiet pariksha")
      .waitFor({ timeout: 20_000 });
    await student.getByRole("button", { name: "I am ready to sit" }).click();
    await student.getByTestId("sitting").waitFor({ timeout: 20_000 });
  });

  // The rooms that could help with a paper close (owner, 2026-10-26); the logging rooms, Your data and Leave stay open.
  await step(
    "the desk, blog, study hour and films are locked while the sitting is open, and Mood, Your data and Leave are not",
    async () => {
      for (const room of ["blog", "dhi", "hour", "modules"])
        expect(
          await student.locator(`[data-room="${room}"]:visible`).isDisabled(),
          `the ${room} menu item is not locked during the sitting`,
        );
      for (const room of ["mood", "data"])
        expect(
          !(await student.locator(`[data-room="${room}"]:visible`).isDisabled()),
          `the ${room} menu item is locked during the sitting`,
        );
      expect(
        !(await student.getByTestId("leave").isDisabled()),
        "Leave is locked during the sitting",
      );
      await student.getByText("Exam is going on").first().waitFor({ timeout: 10_000 });
    },
  );

  await step("the student asks for a hint, which helps and does not name the answer", async () => {
    await student.getByTestId("hint-button-0").click();
    await student.getByTestId("hint-0").filter({ hasText: /\w/ }).waitFor({ timeout: 15_000 });
    const text = await student.getByTestId("hint-0").innerText();
    expect(text.includes("Share four things equally."), "the hint text did not show");
    expect(!/\btwo\b/i.test(text), "the hint names the right option");
    // The hint is a side panel; closing it goes back to the question.
    await student.keyboard.press("Escape");
    await student.getByTestId("hint-0").waitFor({ state: "detached", timeout: 10_000 });
  });

  await step(
    "the student answers both questions, and what was typed survives a reload",
    async () => {
      // The radio itself is visually hidden inside its big option card, so the card (its label) is what the student presses.
      await student
        .locator("label")
        .filter({ has: student.getByLabel("two") })
        .click();
      await student.waitForFunction(
        () =>
          document
            .querySelector('input[type="radio"]:checked')
            ?.parentElement?.textContent?.includes("two"),
        null,
        { timeout: 15_000 },
      );
      // The long answer is in the Writing lane, and it is kept a few seconds after the student pauses, with no click away from the box.
      await student.getByRole("button", { name: /^Writing/ }).click();
      await student.getByLabel("Tell a short story.").fill(story);
      await student.waitForTimeout(6_000);
      await student.reload();
      await student.locator('[data-room="papers"]:visible').click();
      await student.getByRole("button", { name: "Continue sitting" }).first().click();
      await student.getByTestId("sitting").waitFor({ timeout: 20_000 });
      expect(
        await student.getByLabel("two").isChecked(),
        "the saved choice did not come back after a reload",
      );
      await student.getByRole("button", { name: /^Writing/ }).click();
      expect(
        (await student.getByLabel("Tell a short story.").inputValue()) === story,
        "the typed answer did not come back after a reload",
      );
    },
  );

  await step("the student submits the paper and it shows as submitted", async () => {
    await student.getByTestId("sitting-submit").click();
    await student
      .getByTestId("sitting-confirm")
      .getByText("Good sitting.")
      .waitFor({ timeout: 10_000 });
    await student.getByTestId("sitting-offer").click();
    const row = student.getByTestId("exam-row").filter({ hasText: title });
    await row.getByText("Submitted").waitFor({ timeout: 20_000 });
    expect(
      !(await student.locator('[data-room="blog"]:visible').isDisabled()),
      "the house stayed locked after submitting",
    );
  });

  await step(
    "the teacher reads the student's answers, marks the long one and confirms",
    async () => {
      await teacher.getByTestId("marking-refresh").click();
      const attempt = teacher
        .getByTestId("marking-attempt")
        .filter({ hasText: PEOPLE.student.name });
      await attempt.getByText(story).waitFor({ timeout: 25_000 });
      expect(
        (await attempt.innerText()).includes("two (right)"),
        "the multiple choice answer was not shown with its result",
      );
      await attempt.getByLabel(/Marks for question 2/).fill("7");
      await attempt.getByLabel("Remarks").fill("Good plot.");
      await attempt.getByRole("button", { name: "Save marks" }).click();
      await attempt
        .getByRole("button", { name: "Confirm mark for the student" })
        .waitFor({ timeout: 20_000 });
      await attempt.getByRole("button", { name: "Confirm mark for the student" }).click();
      await teacher
        .getByTestId("marking-attempt")
        .filter({ hasText: PEOPLE.student.name })
        .getByText(/Confirmed/)
        .waitFor({ timeout: 20_000 });
    },
  );

  await step("the student sees the mark and accepts the feedback once", async () => {
    await student.reload();
    await student.locator('[data-room="papers"]:visible').click();
    const row = student.getByTestId("exam-row").filter({ hasText: title });
    await row.getByTestId("exam-mark").waitFor({ timeout: 25_000 });
    expect(
      (await row.getByTestId("exam-mark").innerText()).includes("Mark 8 of 11"),
      "the mark is not the multiple choice point plus the 7 marks",
    );
    await row.getByTestId("exam-accept").click();
    await row.getByTestId("exam-accepted").waitFor({ timeout: 20_000 });
    expect(
      (await row.getByTestId("exam-accept").count()) === 0,
      "the accept button stayed after accepting",
    );
  });

  await step(
    "the institute admin sees the confirmed mark and remarks of the class, and no answer",
    async () => {
      const adminState = await signInMember(browser, base, PEOPLE.admin);
      const adminContext = await browser.newContext({
        baseURL: base.origin,
        storageState: adminState,
      });
      const admin = await adminContext.newPage();
      try {
        await admin.goto("/staff");
        await admin.locator('[data-room="results"]:visible').click();
        await admin.getByTestId("results-class").waitFor({ timeout: 20_000 });
        await admin.getByTestId("results-class").selectOption({ index: 1 });
        const entry = admin.getByTestId("result-student").filter({ hasText: PEOPLE.student.name });
        await entry.getByText(new RegExp(`${title}: 8 of 11`)).waitFor({ timeout: 25_000 });
        expect((await entry.innerText()).includes("Good plot."), "the remarks were not shown");
        expect(
          !(await admin.locator("body").innerText()).includes(story),
          "an answer was shown to the institute admin",
        );
      } finally {
        await adminContext.close();
      }
    },
  );

  await step("the student posts to the blog and it waits for a teacher", async () => {
    await student.locator('[data-room="blog"]:visible').click();
    await student.getByTestId("blog-write").click();
    await student.getByTestId("blog-form").waitFor({ timeout: 20_000 });
    await student.getByLabel("Title").fill(post);
    // The body is a small editor: bold is turned on with the toolbar, then off again.
    await student.getByRole("textbox", { name: "Body" }).click();
    await student.getByRole("button", { name: "Bold" }).click();
    await student.keyboard.type("Hello");
    await student.getByRole("button", { name: "Bold" }).click();
    await student.keyboard.type(" class");
    // A picture is chosen, shown as a preview, and sent with the post.
    await student
      .getByTestId("blog-photo")
      .setInputFiles({
        name: "proof.png",
        mimeType: "image/png",
        buffer: Buffer.from(TINY_PNG, "base64"),
      });
    await student.getByTestId("blog-photo-preview").waitFor({ timeout: 20_000 });
    await student.getByRole("button", { name: "Put it in the house" }).click();
    await student.getByText("Your post is in").waitFor({ timeout: 20_000 });
    const card = student.getByTestId("blog-post").filter({ hasText: post });
    await card.waitFor({ timeout: 20_000 });
    expect(
      (await card.innerText()).includes("Waiting for a teacher"),
      "the new post does not say it waits",
    );
    await card.getByTestId("blog-post-photo").waitFor({ timeout: 20_000 });
    // Photos load when their card comes into view, so the card is brought into view and the photo given time to arrive.
    await photoLoaded(card);
    expect(
      await card
        .getByTestId("blog-post-photo")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      "the author's own photo did not load",
    );
  });

  await step(
    "the teacher approves the post in Reviews, and the student sees it shared",
    async () => {
      await teacher.locator('[data-room="papers"]:visible').click();
      const reviews = teacher.getByTestId("reviews");
      await reviews.getByText(post).waitFor({ timeout: 25_000 });
      await reviews
        .locator("div", { hasText: post })
        .getByTestId("review-photo")
        .first()
        .waitFor({ timeout: 20_000 });
      await reviews
        .locator("div", { hasText: post })
        .getByRole("button", { name: "Approve" })
        .first()
        .click();
      await student.reload();
      await student.locator('[data-room="blog"]:visible').click();
      const card = student.getByTestId("blog-post").filter({ hasText: post });
      await card.getByText("Shared with your class").waitFor({ timeout: 25_000 });
      await photoLoaded(card);
      expect(
        await card
          .getByTestId("blog-post-photo")
          .evaluate((img) => img.complete && img.naturalWidth > 0),
        "the photo is gone after the approval",
      );
      expect((await card.locator("b").count()) > 0, "the bold markup in the body was lost");
    },
  );

  await studentContext.close();
  await teacherContext.close();
} finally {
  await browser.close();
}

console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
