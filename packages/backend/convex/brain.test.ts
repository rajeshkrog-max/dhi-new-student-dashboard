// The Brain report for the student (spec house/0020, scope rows 18 to 22). The days behind the report are the hand made weeks of brainFixtures.ts,
// stored the way the rollup stores them, and today is worked out live from the real rooms. Each test names the criterion it covers.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { connectedRows, scenarioRows, type Scenario } from "./brainFixtures";
import { HIDE_DAYS } from "./brainRules";
import { DAY_MS, shiftDay, todayOf } from "./dayRules";
import { HABIT_COLORS } from "./habitRules";
import { METRIC_VERSION } from "./metricRules";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T12:00:00+05:30");
const TODAY = "2026-10-20";

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
  await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counselor@dhi.test", name: "Counselor" });
  const counselor = await joinAs(t, "counselor@dhi.test", { name: "Counselor" });
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const other = await makeStudent(t, A.admin, a1, "other@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, other]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-08-01T10:00:00+05:30") });
  });
  return { t, dhi, A, teacher, counselor, s, other };
}
type World = Awaited<ReturnType<typeof world>>;

// Stores a hand made week for a student, as the rollup would, relative to the day it is now.
async function store(w: World, p: Person, scenario: Scenario) {
  await w.t.run(async (ctx) => {
    const member = await ctx.db.get(p.memberId);
    for (const old of await ctx.db.query("brainDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", p.memberId)).collect()) await ctx.db.delete(old._id);
    for (const row of scenarioRows(scenario, todayOf(Date.now()))) {
      await ctx.db.insert("brainDays", { memberId: p.memberId, instituteId: member!.instituteId!, day: row.day, values: row.v as Record<string, { num: number; den: number }>, version: METRIC_VERSION, computedAt: Date.now() });
    }
  });
}
const report = (p: Person) => p.as.query(api.brain.report, {});

describe("the report (AC-1 to AC-8)", () => {
  test("covers AC-7: a student with nothing logged gets an empty report that says how many days are needed, and nothing else", async () => {
    const w = await world();
    const r = await report(w.s);
    expect(r).toMatchObject({ today: TODAY, loggedDays: 0, needDays: 5, score: null, patterns: [], hidden: [], expression: null, support: null, draft: { sources: true } });
    expect(r.lamps.map((l) => [l.lamp, l.value, l.movement])).toEqual([["sadhana", null, null], ["niyam", null, null], ["viveka", null, null]]);
    expect(r.coverage.every((c) => c.days === 0)).toBe(true);
    expect(r.coverage.map((c) => c.room).sort()).toEqual(["blog", "day", "habits", "hour", "modules", "mood", "papers", "sleep"]);
  });

  test("covers AC-1, AC-4, AC-5, AC-7: a heavy fortnight shows the chain with its days, the expression note and the support offer, and no sentence", async () => {
    const w = await world();
    await store(w, w.s, "heavy");
    const r = await report(w.s);
    expect(r.loggedDays).toBe(14);
    expect(r.patterns.map((p) => [p.id, p.kind])).toEqual([["mood_habits_quiet", "dragging"]]);
    const chain = r.patterns[0];
    expect(chain.params).toMatchObject({ lowDays: 5, chainDays: 5, window: 14 });
    expect(chain.evidence.map((e) => e.day)).toEqual([9, 8, 7, 6, 5, 4, 3, 2].map((n) => shiftDay(TODAY, -n)));
    expect(chain.evidence[0].items).toEqual([{ item: "low_mood", room: "mood" }, { item: "habit_not_ticked", room: "habits" }]);
    expect(chain.evidence[2].items).toEqual([{ item: "hour_not_sat", room: "hour" }]);
    expect(chain.evidence[4].items).toEqual([{ item: "paper_missed", room: "papers" }]);
    expect(r.expression).toEqual({ runDays: [shiftDay(TODAY, -4), shiftDay(TODAY, -3)], postDay: shiftDay(TODAY, -2) });
    expect(r.support).toEqual({ lowDays: 3 });
    // The report holds ids, counts and days: no mood word, no habit title, no sentence.
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/\b(sad|heavy|tends to|you|your)\b/i);
  });

  test("covers AC-2, AC-3, AC-6: a steady month shows the supporting pattern and rising lamps, and the meals chain stays off", async () => {
    const w = await world();
    await store(w, w.s, "steady");
    const r = await report(w.s);
    expect(r.patterns.map((p) => [p.id, p.kind])).toEqual([["steady_rhythm", "supporting"]]);
    expect(r.expression).toBeNull();
    expect(r.support).toBeNull();
    expect(r.lamps.map((l) => l.movement)).toEqual(["rising", "rising", null]);
    expect(r.score).toBe(70);
    await store(w, w.s, "packaged");
    expect((await report(w.s)).patterns.map((p) => p.id)).not.toContain("packaged_quiet");
  });

  test("covers AC-6, AC-7: today is worked out live, so a habit ticked a moment ago moves the Niyam lamp before any job has run", async () => {
    const w = await world();
    const added = await w.s.as.mutation(api.habits.add, { kind: "water", title: "Eight glasses of water", color: HABIT_COLORS[3], startOn: TODAY, endOn: shiftDay(TODAY, 20) });
    if (!added.ok) throw new Error("setup");
    expect((await report(w.s)).lamps[1].value).toBeNull();
    await w.s.as.mutation(api.habits.setToday, { planId: added.id, lit: true });
    const r = await report(w.s);
    expect(r.lamps[1]).toMatchObject({ lamp: "niyam", value: 1, loggedDays: 1 });
    expect(r.score).toBe(100);
    // Today is not one of the 14 finished days a chain reads.
    expect(r.loggedDays).toBe(0);
  });

  test("covers AC-8: a student sees their own days only", async () => {
    const w = await world();
    await store(w, w.s, "heavy");
    const mine = await report(w.s);
    const theirs = await report(w.other);
    expect(mine.patterns).toHaveLength(1);
    expect(theirs).toMatchObject({ loggedDays: 0, patterns: [], expression: null, support: null });
  });
});

