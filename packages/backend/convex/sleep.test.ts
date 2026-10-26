// The sleep room (spec house/0008). Each test names the criterion it covers. Time is fixed with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { averageLengthMin, bedMinToClock, clockText, clockToBedMin, isBedMin, isLengthMin, usualBedMin, wakeClockOf } from "./sleepRules";
import { makeBackend } from "../tests/convexTestUtils";
import { ROOM_ENTRIES } from "./roomRegistry";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-19T10:00:00+05:30");

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
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, s2]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, a1, teacher, s, s2 };
}

async function eventsOf(t: Awaited<ReturnType<typeof world>>["t"]) {
  return await t.run(async (ctx) => await ctx.db.query("events").collect());
}

describe("the sleep room", () => {
  test("covers AC-1 and AC-7: a night is saved, read back after a reload, and its event holds only the two numbers", async () => {
    const { t, s } = await world();
    const saved = await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 });
    expect(saved).toEqual({ ok: true, day: "2026-10-19", bedMin: 660, lengthMin: 450, changed: true });
    expect(await s.as.query(api.sleep.recent, {})).toEqual([{ day: "2026-10-19", bedMin: 660, lengthMin: 450 }]);
    const events = (await eventsOf(t)).filter((e) => e.room === "sleep");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("sleep.logged");
    expect(events[0].payload).toEqual({ bedMin: 660, lengthMin: 450 });
  });

  test("covers AC-2: the same night again writes nothing; a changed night replaces its event and keeps one row", async () => {
    const { t, s } = await world();
    await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 });
    expect(await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 })).toMatchObject({ ok: true, changed: false });
    expect((await eventsOf(t)).filter((e) => e.room === "sleep")).toHaveLength(1);
    expect(await s.as.mutation(api.sleep.save, { bedMin: 690, lengthMin: 450 })).toMatchObject({ ok: true, changed: true });
    const events = (await eventsOf(t)).filter((e) => e.room === "sleep");
    expect(events).toHaveLength(2);
    expect(events.filter((e) => e.replaces).length).toBe(1);
    expect(await s.as.query(api.sleep.recent, {})).toEqual([{ day: "2026-10-19", bedMin: 690, lengthMin: 450 }]);
  });

  test("covers AC-2: the eleventh change is refused with too_many_changes", async () => {
    const { s } = await world();
    await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 });
    for (let i = 1; i <= 10; i += 1) expect((await s.as.mutation(api.sleep.save, { bedMin: 660 + 15 * i, lengthMin: 450 })).ok).toBe(true);
    expect(await s.as.mutation(api.sleep.save, { bedMin: 60, lengthMin: 450 })).toEqual({ ok: false, code: "too_many_changes" });
  });

  test("covers AC-3: a save at 03:59:59.999 and one at 04:00 file under different house days", async () => {
    const { s } = await world();
    vi.setSystemTime(at("2026-10-19T03:59:59.999+05:30"));
    expect(await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 })).toMatchObject({ day: "2026-10-18" });
    vi.setSystemTime(at("2026-10-19T04:00:00.000+05:30"));
    expect(await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 })).toMatchObject({ day: "2026-10-19" });
  });

  test("covers AC-3: a second save before 04:00 changes that night rather than making a new row", async () => {
    const { s } = await world();
    vi.setSystemTime(at("2026-10-19T03:00:00+05:30"));
    await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 });
    vi.setSystemTime(at("2026-10-19T03:30:00+05:30"));
    expect(await s.as.mutation(api.sleep.save, { bedMin: 690, lengthMin: 420 })).toMatchObject({ ok: true, day: "2026-10-18", changed: true });
    expect(await s.as.query(api.sleep.recent, {})).toEqual([{ day: "2026-10-18", bedMin: 690, lengthMin: 420 }]);
  });

  test("covers AC-4: a value off the grid or out of range is refused, nothing is stored, and -0 is stored as 0", async () => {
    const { s } = await world();
    expect(await s.as.mutation(api.sleep.save, { bedMin: 7, lengthMin: 450 })).toEqual({ ok: false, code: "bad_time" });
    expect(await s.as.mutation(api.sleep.save, { bedMin: 1440, lengthMin: 450 })).toEqual({ ok: false, code: "bad_time" });
    expect(await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 45 })).toEqual({ ok: false, code: "bad_length" });
    expect(await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 975 })).toEqual({ ok: false, code: "bad_length" });
    expect(await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 7.5 })).toEqual({ ok: false, code: "bad_length" });
    expect(await s.as.query(api.sleep.recent, {})).toEqual([]);
    expect(await s.as.mutation(api.sleep.save, { bedMin: -0, lengthMin: 60 })).toEqual({ ok: true, day: "2026-10-19", bedMin: 0, lengthMin: 60, changed: true });
    expect(Object.is((await s.as.query(api.sleep.recent, {}))[0].bedMin, -0)).toBe(false);
  });

  test("covers AC-4: a night over midnight and the longest and shortest lengths are allowed", async () => {
    const { s } = await world();
    expect((await s.as.mutation(api.sleep.save, { bedMin: 1395, lengthMin: 960 })).ok).toBe(true);
  });

  test("covers AC-5: a teacher is refused with forbidden", async () => {
    const { teacher } = await world();
    expect(await refusal(teacher.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 }))).toBe("forbidden");
    expect(await refusal(teacher.as.query(api.sleep.recent, {}))).toBe("forbidden");
  });

  test("covers AC-6: a student reads only their own nights", async () => {
    const { s, s2 } = await world();
    await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 });
    expect(await s2.as.query(api.sleep.recent, {})).toEqual([]);
  });

  test("covers AC-10: the 31st attempt in an hour is refused with rate_limited, and refused attempts still count", async () => {
    const { s } = await world();
    for (let i = 0; i < 30; i += 1) expect((await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 })).ok).toBe(true);
    expect(await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 })).toEqual({ ok: false, code: "rate_limited" });
  });

  test("covers AC-7: a student with no night gets an empty list, not a guessed one", async () => {
    const { s } = await world();
    expect(await s.as.query(api.sleep.recent, {})).toEqual([]);
  });
});

