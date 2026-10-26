/// <reference types="vite/client" />
// The Brain's daily values (spec house/0019, scope row 17): the rollup job. The events come from the real rooms, so a day's stored values are proven
// from the same writes a student makes. Time is fixed with a fake clock and moved by hand.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { brainRoom } from "./brainRoom";
import { shiftDay } from "./dayRules";
import { HABIT_COLORS } from "./habitRules";
import { METRIC_IDS, METRIC_VERSION } from "./metricRules";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-19T10:00:00+05:30");
const TODAY = "2026-10-19";
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

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
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, s2]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, a1, s, s2 };
}
type World = Awaited<ReturnType<typeof world>>;

// A pass leaves out events newer than 10 seconds (the quiet time), so the clock moves 11 seconds first.
const run = (w: World) => {
  vi.setSystemTime(Date.now() + 11 * 1000);
  return w.t.mutation(internal.brainRollup.run, {});
};
const closeDay = (w: World, day: string) => w.t.mutation(internal.brainRollup.closeDay, { day, cursor: null });
const daysOf = (w: World, memberId: Id<"members">) => w.t.run((ctx) => ctx.db.query("brainDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId)).collect());
const mood = (p: Person, m: string) => p.as.mutation(api.moods.save, { mood: m, note: "" });
const habit = (p: Person) =>
  p.as.mutation(api.habits.add, { kind: "water", title: "Eight glasses of water", color: HABIT_COLORS[3], startOn: TODAY, endOn: shiftDay(TODAY, 20) });
async function tickHabit(p: Person) {
  const r = await habit(p);
  if (!r.ok) throw new Error("setup");
  await p.as.mutation(api.habits.setToday, { planId: r.id, lit: true });
}
// A stay of 25 minutes in the study hour (see sessionFeedback.test.ts).
async function sit(w: World, p: Person, start: number, minutes: number) {
  vi.setSystemTime(start);
  await p.as.mutation(api.studyHour.enter, { mode: "live" });
  for (let t = 30 * 1000; t < minutes * MIN; t += 30 * 1000) {
    vi.setSystemTime(start + t);
    await p.as.mutation(api.studyHour.beat, {});
  }
  vi.setSystemTime(start + minutes * MIN);
  await p.as.mutation(api.studyHour.leave, {});
}

describe("the stored days (AC-1 to AC-4)", () => {
  test("covers AC-1: a mood, a habit tick and a plate reach the day's values after a pass, as numbers and nothing else", async () => {
    const w = await world();
    await mood(w.s, "stressed");
    await tickHabit(w.s);
    const dish = await w.s.as.mutation(api.foods.addCustom, {
      nameEn: "Chips",
      group: "grain",
      processing: "packaged",
      energyKcal: 150,
      carbsG: 20,
      proteinG: 2,
      fatG: 8,
      serving: "1 pack",
    });
    await w.s.as.mutation(api.meals.log, { foodId: dish, count: 1, meal: "breakfast", eatenAt: NOW - HOUR });
    expect(await run(w)).toMatchObject({ days: 1, more: false });
    const [row] = await daysOf(w, w.s.memberId);
    expect(row).toMatchObject({ day: TODAY, version: METRIC_VERSION, instituteId: w.A.instituteId });
    expect(row.values).toMatchObject({
      E01: { num: 1, den: 1 },
      E02: { num: 1, den: 1 },
      E03: { num: 0, den: 1 },
      H08: { num: 1, den: 1 },
      H01: { num: 1, den: 1 },
      H02: { num: 1, den: 5 },
      H05: { num: 1, den: 1 },
      C01: { num: 1, den: 1 },
    });
    expect(Object.keys(row.values).every((k) => (METRIC_IDS as readonly string[]).includes(k))).toBe(true);
    // No word of what the student wrote or chose is kept: the row holds ids, numbers and metric ids.
    const text = JSON.stringify(row);
    for (const word of ["stressed", "Chips", "water", "Eight"]) expect(text, word).not.toContain(word);
    expect(await daysOf(w, w.s2.memberId)).toEqual([]);
  });

  test("covers AC-4: running a pass again, or closing the same day, never counts a thing twice", async () => {
    const w = await world();
    await mood(w.s, "happy");
    await run(w);
    const first = (await daysOf(w, w.s.memberId))[0];
    await run(w);
    await run(w);
    await closeDay(w, TODAY);
    const rows = await daysOf(w, w.s.memberId);
    expect(rows).toHaveLength(1);
    expect(rows[0].values).toEqual(first.values);
    // A second thing the same day adds to the same row.
    await tickHabit(w.s);
    await run(w);
    const after = await daysOf(w, w.s.memberId);
    expect(after).toHaveLength(1);
    expect(after[0].values.H08).toEqual({ num: 1, den: 1 });
    expect(after[0].values.E01).toEqual({ num: 1, den: 1 });
    expect(after[0]._id).toBe(first._id);
  });

  test("covers AC-4: a changed mood replaces the day's value, and an undone tick takes its value away", async () => {
    const w = await world();
    await mood(w.s, "stressed");
    await run(w);
    expect((await daysOf(w, w.s.memberId))[0].values.E02).toEqual({ num: 1, den: 1 });
    await mood(w.s, "happy");
    await run(w);
    expect((await daysOf(w, w.s.memberId))[0].values.E02).toEqual({ num: 0, den: 1 });
    // A day that had only a tick has no row again once the tick is undone.
    const r = await habit(w.s2);
    if (!r.ok) throw new Error("setup");
    await w.s2.as.mutation(api.habits.setToday, { planId: r.id, lit: true });
    await run(w);
    expect(await daysOf(w, w.s2.memberId)).toHaveLength(1);
    await w.s2.as.mutation(api.habits.setToday, { planId: r.id, lit: false });
    await run(w);
    expect(await daysOf(w, w.s2.memberId)).toEqual([]);
  });

  test("covers AC-3: a day with nothing logged is not logged, so a student with no events and no open habit has no rows", async () => {
    const w = await world();
    vi.setSystemTime(NOW + 2 * DAY);
    await closeDay(w, TODAY);
    await closeDay(w, shiftDay(TODAY, 1));
    expect(await daysOf(w, w.s.memberId)).toEqual([]);
    expect(await daysOf(w, w.s2.memberId)).toEqual([]);
  });

  test("covers AC-3: an open habit that was not ticked is a zero once the day is over, and not before", async () => {
    const w = await world();
    const r = await habit(w.s);
    if (!r.ok) throw new Error("setup");
    // The day is not over: no zero yet.
    await closeDay(w, TODAY);
    expect(await daysOf(w, w.s.memberId)).toEqual([]);
    vi.setSystemTime(NOW + 2 * DAY);
    await closeDay(w, TODAY);
    await closeDay(w, shiftDay(TODAY, 1));
    const rows = await daysOf(w, w.s.memberId);
    expect(rows.map((x) => x.day).sort()).toEqual([TODAY, shiftDay(TODAY, 1)]);
    expect(rows.every((x) => x.values.H08.num === 0 && x.values.H08.den === 1)).toBe(true);
    // Today, still in progress, has no row.
    await closeDay(w, shiftDay(TODAY, 2));
    expect(await daysOf(w, w.s.memberId)).toHaveLength(2);
  });

  test("covers AC-3: a study hour that was open and not sat is a zero for the day, and a stay of 25 minutes is 25", async () => {
    const w = await world();
    await w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW - 10 * MIN, closesAt: NOW + 3 * HOUR });
    await sit(w, w.s, NOW, 25);
    vi.setSystemTime(NOW + DAY);
    await run(w);
    await closeDay(w, TODAY);
    const sat = (await daysOf(w, w.s.memberId))[0];
    expect(sat.values.X01).toEqual({ num: 25, den: 1 });
    expect(sat.values.H12).toEqual({ num: 1, den: 1 });
    const away = (await daysOf(w, w.s2.memberId))[0];
    expect(away.values).toEqual({ X01: { num: 0, den: 1 }, H12: { num: 0, den: 1 } });
  });

  test("covers AC-7: a student who has withdrawn gets no new values, and an erased member none at all", async () => {
    const w = await world();
    await mood(w.s, "sad");
    await w.s.as.mutation(api.consent.withdraw, {});
    await run(w);
    expect(await daysOf(w, w.s.memberId)).toEqual([]);
  });
});

