// The home screen's real data and the DHI score (spec house/0017, house/0020). Each test names the criterion it covers. Time is fixed with a fake clock.
// The score is the Brain's three lamps, so these tests make events through the real rooms, or store the hand made days of brainFixtures.ts.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { scenarioRows } from "./brainFixtures";
import { lampValue, ratio, scoreOf } from "./homeRules";
import { METRIC_VERSION } from "./metricRules";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T12:00:00+05:30");
const TODAY = "2026-10-20";
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
  return { t, teacher, s, other, a1 };
}

describe("the home summary", () => {
  test("covers AC-1: a new student gets a summary with no score yet and no demo data", async () => {
    const { s } = await world();
    const r = await s.as.query(api.home.summary, {});
    expect(r.score).toBeNull();
    expect(r.openExams).toEqual([]);
    expect(r.presence).toEqual({ moodDays: 0, mealDays: 0 });
    expect(r.lamps.map((l) => [l.name, l.value])).toEqual([["Sadhana", null], ["Niyam", null], ["Viveka", null]]);
  });

  test("covers AC-2: a paper sat today counts for the Sadhana lamp at once, and the score is the mean of the lamps that have something to measure", async () => {
    const { teacher, a1, s } = await world();
    const paperId = await teacher.as.mutation(api.papers.create, {
      title: "Today's paper",
      questions: [{ kind: "long", subject: "English", topic: "Story", text: "Tell a story.", maxMarks: 5, rubric: "x" }],
    });
    await teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: a1 }, opensAt: NOW - HOUR, dueAt: NOW + HOUR });
    const [open] = await s.as.query(api.home.summary, {}).then((r) => r.openExams);
    expect(open.title).toBe("Today's paper");
    await s.as.mutation(api.exams.start, { attemptId: open.attemptId });
    await s.as.mutation(api.exams.answer, { attemptId: open.attemptId, question: 0, text: "Once there was a story." });
    await s.as.mutation(api.exams.submit, { attemptId: open.attemptId });
    const r = await s.as.query(api.home.summary, {});
    expect(r.openExams).toEqual([]);
    expect(r.lamps[0].inputs).toEqual([
      { label: "Papers sat before the window closed", value: "100%" },
      { label: "Days sat in the study hour, of the days one was open", value: "Not yet" },
    ]);
    expect(r.score).toBe(100);
    expect(r.lamps[1].value).toBeNull();
  });

  test("covers AC-2: the lamps read the stored days of the study hour, habits and papers, and the score matches the lamp rules", async () => {
    const { t, s } = await world();
    await t.run(async (ctx) => {
      const member = await ctx.db.get(s.memberId);
      for (const row of scenarioRows("steady", TODAY)) {
        await ctx.db.insert("brainDays", { memberId: s.memberId, instituteId: member!.instituteId!, day: row.day, values: row.v as Record<string, { num: number; den: number }>, version: METRIC_VERSION, computedAt: NOW });
      }
    });
    const r = await s.as.query(api.home.summary, {});
    expect(r.score).toBe(70);
    expect(r.lamps.map((l) => l.name)).toEqual(["Sadhana", "Niyam", "Viveka"]);
    expect(r.lamps[0].inputs.map((i) => i.value)).toEqual(["100%", "56%"]);
    expect(r.lamps[1].inputs.map((i) => i.value)).toEqual(["63%"]);
    expect(r.lamps[2].inputs.map((i) => i.value)).toEqual(["Not yet"]);
    // 14 days of mood logged in the fixture's last two weeks, and a plate on each of the last 14 days.
    expect(r.presence).toEqual({ moodDays: 12, mealDays: 14 });
  });

  test("covers AC-3: mood and meal logs count only as days with a log, and their content never reaches the output", async () => {
    const { s } = await world();
    await s.as.mutation(api.moods.save, { mood: "happy", note: "my private words" });
    const food = await s.as.mutation(api.foods.addCustom, { nameEn: "Secret dish", group: "dal", processing: "home_cooked", energyKcal: 100, carbsG: 10, proteinG: 5, fatG: 2, serving: "1 bowl" });
    await s.as.mutation(api.meals.log, { foodId: food, count: 1, meal: "lunch", eatenAt: NOW - HOUR });
    const r = await s.as.query(api.home.summary, {});
    expect(r.presence).toEqual({ moodDays: 1, mealDays: 1 });
    const text = JSON.stringify(r);
    expect(text).not.toContain("my private words");
    expect(text).not.toContain("Secret dish");
    expect(r.score).toBeNull();
  });

  test("covers AC-6: another student's rows never change the score or the presence", async () => {
    const { s, other } = await world();
    await other.as.mutation(api.moods.save, { mood: "happy", note: "" });
    expect((await s.as.query(api.home.summary, {})).presence.moodDays).toBe(0);
    expect((await other.as.query(api.home.summary, {})).presence.moodDays).toBe(1);
  });

  test("covers AC-6: a teacher has no home summary", async () => {
    const { teacher } = await world();
    expect(await refusal(teacher.as.query(api.home.summary, {}))).toBe("forbidden");
  });
});

describe("the home summary's privacy", () => {
  test("covers AC-3: the summary file reads no mood, no note and no habit plan: it reads only the Brain's numbers", () => {
    const files = import.meta.glob("./home.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const code = files["./home.ts"].split(String.fromCharCode(10)).filter((l) => !l.trim().startsWith("//")).join(String.fromCharCode(10));
    expect(code).not.toMatch(/[.]note\b|[.]mood\b|habitPlans|habitChecks|mealPlates|query\s*\(\s*["']moodDays/);
  });
});

describe("the score rules", () => {
  test("covers AC-2: a lamp is the mean of its inputs, nulls are left out, and the score is the mean of the lamps", () => {
    expect(ratio(1, 2)).toBe(0.5);
    expect(ratio(1, 0)).toBeNull();
    expect(lampValue([0.5, null, 1])).toBe(0.75);
    expect(lampValue([null])).toBeNull();
    expect(scoreOf({ sadhana: 1, niyam: 0.5, viveka: null })).toBe(75);
    expect(scoreOf({ sadhana: null, niyam: null, viveka: null })).toBeNull();
  });
});
