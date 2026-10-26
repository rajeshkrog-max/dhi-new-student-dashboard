/// <reference types="vite/client" />
// The habits room (spec house/0007). Each test names the criterion it covers. Time is fixed with a fake clock; the scheduler is fake too so an
// erase can run its pages.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { shiftDay } from "./dayRules";
import { eventsForDay } from "./eventLog";
import { HABIT_COLORS, HABIT_KINDS, MAX_FLIPS, windowProblem } from "./habitRules";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-19T10:00:00+05:30");
const TODAY = "2026-10-19";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  process.env.ERASURE_HASH_SECRET = "test-erasure-secret";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.ERASURE_HASH_SECRET;
});

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counselor@dhi.test", name: "Counselor" });
  const counselor = await joinAs(t, "counselor@dhi.test", { name: "Counselor" });
  await t.run(async (ctx) => {
    for (const p of [s, s2]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, a1, teacher, s, s2, counselor };
}
type World = Awaited<ReturnType<typeof world>>;

const habitArgs = (over: Partial<{ kind: string; title: string; color: string; startOn: string; endOn: string }> = {}) => ({
  kind: "water",
  title: "Eight glasses of water",
  color: HABIT_COLORS[3],
  startOn: TODAY,
  endOn: shiftDay(TODAY, 20),
  ...over,
});
const add = (p: Person, over: Parameters<typeof habitArgs>[0] = {}) => p.as.mutation(api.habits.add, habitArgs(over));
const tick = (p: Person, planId: string, lit = true) => p.as.mutation(api.habits.setToday, { planId, lit });
const list = (p: Person) => p.as.query(api.habits.list, {});
const addOk = async (p: Person, over: Parameters<typeof habitArgs>[0] = {}) => {
  const r = await add(p, over);
  if (!r.ok) throw new Error(`setup ${JSON.stringify(r)}`);
  return r.id;
};
const eventsOf = (w: World, memberId: Id<"members">) => w.t.run(async (ctx) => await ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", memberId)).take(600));
const setTime = (iso: string) => vi.setSystemTime(at(iso));

describe("add, tick and read back (AC-1, AC-3, AC-4, AC-6)", () => {
  test("covers AC-1, AC-4, AC-6: a habit is added, ticked, read back after a reload, and the event holds only the kind", async () => {
    const w = await world();
    const id = await addOk(w.s, { title: "My private habit words" });
    expect(await tick(w.s, id)).toEqual({ ok: true, day: TODAY, lit: true, changed: true });
    const habits = await list(w.s);
    expect(habits).toEqual([{ id, kind: "water", title: "My private habit words", color: HABIT_COLORS[3], startOn: TODAY, endOn: shiftDay(TODAY, 20), ticks: [TODAY] }]);
    const events = await eventsOf(w, w.s.memberId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ room: "habits", type: "habits.ticked", payload: { habit: "water" }, loggedFor: TODAY, late: false });
    expect(events[0].eventKey).toMatch(/^habit:[A-Za-z0-9]+-0$/);
    expect(JSON.stringify(events)).not.toContain("private");
    // Another student sees nothing.
    expect(await list(w.s2)).toEqual([]);
  });

  test("covers AC-3: a tick at 03:59:59.999 and at 04:00 land on different days, and a habit's check day equals the event's day", async () => {
    const w = await world();
    const id = await addOk(w.s);
    setTime("2026-10-20T03:59:59.999+05:30");
    expect(await tick(w.s, id)).toMatchObject({ ok: true, day: TODAY });
    setTime("2026-10-20T04:00:00.000+05:30");
    expect(await tick(w.s, id)).toMatchObject({ ok: true, day: "2026-10-20", changed: true });
    expect((await list(w.s))[0].ticks).toEqual([TODAY, "2026-10-20"]);
    const events = await eventsOf(w, w.s.memberId);
    expect(events.map((e) => e.loggedFor)).toEqual([TODAY, "2026-10-20"]);
  });

  test("covers AC-3: the browser can name no day", async () => {
    const w = await world();
    const id = await addOk(w.s);
    const sneaky = { planId: id, lit: true, day: "2026-10-01" } as unknown as { planId: string; lit: boolean };
    await expect(w.s.as.mutation(api.habits.setToday, sneaky)).rejects.toThrow();
  });

  test("covers AC-3: a tick outside the window or on a removed habit is not_open", async () => {
    const w = await world();
    const future = await addOk(w.s, { startOn: shiftDay(TODAY, 3), endOn: shiftDay(TODAY, 10) });
    expect(await tick(w.s, future)).toEqual({ ok: false, code: "not_open" });
    expect(await tick(w.s, future, false)).toEqual({ ok: false, code: "not_open" });
    const ended = await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      return await ctx.db.insert("habitPlans", { memberId: w.s.memberId, instituteId: m!.instituteId!, kind: "walk", title: "Old", color: HABIT_COLORS[0], startOn: shiftDay(TODAY, -10), endOn: shiftDay(TODAY, -1) });
    });
    expect(await tick(w.s, ended)).toEqual({ ok: false, code: "not_open" });
    expect(await eventsOf(w, w.s.memberId)).toHaveLength(0);
  });

  test("covers AC-3, AC-4: a day later the window shows the old tick and the new day starts unticked, and a missed day is simply absent", async () => {
    const w = await world();
    const id = await addOk(w.s);
    await tick(w.s, id);
    setTime("2026-10-21T10:00:00+05:30"); // two days on: the 20th was missed
    await tick(w.s, id);
    expect((await list(w.s))[0].ticks).toEqual([TODAY, "2026-10-21"]);
    // Nothing is stored for the missed day.
    const rows = await w.t.run(async (ctx) => (await ctx.db.query("habitChecks").take(50)).map((r) => r.day));
    expect(rows).toEqual([TODAY, "2026-10-21"]);
  });
});