// Forty finished days, half with an early bedtime and good paper answers, half with a late bedtime and poor ones (house spec 0023).
async function storeSleepAndPapers(w: World, p: Person, gap = true) {
  await w.t.run(async (ctx) => {
    const member = await ctx.db.get(p.memberId);
    for (let i = 1; i <= 40; i += 1) {
      const early = i % 2 === 0;
      const right = gap ? (early ? 8 : 3) : 5;
      await ctx.db.insert("brainDays", {
        memberId: p.memberId,
        instituteId: member!.instituteId!,
        day: shiftDay(TODAY, -i),
        values: { H06: { num: early ? 600 : 720, den: 1 }, A02: { num: right, den: 10 } },
        version: METRIC_VERSION,
        computedAt: Date.now(),
      });
    }
  });
}

describe("the connections (house spec 0023)", () => {
  test("a connection shows with its two means and the days behind it, for that student only", async () => {
    const w = await world();
    await storeSleepAndPapers(w, w.s);
    expect((await report(w.s)).connections).toEqual([{ id: "sleep_papers", a: 80, b: 30, nA: 20, nB: 20 }]);
    expect((await report(w.other)).connections).toEqual([]);
  });

  // The seed of the browser proof (brainProof "connected", brainFixtures.connectedRows) really shows the bedtime and mood connection.
  test("the connected seed scenario shows the bedtime and mood connection", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const member = await ctx.db.get(w.s.memberId);
      for (const row of connectedRows(TODAY)) {
        await ctx.db.insert("brainDays", { memberId: w.s.memberId, instituteId: member!.instituteId!, day: row.day, values: row.v as Record<string, { num: number; den: number }>, version: METRIC_VERSION, computedAt: Date.now() });
      }
    });
    expect((await report(w.s)).connections.map((c) => c.id)).toContain("bedtime_mood");
  });

  test("no difference between the two kinds of night shows nothing", async () => {
    const w = await world();
    await storeSleepAndPapers(w, w.s, false);
    expect((await report(w.s)).connections).toEqual([]);
  });

  test("'does not feel true' hides a connection for 30 days, lists it as hidden, and show brings it back", async () => {
    const w = await world();
    await storeSleepAndPapers(w, w.s);
    expect(await w.s.as.mutation(api.brain.hide, { id: "sleep_papers" })).toEqual({ ok: true });
    let r = await report(w.s);
    expect(r.connections).toEqual([]);
    expect(r.hidden).toEqual(["sleep_papers"]);
    expect(await w.s.as.mutation(api.brain.show, { id: "sleep_papers" })).toEqual({ ok: true });
    r = await report(w.s);
    expect(r.connections).toHaveLength(1);
    expect(r.hidden).toEqual([]);
  });

  test("the same days give the same connection every time", async () => {
    const w = await world();
    await storeSleepAndPapers(w, w.s);
    expect((await report(w.s)).connections).toEqual((await report(w.s)).connections);
  });

  test("no staff function returns a connection", async () => {
    const w = await world();
    await storeSleepAndPapers(w, w.s);
    for (const p of [w.teacher, w.counselor, w.dhi, w.A.admin]) {
      expect(await refusal(p.as.query(api.brain.report, {}))).toBe("forbidden");
    }
  });
});