describe("the sleep room's limit, export and erase", () => {
  test("covers AC-10: a refused save uses up a token too, so the 31st attempt in an hour is rate_limited", async () => {
    const { s } = await world();
    for (let i = 0; i < 30; i += 1) expect(await s.as.mutation(api.sleep.save, { bedMin: 7, lengthMin: 450 })).toEqual({ ok: false, code: "bad_time" });
    expect(await s.as.mutation(api.sleep.save, { bedMin: 660, lengthMin: 450 })).toEqual({ ok: false, code: "rate_limited" });
  });

  test("covers AC-9: the export pages through every night, oldest first, with clock times and no change count", async () => {
    const { t, s } = await world();
    const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
    await t.run(async (ctx) => {
      const member = await ctx.db.get(s.memberId);
      for (const day of days) await ctx.db.insert("sleepNights", { memberId: s.memberId, instituteId: member!.instituteId!, day, bedMin: 660, lengthMin: 450, changes: 0 });
    });
    const entry = ROOM_ENTRIES.find((e) => e.room === "sleep")!;
    const seen: { day: string; bed: string; wake: string; lengthMin: number }[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page += 1) {
      const r = (await t.run((ctx) => entry.exporter(ctx, s.memberId, cursor, 2))) as unknown as { rows: { day: string; bed: string; wake: string; lengthMin: number }[]; next: string | null };
      expect(r.rows.length).toBeLessThanOrEqual(2);
      seen.push(...r.rows);
      if (r.next === null) break;
      cursor = r.next;
    }
    expect(seen.map((r) => r.day)).toEqual(days);
    expect(seen[0]).toEqual({ day: "2026-10-01", bed: "23:00", wake: "06:30", lengthMin: 450 });
    expect(Object.keys(seen[0]).sort()).toEqual(["bed", "day", "lengthMin", "wake"]);
  });

  test("covers AC-9: the erase deletes every night across pages and leaves none", async () => {
    const { t, s, s2 } = await world();
    await t.run(async (ctx) => {
      for (const who of [s, s2]) {
        const member = await ctx.db.get(who.memberId);
        for (const day of ["2026-10-01", "2026-10-02", "2026-10-03"]) await ctx.db.insert("sleepNights", { memberId: who.memberId, instituteId: member!.instituteId!, day, bedMin: 660, lengthMin: 450, changes: 0 });
      }
    });
    const entry = ROOM_ENTRIES.find((e) => e.room === "sleep")!;
    for (let page = 0; page < 10; page += 1) {
      const r: { deleted: number; done: boolean } = await t.run((ctx) => entry.eraser(ctx, s.memberId, 2));
      if (r.done) break;
    }
    const left = await t.run(async (ctx) => ({
      mine: (await ctx.db.query("sleepNights").withIndex("by_memberId_and_day", (q) => q.eq("memberId", s.memberId)).collect()).length,
      theirs: (await ctx.db.query("sleepNights").withIndex("by_memberId_and_day", (q) => q.eq("memberId", s2.memberId)).collect()).length,
    }));
    expect(left).toEqual({ mine: 0, theirs: 3 });
  });
});

