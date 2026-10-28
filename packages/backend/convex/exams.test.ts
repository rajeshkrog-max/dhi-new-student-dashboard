// The exams room, the student's sitting (spec house/0012). Each test names the criterion it covers. Time is fixed and moved with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T10:00:00+05:30");
const HOUR = 60 * 60 * 1000;
const OPENS = NOW + HOUR;
const DUE = NOW + 2 * HOUR;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const mcq = { kind: "mcq" as const, subject: "Maths", topic: "Fractions", text: "What is half of four?", options: ["one", "two", "three"], rightOption: 1, tags: ["misread", null, "concept"] };
const long = { kind: "long" as const, subject: "English", topic: "Story", text: "Tell a short story.", maxMarks: 10, rubric: "Plot" };

async function world(hinted = false) {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, s2]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  // A hinted paper gives each question a hint that only helps a student think.
  const questions = hinted ? [{ ...mcq, hint: "Half means sharing four things equally." }, { ...long, hint: "Start with who, then what happened." }] : [mcq, long];
  const paperId = await teacher.as.mutation(api.papers.create, { title: "Term test", questions });
  await teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: a1 }, opensAt: OPENS, dueAt: DUE });
  const attemptOf = async (memberId: typeof s.memberId): Promise<Doc<"paperAttempts">> =>
    (await t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).collect()))[0];
  return { t, teacher, s, s2, attemptOf };
}

