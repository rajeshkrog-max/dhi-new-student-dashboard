// Papers and exams when a class is paused, the duplicate marks of a long answer, and the hint rule (specs house/0012 and house/0021). Each test names the
// criterion it covers. Time is fixed and moved with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { hintGivesAnswer } from "./papersRules";
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
const long2 = { ...long, text: "Tell another short story." };

async function world() {
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
  const paperId = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [mcq, long, long2] });
  const send = () => teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: a1 }, opensAt: OPENS, dueAt: DUE });
  const attemptOf = async (memberId: typeof s.memberId): Promise<Doc<"paperAttempts">> =>
    (await t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).collect()))[0];
  const examEvents = (type: string) => t.run(async (ctx) => (await ctx.db.query("events").collect()).filter((e) => e.type === type));
  return { t, A, a1, teacher, s, s2, paperId, send, attemptOf, examEvents };
}

describe("a paused class and papers (house/0021)", () => {
  test("covers AC-1: a paused class cannot be sent a paper, as a class or as one student, and a resumed class can", async () => {
    const w = await world();
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    expect(await refusal(w.send())).toBe("class_paused");
    expect(await refusal(w.teacher.as.mutation(api.papers.send, { paperId: w.paperId, target: { kind: "student", memberId: w.s.memberId }, opensAt: OPENS, dueAt: DUE }))).toBe("class_paused");
    expect(await w.attemptOf(w.s.memberId)).toBeUndefined();
    await w.A.admin.as.mutation(api.classes.resume, { classId: w.a1 });
    expect((await w.send()).made).toBe(2);
  });

  test("covers AC-1: a window that is too short, too long or already over is refused as bad_window", async () => {
    const w = await world();
    const send = (opensAt: number, dueAt: number) => w.teacher.as.mutation(api.papers.send, { paperId: w.paperId, target: { kind: "class", classId: w.a1 }, opensAt, dueAt });
    expect(await refusal(send(OPENS, OPENS + 1000))).toBe("bad_window");
    expect(await refusal(send(OPENS, OPENS + 400 * 24 * HOUR))).toBe("bad_window");
    expect(await refusal(send(NOW - 3 * HOUR, NOW - HOUR))).toBe("bad_window");
    expect(await refusal(send(Number.NaN, DUE))).toBe("bad_window");
    expect(await w.attemptOf(w.s.memberId)).toBeUndefined();
  });

  test("covers AC-2: a window that ends while the class is paused closes as excused, with no miss and no event, and the teacher cannot mark it", async () => {
    const w = await world();
    await w.send();
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    vi.setSystemTime(DUE + 60 * 1000);
    await w.t.mutation(internal.exams.sweep, {});
    for (const p of [w.s, w.s2]) {
      const attempt = await w.attemptOf(p.memberId);
      expect(attempt).toMatchObject({ status: "submitted", excused: true, missed: false, autoSubmitted: true });
      expect(await refusal(w.teacher.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 1, mark: 5 }], remarks: "" }))).toBe("not_submitted");
    }
    expect(await w.examEvents("exams.missed")).toHaveLength(0);
    expect(await w.examEvents("exams.submitted")).toHaveLength(0);
  });

  test("covers AC-2: a sweep that runs after the class was resumed still excuses a window that ended during the pause", async () => {
    const w = await world();
    await w.send();
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    vi.setSystemTime(DUE + 5 * 60 * 1000);
    await w.A.admin.as.mutation(api.classes.resume, { classId: w.a1 });
    vi.setSystemTime(DUE + 10 * 60 * 1000);
    await w.t.mutation(internal.exams.sweep, {});
    expect(await w.attemptOf(w.s.memberId)).toMatchObject({ status: "submitted", excused: true, missed: false });
    expect(await w.examEvents("exams.missed")).toHaveLength(0);
  });

  test("covers AC-2: a window that ended before the pause began is a miss", async () => {
    const w = await world();
    await w.send();
    vi.setSystemTime(DUE + 60 * 1000);
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    await w.t.mutation(internal.exams.sweep, {});
    expect((await w.attemptOf(w.s.memberId)).excused).not.toBe(true);
    expect(await w.examEvents("exams.missed")).toHaveLength(2);
  });

  test("covers AC-2: a long answer that was typed and then cleared holds no answer, so a paused window is still excused", async () => {
    const w = await world();
    await w.send();
    const attempt = await w.attemptOf(w.s.memberId);
    vi.setSystemTime(OPENS + 1000);
    await w.s.as.mutation(api.exams.start, { attemptId: attempt._id });
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 1, text: "" });
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    vi.setSystemTime(DUE + 60 * 1000);
    await w.t.mutation(internal.exams.sweep, {});
    expect(await w.attemptOf(w.s.memberId)).toMatchObject({ status: "submitted", excused: true, missed: false });
    expect(await w.examEvents("exams.missed")).toHaveLength(0);
  });

  test("covers AC-2: the same window with the class not paused is a miss with an event", async () => {
    const w = await world();
    await w.send();
    vi.setSystemTime(DUE + 60 * 1000);
    await w.t.mutation(internal.exams.sweep, {});
    expect((await w.attemptOf(w.s.memberId)).excused).not.toBe(true);
    expect(await w.examEvents("exams.missed")).toHaveLength(2);
  });
});

