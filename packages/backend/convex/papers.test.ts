// The papers room, teacher side (spec house/0011). Each test names the criterion it covers. Time is fixed with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { examRoom } from "./paperRoom";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T10:00:00+05:30");
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const mcq = {
  kind: "mcq" as const,
  subject: "Maths",
  topic: "Fractions",
  text: "What is half of four?",
  options: ["one", "two", "three"],
  rightOption: 1,
  tags: ["misread", null, "concept"],
};
const long = { kind: "long" as const, subject: "English", topic: "Story", text: "Tell a short story.", maxMarks: 10, rubric: "Plot, voice, ending" };

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const other = await makeTeacher(t, A.admin, "other@alpha.test", [a2]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  const s3 = await makeStudent(t, A.admin, a2, "s3@alpha.test", false);
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const betaTeacher = await makeTeacher(t, B.admin, "teacher@beta.test", [b1]);
  await t.run(async (ctx) => {
    for (const p of [s, s2, s3]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, A, a1, a2, teacher, other, s, s2, s3, B, b1, betaTeacher };
}

const window = { opensAt: NOW - HOUR, dueAt: NOW + HOUR };

describe("the papers room, teacher side", () => {
  test("covers AC-1: a teacher builds a paper with multiple choice and long questions", async () => {
    const { teacher } = await world();
    const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [mcq, long] });
    expect(typeof id).toBe("string");
  });

  test("covers AC-1: a question with no right option, or a wrong tag missing, is refused as bad_question", async () => {
    const { teacher } = await world();
    expect(await refusal(teacher.as.mutation(api.papers.create, { title: "X", questions: [{ ...mcq, rightOption: 9 }] }))).toBe("bad_question");
    expect(await refusal(teacher.as.mutation(api.papers.create, { title: "X", questions: [{ ...mcq, tags: ["nope", null, null] }] }))).toBe("bad_question");
    expect(await refusal(teacher.as.mutation(api.papers.create, { title: "X", questions: [{ ...mcq, tags: [null, "misread", null] }] }))).toBe("bad_question");
    expect(await refusal(teacher.as.mutation(api.papers.create, { title: "X", questions: [{ ...long, maxMarks: 0 }] }))).toBe("bad_question");
  });

  test("covers AC-1: a student cannot build a paper", async () => {
    const { s } = await world();
    expect(await refusal(s.as.mutation(api.papers.create, { title: "X", questions: [long] }))).toBe("forbidden");
  });

  test("covers AC-2: the right answers and tags are never in a student's list", async () => {
    const { teacher, a1, s } = await world();
    const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [mcq, long] });
    await teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a1 }, ...window });
    const text = JSON.stringify(await s.as.query(api.papers.mine, {}));
    expect(text).not.toContain("rightOption");
    expect(text).not.toContain("misread");
    expect(text).not.toContain("What is half of four");
  });

  test("covers AC-3: a class send makes one attempt per student of that class, and only that class", async () => {
    const { teacher, a1, s, s2, s3 } = await world();
    const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [long] });
    expect(await teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a1 }, ...window })).toEqual({ ok: true, made: 2 });
    expect((await s.as.query(api.papers.mine, {})).length).toBe(1);
    expect((await s2.as.query(api.papers.mine, {})).length).toBe(1);
    expect(await s3.as.query(api.papers.mine, {})).toEqual([]);
  });

  test("covers AC-3: sending to a class the teacher does not teach is forbidden, and a window must be real", async () => {
    const { teacher, a2, a1 } = await world();
    const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [long] });
    expect(await refusal(teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a2 }, ...window }))).toBe("forbidden");
    expect(await refusal(teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a1 }, opensAt: NOW, dueAt: NOW + 1000 }))).toBe("bad_window");
  });

  test("covers AC-4: a student sees the paper title and the window, and no mark until it is confirmed", async () => {
    const { teacher, a1, s } = await world();
    const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [long] });
    await teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a1 }, ...window });
    const [row] = await s.as.query(api.papers.mine, {});
    expect(row).toMatchObject({ title: "Term test", opensAt: window.opensAt, dueAt: window.dueAt, status: "assigned", mark: null });
  });

  test("covers AC-5: a teacher marks a submitted long answer, and the student sees the mark only after confirmation", async () => {
    const { t, teacher, a1, s } = await world();
    const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [long] });
    await teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a1 }, ...window });
    const [attempt] = await t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", s.memberId)).collect());
    expect(await refusal(teacher.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 0, mark: 7 }], remarks: "x" }))).toBe("not_submitted");
    await t.run((ctx) => ctx.db.patch(attempt._id, { status: "submitted" }));
    await teacher.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 0, mark: 7 }], remarks: "Good ending." });
    expect((await s.as.query(api.papers.mine, {}))[0].mark).toBeNull();
    await teacher.as.mutation(api.papers.confirm, { attemptId: attempt._id });
    expect((await s.as.query(api.papers.mine, {}))[0].mark).toEqual({ total: 7, maxTotal: 10, remarks: "Good ending." });
  });

  test("covers AC-5: a mark above the maximum is refused, and a student cannot mark", async () => {
    const { t, teacher, a1, s } = await world();
    const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [long] });
    await teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a1 }, ...window });
    const [attempt] = await t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", s.memberId)).collect());
    await t.run((ctx) => ctx.db.patch(attempt._id, { status: "submitted" }));
    expect(await refusal(teacher.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 0, mark: 11 }], remarks: "" }))).toBe("bad_mark");
    expect(await refusal(s.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 0, mark: 5 }], remarks: "" }))).toBe("forbidden");
  });

  test("covers AC-7: a teacher of another class or another institute cannot mark or see the paper", async () => {
    const { t, teacher, other, betaTeacher, a1, s } = await world();
    const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [long] });
    await teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a1 }, ...window });
    const [attempt] = await t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", s.memberId)).collect());
    await t.run((ctx) => ctx.db.patch(attempt._id, { status: "submitted" }));
    expect(await refusal(other.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 0, mark: 5 }], remarks: "" }))).toBe("forbidden");
    expect(await refusal(betaTeacher.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 0, mark: 5 }], remarks: "" }))).toBe("forbidden");
    expect(await refusal(other.as.mutation(api.papers.openForTeacher, { paperId: id }))).toBe("forbidden");
  });

  test("covers AC-7 and AC-9: the export holds titles, windows, confirmed marks and the student's own answers, never the right answers, and erase removes the attempts", async () => {
    const { t, teacher, a1, s } = await world();
    const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [mcq, long] });
    await teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a1 }, ...window });
    const page = await t.run((ctx) => examRoom.exporter(ctx, s.memberId, null, 10));
    expect(page.rows).toHaveLength(1);
    expect(Object.keys(page.rows[0] as object).sort()).toEqual(["answers", "dueAt", "opensAt", "paper", "remarks", "status", "total"]);
    expect(JSON.stringify(page.rows)).not.toContain("rightOption");
    await t.run((ctx) => examRoom.eraser(ctx, s.memberId, 10));
    expect(await s.as.query(api.papers.mine, {})).toEqual([]);
  });
});