describe("the cap and the window (AC-1, AC-2, AC-7)", () => {
  test("covers AC-1: five open habits are fine and the sixth is too_many_habits; removing or an ended habit frees a slot; a future habit is open", async () => {
    const w = await world();
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) ids.push(await addOk(w.s, { title: `H${i}` }));
    ids.push(await addOk(w.s, { title: "Future", startOn: shiftDay(TODAY, 5), endOn: shiftDay(TODAY, 30) }));
    expect(await add(w.s, { title: "Sixth" })).toEqual({ ok: false, code: "too_many_habits" });
    expect(await w.s.as.mutation(api.habits.remove, { planId: ids[0] })).toEqual({ ok: true });
    expect(await add(w.s, { title: "Sixth" })).toMatchObject({ ok: true });
    // An ended habit does not count: make one ended by moving the clock past its end.
    const w2 = await world();
    await addOk(w2.s, { title: "Short", startOn: TODAY, endOn: TODAY });
    for (let i = 0; i < 4; i++) await addOk(w2.s, { title: `H${i}` });
    expect(await add(w2.s, { title: "Over" })).toEqual({ ok: false, code: "too_many_habits" });
    setTime("2026-10-20T10:00:00+05:30");
    expect(await add(w2.s, { title: "Over", startOn: "2026-10-20", endOn: "2026-10-30" })).toMatchObject({ ok: true });
  });

  test("covers AC-1: the cap is per student", async () => {
    const w = await world();
    for (let i = 0; i < 5; i++) await addOk(w.s, { title: `H${i}` });
    expect(await add(w.s2, { title: "Mine" })).toMatchObject({ ok: true });
  });

  test("covers AC-2: the window and fields are checked by the server", async () => {
    const w = await world();
    const bad: [Parameters<typeof habitArgs>[0], string][] = [
      [{ startOn: shiftDay(TODAY, -1) }, "bad_window"],
      [{ startOn: shiftDay(TODAY, 15), endOn: shiftDay(TODAY, 30) }, "bad_window"],
      [{ startOn: TODAY, endOn: shiftDay(TODAY, -1) }, "bad_window"],
      [{ startOn: TODAY, endOn: shiftDay(TODAY, 90) }, "bad_window"],
      [{ startOn: "2026-02-30" }, "bad_window"],
      [{ endOn: "soon" }, "bad_window"],
      [{ title: "" }, "bad_title"],
      [{ title: "   " }, "bad_title"],
      [{ title: "x".repeat(41) }, "bad_title"],
      [{ title: "two\nlines" }, "bad_title"],
      [{ title: "tab\there" }, "bad_title"],
      [{ kind: "yoga" }, "bad_habit"],
      [{ kind: "" }, "bad_habit"],
      [{ color: "#000000" }, "bad_color"],
      [{ color: "green" }, "bad_color"],
    ];
    for (const [over, code] of bad) expect(await add(w.s, over), JSON.stringify(over)).toEqual({ ok: false, code });
    // The edges are allowed: 14 days ahead, 90 days counting both ends, 40 characters, an emoji counts once.
    expect(await add(w.s, { startOn: shiftDay(TODAY, 14), endOn: shiftDay(shiftDay(TODAY, 14), 89) })).toMatchObject({ ok: true });
    expect(await add(w.s, { title: "x".repeat(40) })).toMatchObject({ ok: true });
    expect(await add(w.s, { title: "😀".repeat(40) })).toMatchObject({ ok: true });
    expect(await add(w.s, { title: "😀".repeat(41) })).toEqual({ ok: false, code: "bad_title" });
    expect(await add(w.s, { kind: "custom", title: "  trimmed  " })).toMatchObject({ ok: true });
    expect((await list(w.s)).some((h) => h.title === "trimmed")).toBe(true);
    expect(windowProblem(TODAY, TODAY, TODAY)).toBeNull();
    expect(HABIT_KINDS).toHaveLength(7);
  });

  test("covers AC-7: removing ends the habit and keeps its history; it leaves the list, takes no tick, and a second remove is fine", async () => {
    const w = await world();
    const id = await addOk(w.s);
    const other = await addOk(w.s, { title: "Other" });
    await tick(w.s, id);
    expect(await w.s.as.mutation(api.habits.remove, { planId: id })).toEqual({ ok: true });
    expect(await w.s.as.mutation(api.habits.remove, { planId: id })).toEqual({ ok: true });
    expect((await list(w.s)).map((h) => h.id)).toEqual([other]);
    expect(await tick(w.s, id, false)).toEqual({ ok: false, code: "not_open" });
    expect(await tick(w.s, id, true)).toEqual({ ok: false, code: "not_open" });
    // The rows and the event stay (only an erase deletes them).
    const row = await w.t.run(async (ctx) => await ctx.db.get(id as Id<"habitPlans">));
    expect(row).toMatchObject({ removedOn: TODAY, endOn: shiftDay(TODAY, 20) });
    expect(await w.t.run(async (ctx) => (await ctx.db.query("habitChecks").take(10)).length)).toBe(1);
    expect(await eventsOf(w, w.s.memberId)).toHaveLength(1);
  });
});

