/// <reference types="vite/client" />
// The school report (house spec 0025). Each test names the criterion it covers. Time is fixed with a fake clock; every person is made up.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T10:00:00+05:30");
const HOUR = 60 * 60 * 1000;
const DAY = "2026-10-20";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const mcq = { kind: "mcq" as const, subject: "Maths", topic: "Fractions", text: "Half of four?", options: ["one", "two", "three"], rightOption: 1, tags: ["misread", null, "concept"] };
const NAMES = ["Zara Made", "Arjun Made", "Meera Made", "Kabir Made", "Isha Made", "Dev Made"];

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const other = await makeTeacher(t, A.admin, "other@alpha.test", [a2]);
  const kids: Person[] = [];
  for (const [i, name] of NAMES.entries()) {
    const s = await makeStudent(t, A.admin, a1, `s${i}@alpha.test`, false);
    await t.run((ctx) => ctx.db.patch(s.memberId, { name }));
    kids.push(s);
  }
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  // Two papers to class 10 A, both closed by the time the report is read. Students 0 and 1 miss both; the others answer, 4 of 6 right.
  const papers: Id<"papers">[] = [];
  for (const due of [NOW + HOUR, NOW + 2 * HOUR]) {
    const id = await teacher.as.mutation(api.papers.create, { title: `Paper ${papers.length + 1}`, questions: [mcq] });
    await teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId: a1 }, opensAt: NOW - HOUR, dueAt: due });
    papers.push(id);
  }
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("paperAttempts").take(100)) {
      const i = kids.findIndex((k) => k.memberId === row.memberId);
      if (i < 2) await ctx.db.patch(row._id, { status: "submitted", missed: true, mcqCorrect: 0 });
      else await ctx.db.patch(row._id, { status: "submitted", missed: false, answers: [{ question: 0, choice: i < 4 ? 1 : 0 }], mcqCorrect: i < 4 ? 1 : 0 });
    }
  });
  vi.setSystemTime(NOW + 3 * HOUR);
  return { t, dhi, A, a1, a2, teacher, other, kids, B, papers };
}

const range = (classId: Id<"classes">) => ({ classId, fromDay: DAY, toDay: DAY });

describe("the school report", () => {
  test("covers AC-1: the class's teacher and the institute admin open it; another class's teacher, another institute, a DHI admin and a student cannot", async () => {
    const { teacher, other, A, B, dhi, kids, a1 } = await world();
    expect(await refusal(teacher.as.mutation(api.schoolReport.forClass, range(a1)))).toBe("ok");
    expect(await refusal(A.admin.as.mutation(api.schoolReport.forClass, range(a1)))).toBe("ok");
    for (const who of [other, B.admin, dhi, kids[2]]) expect(await refusal(who.as.mutation(api.schoolReport.forClass, range(a1)))).toBe("forbidden");
  });

  test("covers AC-3 and AC-4: the class totals come from the papers sent to the class in the range", async () => {
    const { teacher, a1 } = await world();
    const r = await teacher.as.mutation(api.schoolReport.forClass, range(a1));
    expect(r).toMatchObject({ className: "Class 10 A", students: 6, papers: 2, closed: 12, sat: 8, missed: 4, excused: 0 });
    if (!("subjects" in r)) throw new Error("refused");
    // Four students answered, fewer than five, so the share stays hidden.
    expect(r.subjects).toEqual([{ subject: "Maths", students: 4, pct: null, change: null }]);
  });

  test("covers AC-3: a range outside the papers is empty, and a range over 13 weeks is refused", async () => {
    const { teacher, a1 } = await world();
    expect(await teacher.as.mutation(api.schoolReport.forClass, { classId: a1, fromDay: "2026-09-01", toDay: "2026-09-30" })).toMatchObject({ papers: 0, closed: 0 });
    expect(await refusal(teacher.as.mutation(api.schoolReport.forClass, { classId: a1, fromDay: "2026-07-01", toDay: DAY }))).toBe("too_long");
    expect(await refusal(teacher.as.mutation(api.schoolReport.forClass, { classId: a1, fromDay: "nope", toDay: DAY }))).toBe("bad_range");
  });

  test("covers AC-6: the support list is A to Z with its reason, and each listed student, and only they, sees the look", async () => {
    const { t, teacher, a1, kids } = await world();
    const r = await teacher.as.mutation(api.schoolReport.forClass, range(a1));
    if (!("support" in r)) throw new Error("refused");
    expect(r.support).toEqual([
      { name: "Arjun Made", reasons: ["missed_in_a_row"] },
      { name: "Zara Made", reasons: ["missed_in_a_row"] },
    ]);
    const views = await t.run((ctx) => ctx.db.query("viewLog").take(100));
    expect(views.map((v) => v.targetMemberId).sort()).toEqual([kids[0].memberId, kids[1].memberId].sort());
    expect(views.every((v) => v.kind === "academic" && v.viewerId === teacher.memberId)).toBe(true);
  });

  test("covers AC-7: every open writes one access log row school.report", async () => {
    const { t, A, a1 } = await world();
    await A.admin.as.mutation(api.schoolReport.forClass, range(a1));
    const logs = await t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).filter((l) => l.action === "school.report"));
    expect(logs.length).toBe(1);
    expect(logs[0].actor).toBe(A.admin.memberId);
  });

  test("covers AC-2: a withdrawn student counts nowhere and is never listed", async () => {
    const { t, teacher, a1, kids } = await world();
    await kids[1].as.mutation(api.consent.withdraw, {});
    const r = await teacher.as.mutation(api.schoolReport.forClass, range(a1));
    if (!("support" in r)) throw new Error("refused");
    expect(r.students).toBe(5);
    expect(r.support.map((s) => s.name)).toEqual(["Zara Made"]);
    const views = await t.run((ctx) => ctx.db.query("viewLog").take(100));
    expect(views.some((v) => v.targetMemberId === kids[1].memberId)).toBe(false);
  });

  test("covers AC-8: room counts are the institute admin's alone, and below 10 students they stay empty", async () => {
    const { A, teacher, a1 } = await world();
    const counts = await A.admin.as.mutation(api.schoolReport.roomCounts, { classId: a1, month: "2026-09" });
    expect(counts.map((c) => c.kind).sort()).toEqual(["habits", "hour", "meals", "modules", "mood", "sleep"]);
    expect(counts.every((c) => c.count === null)).toBe(true);
    expect(await refusal(teacher.as.mutation(api.schoolReport.roomCounts, { classId: a1, month: "2026-09" }))).toBe("forbidden");
  });

  test("covers AC-9: the report's files read only the papers, never the Brain, the desk, a wellbeing room or counseling", () => {
    const files = import.meta.glob(["./schoolReport.ts", "./schoolRules.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    for (const [name, text] of Object.entries(files)) {
      const code = text.replace(/^\s*\/\/.*$/gm, "");
      expect(code, name).not.toMatch(/brain|desk|mood|sleep|meal|habit|counsel|events|eventLog/i);
    }
  });
});