describe("the exams room, the sitting", () => {
  test("covers AC-1: a paper opens only inside its window", async () => {
    const { s, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    expect(await refusal(s.as.mutation(api.exams.start, { attemptId: attempt._id }))).toBe("not_open");
    vi.setSystemTime(OPENS + 1000);
    await s.as.mutation(api.exams.start, { attemptId: attempt._id });
    expect((await s.as.query(api.exams.questions, { attemptId: attempt._id })).items).toHaveLength(2);
  });

  test("covers AC-4: the sitting's questions hold no right answer and no tag", async () => {
    const { s, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    vi.setSystemTime(OPENS + 1000);
    await s.as.mutation(api.exams.start, { attemptId: attempt._id });
    const text = JSON.stringify(await s.as.query(api.exams.questions, { attemptId: attempt._id }));
    expect(text).not.toContain("rightOption");
    expect(text).not.toContain("misread");
  });

  test("covers AC-2: answers are saved as the student goes and are still there after leaving and coming back", async () => {
    const { s, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    vi.setSystemTime(OPENS + 1000);
    await s.as.mutation(api.exams.start, { attemptId: attempt._id });
    await s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice: 1 });
    await s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 1, text: "Once upon a time." });
    const back = await s.as.query(api.exams.questions, { attemptId: attempt._id });
    expect(back.answers).toHaveLength(2);
    expect(back.answers.find((a) => a.question === 0)?.choice).toBe(1);
  });

  test("covers AC-2: a choice that is not an option is refused", async () => {
    const { s, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    vi.setSystemTime(OPENS + 1000);
    await s.as.mutation(api.exams.start, { attemptId: attempt._id });
    expect(await refusal(s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice: 7 }))).toBe("bad_choice");
  });

  test("covers AC-6: a submitted attempt cannot be changed, and the multiple choice score is fixed at submission", async () => {
    const { s, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    vi.setSystemTime(OPENS + 1000);
    await s.as.mutation(api.exams.start, { attemptId: attempt._id });
    await s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice: 1 });
    await s.as.mutation(api.exams.submit, { attemptId: attempt._id });
    expect(await refusal(s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice: 0 }))).toBe("closed");
    expect(await refusal(s.as.mutation(api.exams.submit, { attemptId: attempt._id }))).toBe("closed");
    const after = await attemptOf(s.memberId);
    expect(after.status).toBe("submitted");
    expect(after.mcqCorrect).toBe(1);
    expect(after.missed).toBe(false);
  });

  test("covers AC-3: when the window closes the answers are submitted automatically, and nothing is accepted after", async () => {
    const { s, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    vi.setSystemTime(OPENS + 1000);
    await s.as.mutation(api.exams.start, { attemptId: attempt._id });
    await s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice: 1 });
    vi.setSystemTime(DUE + 1000);
    expect(await refusal(s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 1, text: "late" }))).toBe("closed");
    const after = await attemptOf(s.memberId);
    expect(after.status).toBe("submitted");
    expect(after.autoSubmitted).toBe(true);
    expect(after.mcqCorrect).toBe(1);
    expect(after.missed).toBe(false);
  });

  test("covers AC-5: a window that closes with nothing submitted is one miss, and the empty attempt is kept", async () => {
    const { s, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    vi.setSystemTime(OPENS + 1000);
    await s.as.mutation(api.exams.start, { attemptId: attempt._id });
    vi.setSystemTime(DUE + 1000);
    expect(await refusal(s.as.mutation(api.exams.submit, { attemptId: attempt._id }))).toBe("closed");
    const after = await attemptOf(s.memberId);
    expect(after.missed).toBe(true);
    expect(after.status).toBe("submitted");
  });

  test("covers AC-5: a student who never opened a paper gets the miss when the window closes", async () => {
    const { s, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    vi.setSystemTime(DUE + 1000);
    expect(await refusal(s.as.mutation(api.exams.start, { attemptId: attempt._id }))).toBe("closed");
    const after = await attemptOf(s.memberId);
    expect(after.missed).toBe(true);
  });

  test("covers AC-7: another student's attempt is not found", async () => {
    const { s, s2, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    vi.setSystemTime(OPENS + 1000);
    expect(await refusal(s2.as.mutation(api.exams.start, { attemptId: attempt._id }))).toBe("not_found");
  });
});

describe("hints, events, the close sweep and the feedback (spec house/0012)", () => {
  const eventsOf = async (w: Awaited<ReturnType<typeof world>>, type: string) =>
    (await w.t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.type === type);
  const open = async (w: Awaited<ReturnType<typeof world>>, who: Awaited<ReturnType<typeof world>>["s"]) => {
    const attempt = await w.attemptOf(who.memberId);
    vi.setSystemTime(OPENS + 1000);
    await who.as.mutation(api.exams.start, { attemptId: attempt._id });
    return attempt;
  };

  test("covers AC-4: a hint shows only when asked for, only in an open sitting, and the sitting's questions never hold the hint text", async () => {
    const w = await world(true);
    const attempt = await w.attemptOf(w.s.memberId);
    expect(await refusal(w.s.as.mutation(api.exams.hint, { attemptId: attempt._id, question: 0 }))).toBe("not_open");
    await open(w, w.s);
    const sitting = await w.s.as.query(api.exams.questions, { attemptId: attempt._id });
    expect(sitting.items.map((i) => i.hasHint)).toEqual([true, true]);
    expect(JSON.stringify(sitting)).not.toContain("sharing four things equally");
    expect(await w.s.as.mutation(api.exams.hint, { attemptId: attempt._id, question: 0 })).toEqual({ ok: true, text: "Half means sharing four things equally." });
    vi.setSystemTime(DUE + 1000);
    expect(await refusal(w.s.as.mutation(api.exams.hint, { attemptId: attempt._id, question: 1 }))).toBe("closed");
  });

  test("covers AC-4: a question with no hint says so, and another student's attempt is not found", async () => {
    const w = await world();
    const attempt = await open(w, w.s);
    expect((await w.s.as.query(api.exams.questions, { attemptId: attempt._id })).items.map((i) => i.hasHint)).toEqual([false, false]);
    expect(await refusal(w.s.as.mutation(api.exams.hint, { attemptId: attempt._id, question: 0 }))).toBe("no_hint");
    expect(await refusal(w.s2.as.mutation(api.exams.hint, { attemptId: attempt._id, question: 0 }))).toBe("not_found");
  });

  test("covers AC-4: a hint that gives the right option away, or is too long, cannot be saved on a paper", async () => {
    const w = await world();
    const make = (hint: string, base: typeof mcq | typeof long = mcq) => w.teacher.as.mutation(api.papers.create, { title: "Hint test", questions: [{ ...base, hint }] });
    // The right option of the multiple choice question is "two" (index 1, so letter B and place 2).
    expect(await refusal(make("The answer is two, count again."))).toBe("bad_hint");
    expect(await refusal(make("It is option B."))).toBe("bad_hint");
    expect(await refusal(make("Choose (b) because it is half."))).toBe("bad_hint");
    expect(await refusal(make("Answer 2 is the one."))).toBe("bad_hint");
    expect(await refusal(make("x".repeat(301)))).toBe("bad_hint");
    // A hint that only helps, a word that merely starts like an option, and a blank hint (which counts as none) are fine.
    await make("Share four things between friends equally.");
    await make("Look at the second line of the story again, twice if needed.");
    await make("   ");
    // The long question has no right option, so any hint of 300 characters or less is fine.
    await make("Say who, then what happened.", long);
  });

  test("covers AC-3: a submission writes one event of counts, and an empty one writes a miss", async () => {
    const w = await world(true);
    const attempt = await open(w, w.s);
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice: 1 });
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 1, text: "Once upon a time." });
    await w.s.as.mutation(api.exams.hint, { attemptId: attempt._id, question: 1 });
    await w.s.as.mutation(api.exams.submit, { attemptId: attempt._id });
    const done = await eventsOf(w, "exams.submitted");
    expect(done).toHaveLength(1);
    // Version 3 (house spec 0030): why answers went wrong (none here) and the answer time when it was kept.
    expect(done[0].payload).toMatchObject({ auto: false, mcqTried: 1, mcqRight: 1, longDone: 1, hints: 1, topics: [expect.any(String)], topicTried: [1], topicRight: [1], wrongMisread: 0, wrongCareless: 0, wrongConcept: 0 });
    expect(await eventsOf(w, "exams.missed")).toHaveLength(0);

    const other = await open(w, w.s2);
    await w.s2.as.mutation(api.exams.answer, { attemptId: other._id, question: 1, text: "   " });
    await w.s2.as.mutation(api.exams.submit, { attemptId: other._id });
    expect(await eventsOf(w, "exams.missed")).toHaveLength(1);
    expect((await w.attemptOf(w.s2.memberId)).missed).toBe(true);
  });

  test("covers AC-3, AC-5: the sweep closes a sitting nobody touched, once, and a second run changes nothing", async () => {
    const w = await world();
    const opened = await open(w, w.s);
    await w.s.as.mutation(api.exams.answer, { attemptId: opened._id, question: 0, choice: 0 });
    // s2 never opens the paper. Nothing closes before the due time.
    vi.setSystemTime(DUE - 1000);
    expect(await w.t.mutation(internal.exams.sweep, {})).toBe(0);
    vi.setSystemTime(DUE + 1000);
    expect(await w.t.mutation(internal.exams.sweep, {})).toBe(2);
    expect(await w.t.mutation(internal.exams.sweep, {})).toBe(0);
    const mine = await w.attemptOf(w.s.memberId);
    expect(mine).toMatchObject({ status: "submitted", autoSubmitted: true, missed: false, mcqCorrect: 0 });
    expect(await w.attemptOf(w.s2.memberId)).toMatchObject({ status: "submitted", autoSubmitted: true, missed: true });
    const done = await eventsOf(w, "exams.submitted");
    expect(done).toHaveLength(1);
    expect(done[0].payload).toMatchObject({ auto: true, mcqTried: 1, mcqRight: 0, longDone: 0, hints: 0, topics: [expect.any(String)], topicTried: [1], topicRight: [0] });
    // The one wrong answer has one reason (house spec 0030).
    const why = done[0].payload as { wrongMisread: number; wrongCareless: number; wrongConcept: number };
    expect(why.wrongMisread + why.wrongCareless + why.wrongConcept).toBe(1);
    expect(done[0].occurredAt).toBe(DUE);
    expect(await eventsOf(w, "exams.missed")).toHaveLength(1);
  });

  test("covers AC-5: a student who withdrew consent still has the sitting closed by the sweep, without an event", async () => {
    const w = await world();
    await w.s2.as.mutation(api.consent.withdraw, {});
    vi.setSystemTime(DUE + 1000);
    expect(await w.t.mutation(internal.exams.sweep, {})).toBe(2);
    expect((await w.attemptOf(w.s2.memberId)).status).toBe("submitted");
    // Only the first student's miss is in the log: the withdrawn student has no event, and the sweep still carried on past them.
    expect(await eventsOf(w, "exams.missed")).toHaveLength(1);
    expect((await w.attemptOf(w.s.memberId)).status).toBe("submitted");
  });

  test("covers AC-8: accepting the feedback is recorded once, only after the teacher confirmed the mark", async () => {
    const w = await world();
    const attempt = await open(w, w.s);
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 1, text: "A story." });
    await w.s.as.mutation(api.exams.submit, { attemptId: attempt._id });
    expect(await refusal(w.s.as.mutation(api.exams.acceptFeedback, { attemptId: attempt._id }))).toBe("not_confirmed");
    await w.teacher.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 1, mark: 7 }], remarks: "Good plot." });
    await w.teacher.as.mutation(api.papers.confirm, { attemptId: attempt._id });
    expect((await w.s.as.query(api.papers.mine, {}))[0].accepted).toBe(false);
    vi.setSystemTime(OPENS + 5000);
    expect(await w.s.as.mutation(api.exams.acceptFeedback, { attemptId: attempt._id })).toEqual({ ok: true });
    const first = (await w.attemptOf(w.s.memberId)).acceptedAt;
    expect(first).toBe(OPENS + 5000);
    vi.setSystemTime(OPENS + 9000);
    expect(await w.s.as.mutation(api.exams.acceptFeedback, { attemptId: attempt._id })).toEqual({ ok: true });
    expect((await w.attemptOf(w.s.memberId)).acceptedAt).toBe(first);
    expect((await w.s.as.query(api.papers.mine, {}))[0].accepted).toBe(true);
    expect(await refusal(w.s2.as.mutation(api.exams.acceptFeedback, { attemptId: attempt._id }))).toBe("not_found");
  });

  test("covers AC-2: a student who saves answers without pause is slowed down after the allowance, and a refusal costs nothing already saved", async () => {
    const w = await world();
    const attempt = await open(w, w.s);
    let refused = "";
    for (let i = 0; i < 320 && refused === ""; i += 1) {
      const r = await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice: i % 3 });
      if (!r.ok) refused = r.code;
    }
    expect(refused).toBe("slow_down");
    // The answers saved before the refusal are still there, and the sweep still closes the sitting.
    expect((await w.attemptOf(w.s.memberId)).answers).toHaveLength(1);
    vi.setSystemTime(DUE + 1000);
    expect(await w.t.mutation(internal.exams.sweep, {})).toBe(2);
  });

  test("covers AC-5: the teacher's view shows which attempts were missed", async () => {
    const w = await world();
    const opened = await open(w, w.s);
    await w.s.as.mutation(api.exams.answer, { attemptId: opened._id, question: 0, choice: 1 });
    vi.setSystemTime(DUE + 1000);
    await w.t.mutation(internal.exams.sweep, {});
    const paperId = (await w.t.run((ctx) => ctx.db.query("papers").first()))!._id;
    const view = await w.teacher.as.mutation(api.papers.openForTeacher, { paperId });
    expect(view.attempts.map((a) => a.missed).sort()).toEqual([false, true]);
  });
});