describe("undo and flips (AC-5, AC-6)", () => {
  test("covers AC-5, AC-6: an undo is a void that replaces the tick, the day reads as a miss again, and a re-tick replaces the void", async () => {
    const w = await world();
    const id = await addOk(w.s);
    await tick(w.s, id);
    expect(await tick(w.s, id, false)).toEqual({ ok: true, day: TODAY, lit: false, changed: true });
    expect((await list(w.s))[0].ticks).toEqual([]);
    let events = await eventsOf(w, w.s.memberId);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ voided: true, replaces: events[0]._id });
    expect(events[1].payload).toEqual({});
    const current = await w.t.run(async (ctx) => await eventsForDay(ctx, { memberId: w.s.memberId, day: TODAY }));
    expect(current).toEqual([]);
    expect(await tick(w.s, id)).toMatchObject({ changed: true });
    events = await eventsOf(w, w.s.memberId);
    expect(events).toHaveLength(3);
    expect(events[2]).toMatchObject({ replaces: events[1]._id, payload: { habit: "water" } });
    expect((await list(w.s))[0].ticks).toEqual([TODAY]);
  });

  test("covers AC-5: the same state again, or an undo with nothing to undo, writes no row and no event", async () => {
    const w = await world();
    const id = await addOk(w.s);
    expect(await tick(w.s, id, false)).toEqual({ ok: true, day: TODAY, lit: false, changed: false });
    expect(await w.t.run(async (ctx) => (await ctx.db.query("habitChecks").take(10)).length)).toBe(0);
    await tick(w.s, id);
    expect(await tick(w.s, id)).toMatchObject({ ok: true, changed: false });
    expect(await eventsOf(w, w.s.memberId)).toHaveLength(1);
  });

  test("covers AC-5: after the first tick a day can be flipped 6 more times, then too_many_flips; the next day starts fresh", async () => {
    const w = await world();
    const id = await addOk(w.s);
    await tick(w.s, id);
    for (let i = 0; i < MAX_FLIPS; i++) expect(await tick(w.s, id, i % 2 === 1), `flip ${i}`).toMatchObject({ ok: true, changed: true });
    // 6 flips: undo, tick, undo, tick, undo, tick => lit. One more would be the 7th flip.
    expect(await tick(w.s, id, false)).toEqual({ ok: false, code: "too_many_flips" });
    expect((await eventsOf(w, w.s.memberId)).length).toBe(1 + MAX_FLIPS);
    setTime("2026-10-20T10:00:00+05:30");
    expect(await tick(w.s, id, false)).toMatchObject({ changed: false });
    expect(await tick(w.s, id)).toMatchObject({ changed: true });
  });

  test("covers AC-6: if the log refuses the event, the room's row is rolled back too", async () => {
    const w = await world();
    const id = await addOk(w.s);
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      for (let i = 0; i < 500; i++) {
        await ctx.db.insert("events", { memberId: w.s.memberId, actorId: "system", instituteId: m!.instituteId!, room: "test", type: "test.pong", schemaVer: 1, payload: { count: 1 }, occurredAt: NOW, loggedFor: TODAY, late: false, eventKey: `thing:f${i}` });
      }
    });
    expect(await refusal(tick(w.s, id))).toBe("day_full");
    expect(await w.t.run(async (ctx) => (await ctx.db.query("habitChecks").take(10)).length)).toBe(0);
  });
});