describe("checks and rebuilds (AC-5, AC-6)", () => {
  test("covers AC-5: the nightly check finds no gap in a good state, and counts one when a stored day is wrong", async () => {
    const w = await world();
    await mood(w.s, "heavy");
    await mood(w.s2, "happy");
    await run(w);
    vi.setSystemTime(NOW + 10 * MIN);
    expect(await w.t.mutation(internal.brainRollup.reconcile, {})).toEqual({ checked: 2, mismatches: 0 });
    const [row] = await daysOf(w, w.s.memberId);
    await w.t.run((ctx) => ctx.db.patch(row._id, { values: { ...row.values, E03: { num: 0, den: 1 } } }));
    expect(await w.t.mutation(internal.brainRollup.reconcile, {})).toEqual({ checked: 2, mismatches: 1 });
    const state = await w.t.run((ctx) => ctx.db.query("brainState").withIndex("by_key", (q) => q.eq("key", "reconcile")).first());
    expect(state).toMatchObject({ checked: 2, mismatches: 1 });
    // Closing the day repairs the wrong row. A row written a moment ago is still settling and is left out of the check; the other, unchanged, stays in.
    await closeDay(w, TODAY);
    expect(await w.t.mutation(internal.brainRollup.reconcile, {})).toEqual({ checked: 1, mismatches: 0 });
  });

  test("covers AC-6: a day stored under an older formula is rebuilt from the events", async () => {
    const w = await world();
    await mood(w.s, "heavy");
    await run(w);
    const [row] = await daysOf(w, w.s.memberId);
    await w.t.run((ctx) => ctx.db.patch(row._id, { version: METRIC_VERSION - 1, values: { E03: { num: 0, den: 1 } } }));
    expect(await w.t.mutation(internal.brainRollup.rebuildStale, {})).toBe(1);
    const [fixed] = await daysOf(w, w.s.memberId);
    expect(fixed.version).toBe(METRIC_VERSION);
    expect(fixed.values.E03).toEqual({ num: 1, den: 1 });
    expect(await w.t.mutation(internal.brainRollup.rebuildStale, {})).toBe(0);
  });

  test("covers AC-4: a late event for an earlier day is picked up by the next pass", async () => {
    const w = await world();
    await mood(w.s, "happy");
    await run(w);
    // A plate eaten yesterday and logged now writes an event for yesterday, which the pass finds by when it was written.
    const dish = await w.s.as.mutation(api.foods.addCustom, { nameEn: "Dal", group: "dal", processing: "home_cooked", energyKcal: 100, carbsG: 10, proteinG: 5, fatG: 2, serving: "1 bowl" });
    await w.s.as.mutation(api.meals.log, { foodId: dish, count: 1, meal: "dinner", eatenAt: NOW - 20 * HOUR });
    await run(w);
    const days = (await daysOf(w, w.s.memberId)).map((r) => r.day).sort();
    expect(days).toEqual([shiftDay(TODAY, -1), TODAY]);
  });
});

