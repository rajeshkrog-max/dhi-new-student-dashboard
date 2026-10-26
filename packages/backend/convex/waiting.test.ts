// What is waiting for a student, for the bell (spec house/0017). Each test names the criterion it covers. Time is fixed with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T12:00:00+05:30");
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const other = await makeStudent(t, A.admin, a1, "other@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, other]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, a1, teacher, s, other };
}

describe("what is waiting", () => {
  test("covers AC-1: a student with nothing to do has nothing waiting", async () => {
    const { s } = await world();
    expect(await s.as.query(api.waiting.mine, {})).toEqual([]);
  });

  test("covers AC-1: an open paper waits until it is submitted, and a confirmed mark waits until the feedback is read", async () => {
    const { teacher, a1, s, other } = await world();
    const paperId = await teacher.as.mutation(api.papers.create, {
      title: "Term test",
      questions: [{ kind: "long", subject: "English", topic: "Story", text: "Tell a story.", maxMarks: 5, rubric: "x" }],
    });
    await teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: a1 }, opensAt: NOW - HOUR, dueAt: NOW + HOUR });
    expect(await s.as.query(api.waiting.mine, {})).toEqual([{ kind: "exam_open", title: "Term test", room: "papers" }]);
    const [{ attemptId }] = await s.as.query(api.papers.mine, {});
    await s.as.mutation(api.exams.start, { attemptId });
    await s.as.mutation(api.exams.answer, { attemptId, question: 0, text: "Once upon a time." });
    await s.as.mutation(api.exams.submit, { attemptId });
    expect(await s.as.query(api.waiting.mine, {})).toEqual([]);
    await teacher.as.mutation(api.papers.markLong, { attemptId, marks: [{ question: 0, mark: 4 }], remarks: "Good." });
    expect(await s.as.query(api.waiting.mine, {})).toEqual([]);
    await teacher.as.mutation(api.papers.confirm, { attemptId });
    expect(await s.as.query(api.waiting.mine, {})).toEqual([{ kind: "mark", title: "Term test", room: "papers" }]);
    await s.as.mutation(api.exams.acceptFeedback, { attemptId });
    expect(await s.as.query(api.waiting.mine, {})).toEqual([]);
    // Another student's paper is theirs alone.
    expect((await other.as.query(api.waiting.mine, {})).map((i) => i.kind)).toEqual(["exam_open"]);
  });

  test("covers AC-1: a feeling card from a stay that ended in the last day waits, and goes after an answer or a skip", async () => {
    const { t, dhi, s } = await world();
    await dhi.as.mutation(api.studyHour.set, { opensAt: NOW - 10 * 60 * 1000, closesAt: NOW + 3 * HOUR });
    await t.run(async (ctx) => {
      const member = await ctx.db.get(s.memberId);
      const hour = (await ctx.db.query("studyHours").first())!;
      await ctx.db.insert("seats", { hourId: hour._id, memberId: s.memberId, instituteId: member!.instituteId!, mode: "live", enteredAt: NOW - 30 * 60 * 1000, lastBeatAt: NOW - 60 * 1000, leftAt: NOW - 60 * 1000, feedbackStatus: "pending" });
    });
    expect(await s.as.query(api.waiting.mine, {})).toEqual([{ kind: "feeling", title: "", room: "hour" }]);
    const card = await s.as.query(api.sessionFeedback.pending, {});
    await s.as.mutation(api.sessionFeedback.skip, { seatId: card!.seatId });
    expect(await s.as.query(api.waiting.mine, {})).toEqual([]);
    // A card older than a day is left alone.
    await t.run(async (ctx) => {
      const member = await ctx.db.get(s.memberId);
      const hour = (await ctx.db.query("studyHours").first())!;
      await ctx.db.insert("seats", { hourId: hour._id, memberId: s.memberId, instituteId: member!.instituteId!, mode: "live", enteredAt: NOW - 30 * HOUR, lastBeatAt: NOW - 29 * HOUR, leftAt: NOW - 29 * HOUR, feedbackStatus: "pending" });
    });
    expect(await s.as.query(api.waiting.mine, {})).toEqual([]);
  });

  test("covers AC-2: only a student has a bell, and a student who withdrew gets nothing", async () => {
    const { teacher, A, dhi, s } = await world();
    for (const p of [teacher, A.admin, dhi]) expect(await refusal(p.as.query(api.waiting.mine, {}))).toBe("forbidden");
    await s.as.mutation(api.consent.withdraw, {});
    expect(await refusal(s.as.query(api.waiting.mine, {}))).toBe("consent_withdrawn");
  });
});