describe("ids, gate and privacy (AC-8, AC-9)", () => {
  test("covers AC-8: a bad id, a missing habit and another student's habit all answer not_found", async () => {
    const w = await world();
    const mine = await addOk(w.s);
    expect(await tick(w.s2, mine)).toEqual({ ok: false, code: "not_found" });
    expect(await w.s2.as.mutation(api.habits.remove, { planId: mine })).toEqual({ ok: false, code: "not_found" });
    for (const bad of ["", "nonsense", "k57abc", "../../x"]) {
      expect(await tick(w.s, bad), bad).toEqual({ ok: false, code: "not_found" });
      expect(await w.s.as.mutation(api.habits.remove, { planId: bad }), bad).toEqual({ ok: false, code: "not_found" });
    }
    const gone = await w.t.run(async (ctx) => {
      const id = await ctx.db.insert("habitPlans", { memberId: w.s.memberId, instituteId: (await ctx.db.get(w.s.memberId))!.instituteId!, kind: "walk", title: "x", color: HABIT_COLORS[0], startOn: TODAY, endOn: TODAY });
      await ctx.db.delete(id);
      return id;
    });
    expect(await tick(w.s, gone)).toEqual({ ok: false, code: "not_found" });
    // Nothing of student 1's habit changed.
    expect((await list(w.s))[0].ticks).toEqual([]);
  });

  test("covers AC-8: a student at the gate, one who withdrew, and every other role are refused", async () => {
    const w = await world();
    const gate = await makeStudent(w.t, w.A.admin, w.a1, "gate@alpha.test", false, { consent: false });
    expect(await refusal(add(gate))).toBe("consent_required");
    expect(await refusal(list(gate))).toBe("consent_required");
    await w.s2.as.mutation(api.consent.withdraw, {});
    expect(await refusal(add(w.s2))).toBe("consent_withdrawn");
    expect(await refusal(list(w.s2))).toBe("consent_withdrawn");
    for (const p of [w.teacher, w.A.admin, w.dhi, w.counselor]) {
      expect(await refusal(add(p))).toBe("forbidden");
      expect(await refusal(list(p))).toBe("forbidden");
      expect(await refusal(tick(p, "x"))).toBe("forbidden");
      expect(await refusal(p.as.mutation(api.habits.remove, { planId: "x" }))).toBe("forbidden");
    }
    expect(await refusal(w.t.mutation(api.habits.add, habitArgs()))).toBe("not_signed_in");
  });

  test("covers AC-9: no source touches the habit tables except the room's own files, the schema and the data map", () => {
    const files = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const allowed = ["./habits.ts", "./habitRoom.ts", "./schema.ts", "./dataMap.ts", "./habitProof.ts", "./home.ts", "./brainDay.ts"]; // habitProof.ts: dev only, test sign in guarded. home.ts reads only the student's own tick days (checked in home.test.ts). brainDay.ts reads the plan windows to know how many habits were open on a day (house spec 0019)
    for (const [name, text] of Object.entries(files)) {
      if (name.endsWith(".test.ts")) continue;
      const code = text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      if (/habitPlans|habitChecks/.test(code)) expect(allowed, `${name} touches the habit tables`).toContain(name);
    }
  });

  test("covers AC-6: the title appears in no event, log row or refusal", async () => {
    const w = await world();
    const secret = "my secret habit title";
    const id = await addOk(w.s, { title: secret });
    await tick(w.s, id);
    await tick(w.s, id, false);
    const bad = await add(w.s, { title: secret, kind: "nope" });
    expect(JSON.stringify(bad)).not.toContain("secret");
    const dump = JSON.stringify({
      events: await eventsOf(w, w.s.memberId),
      access: await w.t.run(async (ctx) => await ctx.db.query("accessLog").take(500)),
      view: await w.t.run(async (ctx) => await ctx.db.query("viewLog").take(500)),
      totals: await w.t.run(async (ctx) => await ctx.db.query("classTotals").take(500)),
    });
    expect(dump).not.toContain("secret");
  });
});