describe("the quiet time, a paused class and the paged rebuild (review fixes)", () => {
  test("covers AC-4: a pass leaves out events newer than 10 seconds, and picks them up once they are older", async () => {
    const w = await world();
    await mood(w.s, "happy");
    expect(await w.t.mutation(internal.brainRollup.run, {})).toMatchObject({ events: 0, days: 0 });
    expect(await daysOf(w, w.s.memberId)).toEqual([]);
    vi.setSystemTime(Date.now() + 9 * 1000);
    expect(await w.t.mutation(internal.brainRollup.run, {})).toMatchObject({ events: 0, days: 0 });
    vi.setSystemTime(Date.now() + 2 * 1000);
    expect(await w.t.mutation(internal.brainRollup.run, {})).toMatchObject({ events: 1, days: 1 });
    expect(await daysOf(w, w.s.memberId)).toHaveLength(1);
  });

  test("covers AC-4: what a student did before a pause still counts, and a day the pause touched gets no real zero, before or after the resume", async () => {
    const w = await world();
    await mood(w.s, "happy");
    // A habit open on every day, never ticked: on an ordinary finished day that is a real zero.
    expect((await habit(w.s)).ok).toBe(true);
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    await run(w);
    expect((await daysOf(w, w.s.memberId)).map((r) => r.day)).toEqual([TODAY]);
    vi.setSystemTime(NOW + 2 * DAY);
    await w.A.admin.as.mutation(api.classes.resume, { classId: w.a1 });
    vi.setSystemTime(NOW + 4 * DAY);
    for (let i = 0; i <= 3; i += 1) await closeDay(w, shiftDay(TODAY, i));
    const byDay = new Map((await daysOf(w, w.s.memberId)).map((r) => [r.day, r.values]));
    // The mood of the first day stays, with no zero for the habit. The paused days and the day of the resume have no zero. The first day after has one.
    expect(byDay.get(TODAY)).toMatchObject({ E01: { num: 1, den: 1 } });
    for (let i = 0; i <= 2; i += 1) expect(byDay.get(shiftDay(TODAY, i))?.H08, `day ${i}`).toBeUndefined();
    expect(byDay.get(shiftDay(TODAY, 3))).toMatchObject({ H08: { num: 0, den: 1 } });
  });

  test("covers AC-6: 45 stale rows that cannot be rebuilt do not hold up the one that can", async () => {
    const w = await world();
    const a2 = await makeClass(w.A.admin, "Class 10", "B");
    const s3 = await makeStudent(w.t, w.A.admin, a2, "s3@alpha.test", false);
    await w.A.admin.as.mutation(api.classes.pause, { classId: a2 });
    await w.t.run(async (ctx) => {
      for (let i = 1; i <= 45; i += 1) {
        await ctx.db.insert("brainDays", { memberId: s3.memberId, instituteId: w.A.instituteId, day: shiftDay(TODAY, -i), values: { E01: { num: 1, den: 1 } }, version: METRIC_VERSION - 1, computedAt: NOW });
      }
    });
    // The one row that can be rebuilt is stored after them, so it sits behind a whole page of rows that cannot.
    await mood(w.s, "heavy");
    await run(w);
    const [row] = await daysOf(w, w.s.memberId);
    await w.t.run((ctx) => ctx.db.patch(row._id, { version: METRIC_VERSION - 1, values: { E03: { num: 0, den: 1 } } }));
    let rebuilt = 0;
    for (let pass = 0; pass < 4; pass += 1) rebuilt += await w.t.mutation(internal.brainRollup.rebuildStale, {});
    expect(rebuilt).toBe(1);
    const [fixed] = await daysOf(w, w.s.memberId);
    expect(fixed).toMatchObject({ version: METRIC_VERSION, values: { E03: { num: 1, den: 1 } } });
    // The paused student's rows are still old, and no row was dropped.
    const stale = await w.t.run((ctx) => ctx.db.query("brainDays").withIndex("by_version", (q) => q.lt("version", METRIC_VERSION)).collect());
    expect(stale).toHaveLength(45);
  });
});