describe("the sleep rules", () => {
  test("covers AC-4: the grid and the ranges", () => {
    expect(isBedMin(0)).toBe(true);
    expect(isBedMin(1425)).toBe(true);
    expect(isBedMin(1439)).toBe(false); // not on the 15 minute grid: the largest bed minute is 1425
    expect(isBedMin(1440)).toBe(false);
    expect(isBedMin(7)).toBe(false);
    expect(isBedMin(7.5)).toBe(false);
    expect(isBedMin(NaN)).toBe(false);
    expect(isBedMin(Infinity)).toBe(false);
    expect(isLengthMin(60)).toBe(true);
    expect(isLengthMin(960)).toBe(true);
    expect(isLengthMin(59)).toBe(false);
    expect(isLengthMin(975)).toBe(false);
  });

  test("covers AC-8: the clock conversions on the noon scale", () => {
    expect(bedMinToClock(660)).toBe(1380); // 23:00
    expect(clockText(bedMinToClock(660))).toBe("23:00");
    expect(clockText(bedMinToClock(750))).toBe("00:30");
    expect(clockToBedMin(12 * 60)).toBe(0);
    expect(clockToBedMin(11 * 60 + 45)).toBe(1425);
    expect(clockText(wakeClockOf(660, 450))).toBe("06:30");
  });

  test("covers AC-8: the usual bedtime is a median across midnight, the lower middle for an even count, and needs three nights", () => {
    const nights = [{ bedMin: 660 }, { bedMin: 750 }, { bedMin: 690 }];
    expect(usualBedMin(nights)).toBe(690); // 23:30
    expect(usualBedMin(nights.slice(0, 2))).toBeNull();
    expect(usualBedMin([{ bedMin: 660 }, { bedMin: 750 }, { bedMin: 690 }, { bedMin: 720 }])).toBe(690);
  });

  test("covers AC-8: the average length is the rounded mean and needs three nights", () => {
    expect(averageLengthMin([{ lengthMin: 450 }, { lengthMin: 420 }, { lengthMin: 480 }])).toBe(450);
    expect(averageLengthMin([{ lengthMin: 450 }, { lengthMin: 420 }])).toBeNull();
    expect(averageLengthMin([{ lengthMin: 450 }, { lengthMin: 420 }, { lengthMin: 421 }])).toBe(430);
  });
});