describe("the list (AC-4)", () => {
  test("covers AC-4: the list holds the open habits and the 25 newest finished ones, and a removed habit is left out", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      for (let i = 0; i < 40; i++) {
        await ctx.db.insert("habitPlans", { memberId: w.s.memberId, instituteId: m!.instituteId!, kind: "walk", title: `old ${i}`, color: HABIT_COLORS[0], startOn: shiftDay(TODAY, -100 + i), endOn: shiftDay(TODAY, -60 + i) });
      }
      await ctx.db.insert("habitPlans", { memberId: w.s.memberId, instituteId: m!.instituteId!, kind: "walk", title: "removed one", color: HABIT_COLORS[0], startOn: shiftDay(TODAY, -3), endOn: shiftDay(TODAY, 9), removedOn: TODAY });
    });
    for (let i = 0; i < 5; i++) await addOk(w.s, { title: `open ${i}` });
    const habits = await list(w.s);
    expect(habits).toHaveLength(30);
    expect(habits.filter((h) => h.endOn >= TODAY)).toHaveLength(5);
    expect(habits.some((h) => h.title === "removed one")).toBe(false);
    // The newest finished ones are the ones kept.
    expect(habits.filter((h) => h.endOn < TODAY).map((h) => h.title)[0]).toBe("old 39");
  });

  test("covers AC-4: ticks are limited to the habit's own window (at most 91 rows) and a window of 90 days reads exactly", async () => {
    const w = await world();
    const id = await addOk(w.s, { startOn: TODAY, endOn: shiftDay(TODAY, 89) });
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      for (let d = 0; d < 90; d++) {
        await ctx.db.insert("habitChecks", { planId: id as Id<"habitPlans">, memberId: w.s.memberId, instituteId: m!.instituteId!, day: shiftDay(TODAY, d), lit: true, flips: 0 });
      }
      // A stray row outside the window is not returned.
      await ctx.db.insert("habitChecks", { planId: id as Id<"habitPlans">, memberId: w.s.memberId, instituteId: m!.instituteId!, day: shiftDay(TODAY, 120), lit: true, flips: 0 });
    });
    expect((await list(w.s))[0].ticks).toHaveLength(90);
  });
});