describe("the papers room, the teacher's look at named results (spec house/0011 and house/0005)", () => {
  async function sitting() {
    const w = await world();
    const id = await w.teacher.as.mutation(api.papers.create, { title: "Term test", questions: [mcq, long] });
    await w.teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: w.a1 }, ...window });
    const attemptOf = async (memberId: typeof w.s.memberId) =>
      (await w.t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).collect()))[0];
    return { ...w, id, attemptOf };
  }
  const looks = async (w: Awaited<ReturnType<typeof sitting>>) => await w.t.run((ctx) => ctx.db.query("viewLog").collect());

  test("covers AC-5: the teacher sees each student's answers to mark them, and each look is recorded once for every student shown", async () => {
    const w = await sitting();
    const attempt = await w.attemptOf(w.s.memberId);
    await w.t.run((ctx) => ctx.db.patch(attempt._id, { status: "submitted", answers: [{ question: 0, choice: 1 }, { question: 1, text: "Once upon a time." }], mcqCorrect: 1 }));
    const view = await w.teacher.as.mutation(api.papers.openForTeacher, { paperId: w.id });
    expect(view.total).toBe(2);
    expect(view.attempts).toHaveLength(2);
    const mine = view.attempts.find((a) => a.attemptId === attempt._id)!;
    expect(mine.answers).toEqual([{ question: 0, choice: 1 }, { question: 1, text: "Once upon a time." }]);
    expect(view.questions.find((q) => q.kind === "long")?.rubric).toBe("Plot, voice, ending");
    const log = await looks(w);
    expect(log).toHaveLength(2);
    expect(log.every((row) => row.kind === "academic" && row.viewerId === w.teacher.memberId)).toBe(true);
    // Opening again is another look, and is recorded again.
    await w.teacher.as.mutation(api.papers.openForTeacher, { paperId: w.id });
    expect(await looks(w)).toHaveLength(4);
  });

  test("covers AC-7: a student who is not in the teacher's classes now, or who withdrew, is not shown and leaves no record", async () => {
    const w = await sitting();
    await w.s2.as.mutation(api.consent.withdraw, {});
    await w.t.run((ctx) => ctx.db.patch(w.s.memberId, { classId: w.a2 }));
    const view = await w.teacher.as.mutation(api.papers.openForTeacher, { paperId: w.id });
    expect(view.attempts).toEqual([]);
    expect(await looks(w)).toHaveLength(0);
  });

  test("covers AC-7: another teacher, a student and an institute admin cannot open the paper's results", async () => {
    const w = await sitting();
    expect(await refusal(w.other.as.mutation(api.papers.openForTeacher, { paperId: w.id }))).toBe("forbidden");
    expect(await refusal(w.s.as.mutation(api.papers.openForTeacher, { paperId: w.id }))).toBe("forbidden");
    expect(await refusal(w.A.admin.as.mutation(api.papers.openForTeacher, { paperId: w.id }))).toBe("forbidden");
    expect(await looks(w)).toHaveLength(0);
  });

  test("covers AC-7: a teacher opening the marking page too often is slowed down", async () => {
    const w = await sitting();
    for (let i = 0; i < 60; i += 1) await w.teacher.as.mutation(api.papers.openForTeacher, { paperId: w.id });
    expect(await refusal(w.teacher.as.mutation(api.papers.openForTeacher, { paperId: w.id }))).toBe("slow_down");
  });
});