// The exam lock on the server (owner, 2026-10-26): from Start until the student hands in, every other room refuses; Your data and the frame do not.
describe("the exam lock on the server (AC-7)", () => {
  test("an open sitting closes every other room, keeps Your data and the frame open, and lifts on submit; a classmate is not locked", async () => {
    const { s, s2, attemptOf } = await world();
    const attempt = await attemptOf(s.memberId);
    vi.setSystemTime(OPENS + 1000);
    expect(await s.as.query(api.exams.sitting, {})).toEqual({ open: false });
    await s.as.mutation(api.exams.start, { attemptId: attempt._id });
    expect(await s.as.query(api.exams.sitting, {})).toEqual({ open: true });
    // The rooms that could help with a paper are closed (owner, 2026-10-26); the logging rooms, Progress and leaving a seat stay open.
    const rooms: Record<string, () => Promise<unknown>> = {
      "blog.list": () => s.as.query(api.blog.list, {}),
      "films.list": () => s.as.query(api.films.list, {}),
      "studyHour.current": () => s.as.query(api.studyHour.current, {}),
      "studyHour.messages": () => s.as.query(api.studyHour.messages, {}),
    };
    for (const [name, call] of Object.entries(rooms)) expect(await refusal(call()), name).toBe("exam_open");
    for (const [name, call] of Object.entries({
      "moods.save": () => s.as.mutation(api.moods.save, { mood: "happy", note: "" }),
      "sleep.recent": () => s.as.query(api.sleep.recent, {}),
      "meals.day": () => s.as.query(api.meals.day, {}),
      "habits.list": () => s.as.query(api.habits.list, {}),
      "brain.report": () => s.as.query(api.brain.report, {}),
      "studyHour.leave": () => s.as.mutation(api.studyHour.leave, {}),
    })) expect(await refusal(call()), `${name} stays open`).not.toBe("exam_open");
    expect(await refusal(s.as.query(api.members.me, {}))).toBe("ok");
    expect(await refusal(s.as.mutation(api.dataRights.exportMine, {}))).toBe("ok");
    expect(await refusal(s.as.query(api.sharing.get, {}))).toBe("ok");
    expect(await refusal(s2.as.query(api.blog.list, {}))).toBe("ok");
    await s.as.mutation(api.exams.submit, { attemptId: attempt._id });
    expect(await s.as.query(api.exams.sitting, {})).toEqual({ open: false });
    for (const [name, call] of Object.entries(rooms)) expect(await refusal(call()), `${name} after submit`).toBe("ok");
  });
});