describe("the limits (AC-11)", () => {
  test("covers AC-11: the 61st write in an hour is rate_limited exactly, and a refused attempt still counts", async () => {
    const w = await world();
    const id = await addOk(w.s); // write 1
    // A refused add (bad title) is validated after the write limit, so it takes a write token: 59 more writes fit, the 61st does not.
    expect(await add(w.s, { title: "" })).toEqual({ ok: false, code: "bad_title" }); // write 2
    for (let i = 0; i < 58; i++) expect(await w.s.as.mutation(api.habits.remove, { planId: id }), `write ${i + 3}`).toEqual({ ok: true });
    expect(await w.s.as.mutation(api.habits.remove, { planId: id })).toEqual({ ok: false, code: "rate_limited" }); // write 61
    expect(await tick(w.s, id)).toEqual({ ok: false, code: "rate_limited" });
    // Another student has their own 60.
    expect(await add(w.s2)).toMatchObject({ ok: true });
  });

  test("covers AC-11: a refused add (a typing mistake, the cap) never uses up the daily add limit", async () => {
    const w = await world();
    for (let i = 0; i < 12; i++) expect(await add(w.s, { title: "" })).toEqual({ ok: false, code: "bad_title" });
    for (let i = 0; i < 5; i++) await addOk(w.s, { title: `H${i}` });
    // Refused for the cap, not for the daily limit, and still no daily token spent.
    for (let i = 0; i < 3; i++) expect(await add(w.s, { title: "Sixth" })).toEqual({ ok: false, code: "too_many_habits" });
    // A new hour would be needed for more writes; the daily limit has been used 5 times of 10, so 5 more real adds fit once slots open.
    const habits = await list(w.s);
    for (const h of habits.slice(0, 5)) await w.s.as.mutation(api.habits.remove, { planId: h.id });
    vi.setSystemTime(NOW + 61 * 60 * 1000); // a fresh hour for the write limit
    for (let i = 0; i < 5; i++) {
      expect(await add(w.s, { title: `More${i}` })).toMatchObject({ ok: true });
    }
    for (const h of (await list(w.s)).slice(0, 5)) await w.s.as.mutation(api.habits.remove, { planId: h.id });
    expect(await add(w.s, { title: "Eleventh" })).toEqual({ ok: false, code: "too_many_adds" });
  });

  test("covers AC-11: only 10 habits can be added in a day, however many are removed between", async () => {
    const w = await world();
    for (let i = 0; i < 10; i++) {
      const id = await addOk(w.s, { title: `H${i}` });
      await w.s.as.mutation(api.habits.remove, { planId: id });
    }
    expect(await add(w.s, { title: "Eleventh" })).toEqual({ ok: false, code: "too_many_adds" });
    // Another student is not affected, and the next day opens again.
    expect(await add(w.s2)).toMatchObject({ ok: true });
  });
});