describe("the institute admin's preview of a class's results (spec house/0011, AC-7)", () => {
  async function confirmed() {
    const w = await world();
    const id = await w.teacher.as.mutation(api.papers.create, { title: "Term test", questions: [mcq, long] });
    await w.teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: w.a1 }, ...window });
    const [attempt] = await w.t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).collect());
    await w.t.run((ctx) =>
      ctx.db.patch(attempt._id, {
        status: "confirmed",
        mcqCorrect: 1,
        marks: [{ question: 1, mark: 7 }],
        remarks: "Good ending.",
        answers: [{ question: 0, choice: 1 }, { question: 1, text: "A secret story" }],
      }),
    );
    return w;
  }

  test("covers AC-7: the admin sees confirmed marks and remarks for the students of a class, never an answer, and each look is recorded", async () => {
    const w = await confirmed();
    const view = await w.A.admin.as.mutation(api.papers.resultsForClass, { classId: w.a1 });
    expect(view.total).toBe(2);
    expect(view.students.find((s) => s.papers.length > 0)?.papers).toEqual([{ title: "Term test", total: 8, maxTotal: 11, remarks: "Good ending." }]);
    expect(JSON.stringify(view)).not.toMatch(/secret|rightOption|choice/);
    const log = await w.t.run((ctx) => ctx.db.query("viewLog").collect());
    expect(log).toHaveLength(2);
    expect(log.every((row) => row.kind === "academic" && row.viewerRole === "institute_admin")).toBe(true);
  });

  test("covers AC-7: an unconfirmed mark is not shown, and a withdrawn student is left out with no record", async () => {
    const w = await confirmed();
    const [attempt] = await w.t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).collect());
    await w.t.run((ctx) => ctx.db.patch(attempt._id, { status: "marked" }));
    await w.s2.as.mutation(api.consent.withdraw, {});
    const view = await w.A.admin.as.mutation(api.papers.resultsForClass, { classId: w.a1 });
    expect(view.students.map((s) => s.papers.length)).toEqual([0]);
    expect(await w.t.run((ctx) => ctx.db.query("viewLog").collect())).toHaveLength(1);
  });

  test("covers AC-7: only an admin of that institute can open it", async () => {
    const w = await confirmed();
    expect(await refusal(w.B.admin.as.mutation(api.papers.resultsForClass, { classId: w.a1 }))).toBe("forbidden");
    expect(await refusal(w.teacher.as.mutation(api.papers.resultsForClass, { classId: w.a1 }))).toBe("forbidden");
    expect(await refusal(w.s.as.mutation(api.papers.resultsForClass, { classId: w.a1 }))).toBe("forbidden");
    expect(await w.t.run((ctx) => ctx.db.query("viewLog").collect())).toHaveLength(0);
  });
});