describe("hiding a pattern (AC-7)", () => {
  test("covers AC-7: 'does not feel true' hides a pattern, listing it as hidden, and show brings it back", async () => {
    const w = await world();
    await store(w, w.s, "heavy");
    expect(await w.s.as.mutation(api.brain.hide, { id: "mood_habits_quiet" })).toEqual({ ok: true });
    let r = await report(w.s);
    expect(r.patterns).toEqual([]);
    expect(r.hidden).toEqual(["mood_habits_quiet"]);
    expect(r.expression).not.toBeNull();
    // Another student is not affected.
    await store(w, w.other, "heavy");
    expect((await report(w.other)).patterns).toHaveLength(1);
    expect(await w.s.as.mutation(api.brain.show, { id: "mood_habits_quiet" })).toEqual({ ok: true });
    r = await report(w.s);
    expect(r.patterns).toHaveLength(1);
    expect(r.hidden).toEqual([]);
  });

  test("covers AC-7: the expression note can be hidden too, but the support offer has no hide", async () => {
    const w = await world();
    await store(w, w.s, "heavy");
    await w.s.as.mutation(api.brain.hide, { id: "expression" });
    const r = await report(w.s);
    expect(r.expression).toBeNull();
    expect(r.hidden).toEqual(["expression"]);
    expect(r.support).toEqual({ lowDays: 3 });
    expect(await w.s.as.mutation(api.brain.hide, { id: "support" })).toEqual({ ok: false, code: "bad_id" });
    expect(await w.s.as.mutation(api.brain.hide, { id: "anything" })).toEqual({ ok: false, code: "bad_id" });
  });

  test("covers AC-7: a hidden pattern comes back after 30 days, and hiding it again moves the end date", async () => {
    const w = await world();
    await store(w, w.s, "heavy");
    await w.s.as.mutation(api.brain.hide, { id: "mood_habits_quiet" });
    const row = async () => (await w.t.run((ctx) => ctx.db.query("brainHides").collect()))[0];
    expect((await row()).until).toBe(NOW + HIDE_DAYS * DAY_MS);
    vi.setSystemTime(NOW + 60 * 60 * 1000);
    await w.s.as.mutation(api.brain.hide, { id: "mood_habits_quiet" });
    expect(await w.t.run((ctx) => ctx.db.query("brainHides").collect())).toHaveLength(1);
    expect((await row()).until).toBe(NOW + 60 * 60 * 1000 + HIDE_DAYS * DAY_MS);
    expect((await report(w.s)).patterns).toEqual([]);
    // Once the end date has passed the pattern shows again (the clock is not moved 30 days because the session itself would run out).
    await w.t.run(async (ctx) => ctx.db.patch((await ctx.db.query("brainHides").first())!._id, { until: Date.now() - 1 }));
    const back = await report(w.s);
    expect(back.patterns).toHaveLength(1);
    expect(back.hidden).toEqual([]);
  });

  test("covers AC-7: hiding is slowed down after 30 tries an hour, and a refused try is returned, not thrown", async () => {
    const w = await world();
    let refused = "";
    for (let i = 0; i < 40 && refused === ""; i += 1) {
      const r = await w.s.as.mutation(api.brain.hide, { id: "steady_rhythm" });
      if (!r.ok) refused = r.code;
    }
    expect(refused).toBe("slow_down");
  });
});

describe("who can read it (AC-8)", () => {
  test("covers AC-8: only a student reads the report or hides a pattern; a teacher, an institute admin, a DHI admin and a counselor are refused", async () => {
    const w = await world();
    await store(w, w.s, "heavy");
    for (const p of [w.teacher, w.A.admin, w.dhi, w.counselor]) {
      expect(await refusal(report(p))).toBe("forbidden");
      expect(await refusal(p.as.mutation(api.brain.hide, { id: "expression" }))).toBe("forbidden");
      expect(await refusal(p.as.mutation(api.brain.show, { id: "expression" }))).toBe("forbidden");
    }
    expect(await refusal(w.t.query(api.brain.report, {}))).toBe("not_signed_in");
  });

  test("covers AC-8: a student who has withdrawn consent gets nothing", async () => {
    const w = await world();
    await store(w, w.s, "heavy");
    await w.s.as.mutation(api.consent.withdraw, {});
    expect(await refusal(report(w.s))).toBe("consent_withdrawn");
  });

  test("covers AC-8: looking at the report leaves no record for staff to see", async () => {
    const w = await world();
    await store(w, w.s, "heavy");
    await report(w.s);
    await w.s.as.mutation(api.brain.hide, { id: "expression" });
    expect(await w.t.run((ctx) => ctx.db.query("viewLog").collect())).toEqual([]);
    const access = await w.t.run((ctx) => ctx.db.query("accessLog").collect());
    expect(access.filter((a) => a.targetMemberId === w.s.memberId && a.action.startsWith("brain"))).toEqual([]);
  });

  test("covers AC-8: the Brain's files do not use the staff read, the access log or any other student's id", () => {
    const files = import.meta.glob(["./brain.ts", "./brainDay.ts", "./brainRules.ts", "./connectionRules.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    for (const [name, text] of Object.entries(files)) {
      const code = text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      expect(code, name).not.toMatch(/staffRead|classTotal|logAccess|viewLog|accessLog/);
    }
  });
});