describe("export and erase (AC-10)", () => {
  async function fill(w: World, plans: number, checksEach: number) {
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      for (let i = 0; i < plans; i++) {
        const id = await ctx.db.insert("habitPlans", { memberId: w.s.memberId, instituteId: m!.instituteId!, kind: "walk", title: `plan ${i}`, color: HABIT_COLORS[0], startOn: shiftDay(TODAY, -200), endOn: shiftDay(TODAY, -111) });
        for (let d = 0; d < checksEach; d++) {
          await ctx.db.insert("habitChecks", { planId: id, memberId: w.s.memberId, instituteId: m!.instituteId!, day: shiftDay(TODAY, -200 + d), lit: d % 2 === 0, flips: 0 });
        }
      }
    });
  }

  test("covers AC-10: the export holds the student's habits with their ticked days, 25 a page, and nothing of anyone else", async () => {
    const w = await world();
    await fill(w, 30, 6);
    await addOk(w.s2, { title: "not mine" });
    const rows: { title: string; ticks: string[]; removedOn: string | null }[] = [];
    let cursor: string | null | undefined = undefined;
    const sections: string[] = [];
    for (let i = 0; i < 30; i++) {
      const r = (await w.s.as.mutation(api.dataRights.exportMine, { cursor })) as { ok: true; section: string; rows: typeof rows; next: string | null };
      sections.push(r.section);
      if (r.section === "habits") {
        expect(r.rows.length).toBeLessThanOrEqual(25);
        rows.push(...r.rows);
      }
      if (r.next === null) break;
      cursor = r.next;
    }
    expect(sections.filter((s) => s === "habits")).toHaveLength(2);
    expect(rows).toHaveLength(30);
    expect(rows[0]).toMatchObject({ title: "plan 0", removedOn: null });
    expect(rows[0].ticks).toHaveLength(3); // days 0, 2 and 4 of the six are lit
    expect(Object.keys(rows[0]).sort()).toEqual(["color", "endOn", "kind", "removedOn", "startOn", "ticks", "title"]);
    expect(JSON.stringify(rows)).not.toContain("not mine");
  });

  test("covers AC-10: an erase with more than one page of rows leaves none, and another student's habits stay", async () => {
    const w = await world();
    await fill(w, 8, 60); // 480 checks, several pages
    const mine = await addOk(w.s2, { title: "stays" });
    await tick(w.s2, mine);
    expect(await w.s.as.mutation(api.dataRights.eraseMine, { confirm: true })).toEqual({ ok: true });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    const left = await w.t.run(async (ctx) => ({
      plans: (await ctx.db.query("habitPlans").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).take(50)).length,
      checks: (await ctx.db.query("habitChecks").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).take(50)).length,
    }));
    expect(left).toEqual({ plans: 0, checks: 0 });
    expect((await list(w.s2)).map((h) => h.id)).toEqual([mine]);
    const receipts = await w.t.run(async (ctx) => await ctx.db.query("houseErasures").take(5));
    expect(receipts[0].counts).toMatchObject({ habits: 488 });
  });

  test("covers AC-10: both tables are in the data map as erased, and the room is registered with its kind", async () => {
    const { DATA_MAP } = await import("./dataMap");
    expect(DATA_MAP.habitPlans.class).toBe("erased");
    expect(DATA_MAP.habitChecks.class).toBe("erased");
    const { ROOM_ENTRIES } = await import("./roomRegistry");
    expect(ROOM_ENTRIES.find((e) => e.room === "habits")).toMatchObject({ table: "habitPlans", kinds: ["habits"] });
    const { eventDef } = await import("./eventRegistry");
    expect(eventDef("habits", "habits.ticked")?.version).toBe(1);
  });
});