describe("export, erase and the wall (AC-8, AC-9)", () => {
  test("covers AC-8: a student's download holds the numbers, and the erase removes the days and the hidden patterns", async () => {
    const w = await world();
    await mood(w.s, "sad");
    await run(w);
    await w.t.run((ctx) => ctx.db.insert("brainHides", { memberId: w.s.memberId, patternId: "dragging_mood", until: NOW + DAY }));
    const page = await w.t.run((ctx) => brainRoom.exporter(ctx, w.s.memberId, null, 10));
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({ day: TODAY, values: { E03: { num: 1, den: 1 } } });
    expect(page.next).toBeNull();
    const erased = await w.t.run((ctx) => brainRoom.eraser(ctx, w.s.memberId, 10));
    expect(erased.done).toBe(true);
    expect(await daysOf(w, w.s.memberId)).toEqual([]);
    expect(await w.t.run((ctx) => ctx.db.query("brainHides").collect())).toEqual([]);
  });

  test("covers AC-9: only the rollup writes a day, and only the allowed files read them", () => {
    const files = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const code = (text: string) => text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    const app = Object.entries(files).filter(([name]) => !name.endsWith(".test.ts"));
    for (const [name, text] of app) {
      const c = code(text);
      if (/insert\s*\(\s*["']brainDays["']/.test(c)) expect(["./brainRollup.ts", "./brainProof.ts"], `${name} inserts a Brain day`).toContain(name);
      if (/query\s*\(\s*["']brainDays["']/.test(c)) expect(["./brainRollup.ts", "./brainDay.ts", "./brainRoom.ts", "./brain.ts", "./home.ts", "./brainProof.ts"], `${name} reads Brain days`).toContain(name);
    }
  });
});