describe("marking a long answer (house/0012)", () => {
  async function submitted() {
    const w = await world();
    await w.send();
    const attempt = await w.attemptOf(w.s.memberId);
    vi.setSystemTime(OPENS + 1000);
    await w.s.as.mutation(api.exams.start, { attemptId: attempt._id });
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 1, text: "A story." });
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 2, text: "Another." });
    await w.s.as.mutation(api.exams.submit, { attemptId: attempt._id });
    return { w, attempt };
  }

  test("covers AC-5: the same question marked twice is refused, so the marks are never added twice", async () => {
    const { w, attempt } = await submitted();
    const mark = (marks: { question: number; mark: number }[]) => w.teacher.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks, remarks: "" });
    expect(await refusal(mark([{ question: 1, mark: 6 }, { question: 1, mark: 6 }]))).toBe("bad_mark");
    expect((await w.attemptOf(w.s.memberId)).status).toBe("submitted");
    expect(await mark([{ question: 1, mark: 6 }, { question: 2, mark: 4 }])).toEqual({ ok: true });
    expect((await w.attemptOf(w.s.memberId)).marks).toHaveLength(2);
  });
});

describe("a hint that gives the answer away (house/0012)", () => {
  const options = ["one", "two", "three"];
  const gives = (hint: string, opts: readonly string[] = options, right = 1) => hintGivesAnswer(hint, opts, right);

  test("covers AC-3: it finds the right option written out, a letter, a number, and a mark-only option", () => {
    expect(gives("Think about two halves.")).toBe(true);
    expect(gives("It is option B")).toBe(true);
    expect(gives("option no. 2")).toBe(true);
    expect(gives("choice (c)")).toBe(true);
    expect(gives("It is not option B, it is the other. The answer's B")).toBe(true);
    expect(gives("The correct one is (2)")).toBe(true);
    expect(gives("Look at the sign: +", ["-", "+", "x"], 1)).toBe(true);
    expect(gives("Look at the sign", ["-", "+", "x"], 1)).toBe(false);
  });

  test("covers AC-3: it leaves a hint that only helps a student think, including 'answer a simpler question'", () => {
    expect(gives("Half means sharing four things equally.")).toBe(false);
    expect(gives("First answer a simpler question: what is half of eight?")).toBe(false);
    expect(gives("Start with who, then what happened.")).toBe(false);
    expect(gives("")).toBe(false);
  });

  // Review of 2026-10-26. The check stays a guard on the teacher's own text, not a proof (spec 0012 AC-4 is noted in the review file).
  test("it finds the right option split by a hyphen or a space, and a small letter after 'answer is' at the end of a sentence", () => {
    const science = ["Respiration", "Photosynthesis", "Digestion"];
    expect(gives("Think of photo-synthesis.", science, 1)).toBe(true);
    expect(gives("It is photo synthesis", science, 1)).toBe(true);
    expect(gives("the answer is b.")).toBe(true);
    expect(gives("the answer is a simple idea about light")).toBe(false);
    expect(gives("Think about what leaves do in sunlight.", science, 1)).toBe(false);
  });
});
