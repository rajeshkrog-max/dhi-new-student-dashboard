/// <reference types="vite/client" />
// The room event log (spec house/0004). Time is fixed with a fake clock so the day edges are exact. Each test names the criterion it covers.
// The log is called the way a room calls it: inside one transaction (`t.run`), with the actor built the way `requireMember` builds it.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { dayOf } from "./dayRules";
import { currentFor, dayStatus, eventsForDay, recordEvent, recordSystemEvent, type EventActor, type RecordInput } from "./eventLog";
import { checkPayload, defineEvent, isEventKey, type EventDef } from "./eventShapes";
import { EVENT_DEFS } from "./eventRegistry";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
// 10:00 on 19 October 2026, India time. The student joins now.
const T0 = at("2026-10-19T10:00:00+05:30");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const teacher2 = await makeTeacher(t, A.admin, "teacher2@alpha.test", [a2]);
  const teacherB = await makeTeacher(t, B.admin, "teacher@beta.test", [b1]);
  const student = await makeStudent(t, A.admin, a1, "sa@alpha.test");
  const student2 = await makeStudent(t, A.admin, a1, "sa2@alpha.test");
  const studentB = await makeStudent(t, B.admin, b1, "sb@beta.test");
  await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counselor@dhi.test", name: "Counselor" });
  const counselor = await joinAs(t, "counselor@dhi.test", { name: "Counselor" });
  // Everyone joined long ago, so the days around "today" are open; the tests that are about the join day set it themselves.
  await t.run(async (ctx) => {
    for (const p of [student, student2, studentB]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-10-01T10:00:00+05:30") });
  });
  return { t, dhi, A, B, a1, a2, b1, teacher, teacher2, teacherB, student, student2, studentB, counselor };
}
type World = Awaited<ReturnType<typeof world>>;

// The actor the way `requireMember` builds it: the member row, the role, and a teacher's current classes.
async function actorOf(ctx: Parameters<Parameters<World["t"]["run"]>[0]>[0], memberId: Id<"members">): Promise<EventActor> {
  const member = await ctx.db.get(memberId);
  if (!member) throw new Error("setup");
  const classIds = member.role === "teacher" ? (await ctx.db.query("teacherClasses").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(50)).map((r) => r.classId) : member.classId ? [member.classId] : [];
  return { member, role: member.role, classIds };
}

let counter = 0;
const nextKey = () => `thing:k${++counter}`;
type Over = Partial<RecordInput>;
const input = (w: World, over: Over = {}): RecordInput => ({
  memberId: w.student.memberId,
  room: "test",
  type: "test.ping",
  payload: { count: 1 },
  occurredAt: Date.now(),
  eventKey: nextKey(),
  ...over,
});
// A room's mutation: record as `actor`, in one transaction.
const rec = (w: World, actor: Person, over: Over = {}) =>
  w.t.run(async (ctx) => await recordEvent(ctx, { by: await actorOf(ctx, actor.memberId), ...input(w, over) }));

const code = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
    return "ok";
  } catch (e) {
    const data = (e as { data?: { code?: string } }).data;
    return data?.code ?? `error:${String((e as Error).message).slice(0, 80)}`;
  }
};
const day = (w: World, d: string, memberId = w.student.memberId, extra: { room?: string; types?: string[]; today?: string; includeVoided?: boolean } = {}) =>
  w.t.run(async (ctx) => await dayStatus(ctx, { memberId, day: d, ...extra }));
const eventsOn = (w: World, d: string, memberId = w.student.memberId, includeVoided = false) =>
  w.t.run(async (ctx) => await eventsForDay(ctx, { memberId, day: d, includeVoided }));
const countAll = (w: World) => w.t.run(async (ctx) => (await ctx.db.query("events").take(5000)).length);
const setTime = (iso: string) => vi.setSystemTime(at(iso));

describe("the thread: record and read back (AC-1, AC-16)", () => {
  test("covers AC-1: a room records an event about a student and reads it back by student and day", async () => {
    const w = await world();
    const r = await rec(w, w.student, { payload: { count: 7 }, eventKey: "thing:one" });
    expect(r).toMatchObject({ loggedFor: "2026-10-19", late: false, duplicate: false });
    const rows = await eventsOn(w, "2026-10-19");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ _id: r.eventId, memberId: w.student.memberId, actorId: w.student.memberId, room: "test", type: "test.ping", schemaVer: 2, payload: { count: 7 }, eventKey: "thing:one" });
    expect(rows[0].instituteId).toBe(w.A.instituteId);
    expect(rows[0].classId).toBe(w.a1);
  });

  test("covers AC-1: if the event is refused, the room's own write is rolled back too", async () => {
    const w = await world();
    const before = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).length);
    const outcome = await code(
      w.t.run(async (ctx) => {
        // The room's own row (a stand in: any row of the room), then the event, which is refused.
        await ctx.db.insert("accessLog", { at: Date.now(), actor: w.student.memberId, action: "class.create" });
        return await recordEvent(ctx, { by: await actorOf(ctx, w.student.memberId), ...input(w, { payload: { count: -1 } }) });
      }),
    );
    expect(outcome).toBe("bad_payload");
    const after = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).length);
    expect(after).toBe(before);
    expect(await countAll(w)).toBe(0);
  });

  test("covers AC-1: when the event is accepted, the room's row and the event are both kept", async () => {
    const w = await world();
    const before = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).length);
    await w.t.run(async (ctx) => {
      await ctx.db.insert("accessLog", { at: Date.now(), actor: w.student.memberId, action: "class.create" });
      return await recordEvent(ctx, { by: await actorOf(ctx, w.student.memberId), ...input(w) });
    });
    expect((await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).length))).toBe(before + 1);
    expect(await countAll(w)).toBe(1);
  });

  test("covers AC-3: no caller can set the day; an extra loggedFor in the input is ignored and the day comes from the time", async () => {
    const w = await world();
    const sneaky = { ...input(w, { occurredAt: at("2026-10-19T09:00:00+05:30") }), loggedFor: "2026-10-15" } as RecordInput;
    const r = await w.t.run(async (ctx) => await recordEvent(ctx, { by: await actorOf(ctx, w.student.memberId), ...sneaky }));
    expect(r.loggedFor).toBe("2026-10-19");
    const rows = await w.t.run(async (ctx) => await ctx.db.query("events").take(5));
    expect(rows[0].loggedFor).toBe(dayOf(rows[0].occurredAt));
  });

  test("covers AC-2, AC-3: a meal at 01:00 counts for the day before, and 04:00 sharp for the next", async () => {
    const w = await world();
    setTime("2026-10-19T09:00:00+05:30");
    const a = await rec(w, w.student, { occurredAt: at("2026-10-19T01:00:00+05:30") });
    const b = await rec(w, w.student, { occurredAt: at("2026-10-19T03:59:59.999+05:30") });
    const c = await rec(w, w.student, { occurredAt: at("2026-10-19T04:00:00.000+05:30") });
    expect([a.loggedFor, b.loggedFor, c.loggedFor]).toEqual(["2026-10-18", "2026-10-18", "2026-10-19"]);
  });

  test("covers AC-2: a month end, a year end and 29 February land on the right day", async () => {
    const w = await world();
    setTime("2028-03-01T09:00:00+05:30");
    // Joined long before: move the member's join time back so these old days are open.
    await w.t.run(async (ctx) => ctx.db.patch(w.student.memberId, { joinedAt: at("2020-01-01T00:00:00+05:30") }));
    const got = [
      await rec(w, w.student, { occurredAt: at("2028-03-01T02:00:00+05:30") }),
      await rec(w, w.student, { occurredAt: at("2028-03-01T04:00:00+05:30") }),
    ];
    expect(got.map((g) => g.loggedFor)).toEqual(["2028-02-29", "2028-03-01"]);
    setTime("2027-01-01T09:00:00+05:30");
    const ye = await rec(w, w.student, { occurredAt: at("2027-01-01T03:00:00+05:30") });
    expect(ye.loggedFor).toBe("2026-12-31");
    setTime("2026-11-01T09:00:00+05:30");
    const me = await rec(w, w.student, { occurredAt: at("2026-11-01T01:00:00+05:30") });
    expect(me.loggedFor).toBe("2026-10-31");
  });

  test("covers AC-16: eventsForDay returns one student's day only, sorted by time, then creation, then id, and never another student's", async () => {
    const w = await world();
    await rec(w, w.student, { occurredAt: at("2026-10-19T09:30:00+05:30"), payload: { count: 3 } });
    await rec(w, w.student, { occurredAt: at("2026-10-19T08:00:00+05:30"), payload: { count: 1 } });
    // Two events at the same instant: creation order breaks the tie.
    await rec(w, w.student, { occurredAt: at("2026-10-19T08:30:00+05:30"), payload: { count: 2 } });
    await rec(w, w.student, { occurredAt: at("2026-10-19T08:30:00+05:30"), payload: { count: 22 } });
    await rec(w, w.student2, { memberId: w.student2.memberId, payload: { count: 99 } });
    await rec(w, w.student, { occurredAt: at("2026-10-18T09:00:00+05:30"), payload: { count: 50 } });
    const rows = await eventsOn(w, "2026-10-19");
    expect(rows.map((r) => (r.payload as { count: number }).count)).toEqual([1, 2, 22, 3]);
    expect(rows.every((r) => r.memberId === w.student.memberId)).toBe(true);
    const other = await eventsOn(w, "2026-10-19", w.student2.memberId);
    expect(other.map((r) => (r.payload as { count: number }).count)).toEqual([99]);
  });

  test("covers AC-16: a bad day is refused", async () => {
    const w = await world();
    expect(await code(eventsOn(w, "2026-02-30"))).toBe("bad_day");
    expect(await code(eventsOn(w, "tomorrow"))).toBe("bad_day");
  });
});

describe("retries (AC-4)", () => {
  test("covers AC-4: the same key and content is stored once, and the second call returns the first event as duplicate", async () => {
    const w = await world();
    const same = { eventKey: "thing:retry", payload: { count: 4 }, occurredAt: at("2026-10-19T09:00:00+05:30") };
    const a = await rec(w, w.student, same);
    const b = await rec(w, w.student, same);
    expect(b).toEqual({ ...a, duplicate: true });
    expect(a.duplicate).toBe(false);
    expect(await countAll(w)).toBe(1);
  });

  test("covers AC-4: the retry returns the stored day and lateness, even when the clock has moved on", async () => {
    const w = await world();
    const same = { eventKey: "thing:late", occurredAt: at("2026-10-18T20:00:00+05:30") };
    const a = await rec(w, w.student, same);
    expect(a).toMatchObject({ loggedFor: "2026-10-18", late: true });
    setTime("2026-10-21T10:00:00+05:30");
    const b = await rec(w, w.student, same);
    expect(b).toMatchObject({ eventId: a.eventId, loggedFor: "2026-10-18", late: true, duplicate: true });
  });

  test("covers AC-4: the actor is left out of the content, so the student's retry through a teacher is still a retry", async () => {
    const w = await world();
    const same = { eventKey: "thing:actor", payload: { count: 2 } };
    const a = await rec(w, w.student, same);
    const b = await rec(w, w.teacher, same);
    expect(b.eventId).toBe(a.eventId);
    expect(b.duplicate).toBe(true);
  });

  test("covers AC-4: the same key with different content is key_conflict and changes nothing", async () => {
    const w = await world();
    const base = { eventKey: "thing:conflict", payload: { count: 1 }, occurredAt: at("2026-10-19T09:00:00+05:30"), about: "thing:x" };
    await rec(w, w.student, base);
    const variants: Over[] = [
      { payload: { count: 2 } },
      { type: "test.pong" },
      { occurredAt: at("2026-10-19T09:00:00.001+05:30") },
      { about: "thing:y" },
      { about: undefined },
      { void: true, payload: undefined },
    ];
    for (const v of variants) expect(await code(rec(w, w.student, { ...base, ...v })), JSON.stringify(v)).toBe("key_conflict");
    expect(await countAll(w)).toBe(1);
  });

  test("covers AC-4: a key belongs to a student, so two students may use the same key", async () => {
    const w = await world();
    const a = await rec(w, w.student, { eventKey: "thing:shared" });
    const b = await rec(w, w.student2, { eventKey: "thing:shared", memberId: w.student2.memberId });
    expect(a.eventId).not.toBe(b.eventId);
    expect(await countAll(w)).toBe(2);
  });

  test("covers AC-4: a key order difference in the payload is the same content", async () => {
    const w = await world();
    const a = await rec(w, w.student, { eventKey: "thing:order", payload: { count: 1, level: "low" } });
    const b = await rec(w, w.student, { eventKey: "thing:order", payload: { level: "low", count: 1 } });
    expect(b.duplicate).toBe(true);
    expect(b.eventId).toBe(a.eventId);
  });
});

describe("the cap (AC-11)", () => {
  test("covers AC-11: the 501st stored event of a day is refused with day_full and the room's row rolls back; a duplicate adds none", async () => {
    const w = await world();
    // 500 rows straight into the table (the cap counts every stored row), then the 501st through the log.
    await w.t.run(async (ctx) => {
      const student = await ctx.db.get(w.student.memberId);
      for (let i = 0; i < 500; i++) {
        await ctx.db.insert("events", {
          memberId: w.student.memberId,
          actorId: w.student.memberId,
          instituteId: student!.instituteId!,
          room: "test",
          type: "test.pong",
          schemaVer: 1,
          payload: { count: 1 },
          occurredAt: T0,
          loggedFor: "2026-10-19",
          late: false,
          eventKey: `thing:fill${i}`,
        });
      }
    });
    const before = await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).length);
    const outcome = await code(
      w.t.run(async (ctx) => {
        await ctx.db.insert("accessLog", { at: Date.now(), actor: w.student.memberId, action: "class.create" });
        return await recordEvent(ctx, { by: await actorOf(ctx, w.student.memberId), ...input(w, { eventKey: "thing:over" }) });
      }),
    );
    expect(outcome).toBe("day_full");
    expect(await w.t.run(async (ctx) => (await ctx.db.query("accessLog").take(500)).length)).toBe(before);
    // A retry of one of the 500 is a duplicate, not a refusal, and adds no row.
    const dup = await rec(w, w.student, { eventKey: "thing:fill7", type: "test.pong", payload: { count: 1 }, occurredAt: T0 });
    expect(dup.duplicate).toBe(true);
    // Another day is not affected.
    const other = await rec(w, w.student, { occurredAt: at("2026-10-18T09:00:00+05:30") });
    expect(other.loggedFor).toBe("2026-10-18");
  });

  test("covers AC-11: replaced and voided rows count toward the cap", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const student = await ctx.db.get(w.student.memberId);
      for (let i = 0; i < 499; i++) {
        await ctx.db.insert("events", {
          memberId: w.student.memberId,
          actorId: "system",
          instituteId: student!.instituteId!,
          room: "test",
          type: "test.pong",
          schemaVer: 1,
          payload: { count: 1 },
          occurredAt: T0,
          loggedFor: "2026-10-19",
          late: false,
          eventKey: `thing:fill${i}`,
          about: "thing:same",
        });
      }
    });
    // 499 rows replaced each other; the 500th is still allowed and the 501st is not.
    await rec(w, w.student, { about: "thing:same", type: "test.pong", eventKey: "thing:n500" });
    expect(await code(rec(w, w.student, { about: "thing:same", type: "test.pong", eventKey: "thing:n501" }))).toBe("day_full");
  });
});

describe("time limits (AC-5, AC-6)", () => {
  test("covers AC-6: an event written on a later day than its day is marked late", async () => {
    const w = await world();
    const onTime = await rec(w, w.student, { occurredAt: at("2026-10-19T09:00:00+05:30") });
    const late = await rec(w, w.student, { occurredAt: at("2026-10-18T20:00:00+05:30") });
    expect(onTime.late).toBe(false);
    expect(late.late).toBe(true);
    // 02:00 on the 19th is still the 18th, so a thing for the 18th written then is on time.
    setTime("2026-10-19T02:00:00+05:30");
    const early = await rec(w, w.student, { occurredAt: at("2026-10-18T23:00:00+05:30") });
    expect(early.late).toBe(false);
  });

  test("covers AC-6: exactly 5 minutes ahead is allowed, 5 minutes and 1 ms is refused", async () => {
    const w = await world();
    expect((await rec(w, w.student, { occurredAt: T0 + 5 * 60 * 1000 })).duplicate).toBe(false);
    expect(await code(rec(w, w.student, { occurredAt: T0 + 5 * 60 * 1000 + 1 }))).toBe("in_future");
  });

  test("covers AC-6: at 03:57 a time of 04:01 is refused because it belongs to the next day", async () => {
    const w = await world();
    await w.t.run(async (ctx) => ctx.db.patch(w.student.memberId, { joinedAt: at("2026-10-10T10:00:00+05:30") }));
    setTime("2026-10-19T03:57:00+05:30");
    expect(await code(rec(w, w.student, { occurredAt: at("2026-10-19T04:01:00+05:30") }))).toBe("in_future");
    expect(await code(rec(w, w.student, { occurredAt: at("2026-10-19T03:59:00+05:30") }))).toBe("ok");
  });

  test("covers AC-6: 7 days back is allowed and 8 is too_old", async () => {
    const w = await world();
    await w.t.run(async (ctx) => ctx.db.patch(w.student.memberId, { joinedAt: at("2026-09-01T00:00:00+05:30") }));
    const seven = await rec(w, w.student, { occurredAt: at("2026-10-12T12:00:00+05:30") });
    expect(seven.loggedFor).toBe("2026-10-12");
    expect(await code(rec(w, w.student, { occurredAt: at("2026-10-11T12:00:00+05:30") }))).toBe("too_old");
  });

  test("covers AC-6: a day before the day the person joined is before_joined", async () => {
    const w = await world();
    // Joined at 10:00 on the 19th, so the 18th is closed to them even though it is within 7 days.
    await w.t.run(async (ctx) => ctx.db.patch(w.student.memberId, { joinedAt: T0 }));
    expect(await code(rec(w, w.student, { occurredAt: at("2026-10-18T12:00:00+05:30") }))).toBe("before_joined");
    // The joined day itself is open, and so is a time earlier that day.
    expect(await code(rec(w, w.student, { occurredAt: at("2026-10-19T04:30:00+05:30") }))).toBe("ok");
  });

  test("covers AC-6: a joined time of 02:00 belongs to the day before, so that day is open", async () => {
    const w = await world();
    await w.t.run(async (ctx) => ctx.db.patch(w.student.memberId, { joinedAt: at("2026-10-19T02:00:00+05:30") }));
    expect(await code(rec(w, w.student, { occurredAt: at("2026-10-18T12:00:00+05:30") }))).toBe("ok");
    expect(await code(rec(w, w.student, { occurredAt: at("2026-10-17T12:00:00+05:30") }))).toBe("before_joined");
  });

  test("covers AC-6: the time must be a real number", async () => {
    const w = await world();
    expect(await code(rec(w, w.student, { occurredAt: Number.NaN }))).toBe("bad_time");
    expect(await code(rec(w, w.student, { occurredAt: Number.POSITIVE_INFINITY }))).toBe("bad_time");
  });

  test("covers AC-5: dayStatus answers future, beforeJoined, logged and notLogged, and writes nothing", async () => {
    const w = await world();
    await w.t.run(async (ctx) => ctx.db.patch(w.student.memberId, { joinedAt: at("2026-10-15T10:00:00+05:30") }));
    await rec(w, w.student, { occurredAt: at("2026-10-18T09:00:00+05:30") });
    expect(await day(w, "2026-10-20")).toBe("future");
    expect(await day(w, "2026-10-14")).toBe("beforeJoined");
    expect(await day(w, "2026-10-18")).toBe("logged");
    expect(await day(w, "2026-10-17")).toBe("notLogged");
    expect(await day(w, "2026-10-19")).toBe("notLogged");
    expect(await countAll(w)).toBe(1);
  });

  test("covers AC-5: a query passes its own today", async () => {
    const w = await world();
    expect(await day(w, "2026-10-20", w.student.memberId, { today: "2026-10-20" })).toBe("notLogged");
    expect(await day(w, "2026-10-20", w.student.memberId, { today: "2026-10-19" })).toBe("future");
  });

  test("covers AC-5: dayStatus can be narrowed to a room or some types", async () => {
    const w = await world();
    await rec(w, w.student, { type: "test.pong" });
    expect(await day(w, "2026-10-19", w.student.memberId, { room: "test" })).toBe("logged");
    expect(await day(w, "2026-10-19", w.student.memberId, { room: "meals" })).toBe("notLogged");
    expect(await day(w, "2026-10-19", w.student.memberId, { types: ["test.pong"] })).toBe("logged");
    expect(await day(w, "2026-10-19", w.student.memberId, { types: ["test.ping"] })).toBe("notLogged");
  });

  test("covers AC-5: a malformed day is bad_day and an empty types list is refused", async () => {
    const w = await world();
    expect(await code(day(w, "2026-13-01"))).toBe("bad_day");
    expect(await code(day(w, "19-10-2026"))).toBe("bad_day");
    expect(await code(day(w, "2026-10-19", w.student.memberId, { types: [] }))).toBe("bad_types");
  });

  test("covers AC-5: a day whose events were all replaced by voids reads notLogged", async () => {
    const w = await world();
    const first = await rec(w, w.student, { about: "thing:h1", eventKey: "thing:e1" });
    expect(await day(w, "2026-10-19")).toBe("logged");
    await rec(w, w.student, { about: "thing:h1", eventKey: "thing:e2", void: true, payload: undefined, replaces: first.eventId });
    expect(await day(w, "2026-10-19")).toBe("notLogged");
    expect(await countAll(w)).toBe(2);
  });
});

describe("corrections and undo (AC-7)", () => {
  test("covers AC-7: a correction keeps the old event and readers see only the new one", async () => {
    const w = await world();
    const first = await rec(w, w.student, { about: "thing:m1", eventKey: "thing:c1", payload: { count: 1 } });
    const second = await rec(w, w.student, { about: "thing:m1", eventKey: "thing:c2", payload: { count: 5 }, replaces: first.eventId });
    const rows = await eventsOn(w, "2026-10-19");
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe(second.eventId);
    expect(rows[0].replaces).toBe(first.eventId);
    expect(await countAll(w)).toBe(2);
    const cur = await w.t.run(async (ctx) => await currentFor(ctx, { memberId: w.student.memberId, about: "thing:m1", day: "2026-10-19" }));
    expect(cur?._id).toBe(second.eventId);
  });

  test("covers AC-7: a void makes the day not logged again, and a new event after it logs it again", async () => {
    const w = await world();
    const first = await rec(w, w.student, { about: "thing:v1", eventKey: "thing:v-a" });
    const gone = await rec(w, w.student, { about: "thing:v1", eventKey: "thing:v-b", void: true, payload: undefined, replaces: first.eventId });
    expect(await eventsOn(w, "2026-10-19")).toHaveLength(0);
    const withVoided = await eventsOn(w, "2026-10-19", w.student.memberId, true);
    expect(withVoided.map((r) => r._id)).toEqual([gone.eventId]);
    expect(withVoided[0].voided).toBe(true);
    expect(await day(w, "2026-10-19")).toBe("notLogged");
    await rec(w, w.student, { about: "thing:v1", eventKey: "thing:v-c", replaces: gone.eventId });
    expect(await day(w, "2026-10-19")).toBe("logged");
    expect(await eventsOn(w, "2026-10-19")).toHaveLength(1);
  });

  test("covers AC-7: a late fix keeps the first event's lateness, so it never turns an on time day late", async () => {
    const w = await world();
    const first = await rec(w, w.student, { about: "thing:l1", eventKey: "thing:l-a", occurredAt: at("2026-10-19T09:00:00+05:30") });
    expect(first.late).toBe(false);
    setTime("2026-10-21T10:00:00+05:30");
    // The day is 2 days old now, but the fix is for the thing logged on time.
    const fix = await rec(w, w.student, { about: "thing:l1", eventKey: "thing:l-b", occurredAt: at("2026-10-19T09:00:00+05:30"), payload: { count: 9 }, replaces: first.eventId });
    expect(fix.late).toBe(false);
    // And a thing first logged late stays late after an on time looking fix.
    const lateFirst = await rec(w, w.student, { about: "thing:l2", eventKey: "thing:l-c", occurredAt: at("2026-10-20T09:00:00+05:30") });
    expect(lateFirst.late).toBe(true);
  });

  test("covers AC-7: a correction never moves an event to another day; the right day gets a new entry", async () => {
    const w = await world();
    await w.t.run(async (ctx) => ctx.db.patch(w.student.memberId, { joinedAt: at("2026-10-10T10:00:00+05:30") }));
    const first = await rec(w, w.student, { about: "thing:d1", eventKey: "thing:d-a", occurredAt: at("2026-10-19T09:00:00+05:30") });
    expect(await code(rec(w, w.student, { about: "thing:d1", eventKey: "thing:d-b", occurredAt: at("2026-10-18T09:00:00+05:30"), replaces: first.eventId }))).toBe("replaces_mismatch");
    const right = await rec(w, w.student, { about: "thing:d1", eventKey: "thing:d-c", occurredAt: at("2026-10-18T09:00:00+05:30") });
    expect(right.loggedFor).toBe("2026-10-18");
    expect(await eventsOn(w, "2026-10-19")).toHaveLength(1);
  });

  test("covers AC-7: a correction across students, things, rooms, types or without a thing is replaces_mismatch", async () => {
    const w = await world();
    const first = await rec(w, w.student, { about: "thing:r1", eventKey: "thing:r-a" });
    const bad: Over[] = [
      { memberId: w.student2.memberId, about: "thing:r1" },
      { about: "thing:other" },
      { about: undefined },
      { type: "test.pong" },
    ];
    // A DHI admin may record about anyone, so only the correction itself is in question.
    for (const b of bad) expect(await code(rec(w, w.dhi, { memberId: w.student.memberId, eventKey: nextKey(), replaces: first.eventId, ...b })), JSON.stringify(b)).toBe("replaces_mismatch");
    const missing = await w.t.run(async (ctx) => {
      const id = await ctx.db.insert("events", { memberId: w.student.memberId, actorId: "system", instituteId: w.A.instituteId, room: "test", type: "test.ping", schemaVer: 1, payload: { count: 1 }, occurredAt: T0, loggedFor: "2026-10-19", late: false, eventKey: "thing:gone" });
      await ctx.db.delete(id);
      return id;
    });
    expect(await code(rec(w, w.student, { about: "thing:r1", replaces: missing }))).toBe("replaces_mismatch");
  });

  test("covers AC-7: a newer version of the type may correct an older event", async () => {
    const w = await world();
    const old = await w.t.run(async (ctx) =>
      ctx.db.insert("events", { memberId: w.student.memberId, actorId: "system", instituteId: w.A.instituteId, room: "test", type: "test.ping", schemaVer: 1, payload: { count: 1 }, occurredAt: T0, loggedFor: "2026-10-19", late: false, eventKey: "thing:v1", about: "thing:ver" }),
    );
    const fixed = await rec(w, w.student, { about: "thing:ver", replaces: old });
    expect(fixed.duplicate).toBe(false);
    const rows = await eventsOn(w, "2026-10-19");
    expect(rows.map((r) => r.schemaVer)).toEqual([2]);
  });

  test("covers AC-7: a void must say which thing it undoes, and carries no payload", async () => {
    const w = await world();
    expect(await code(rec(w, w.student, { void: true, payload: undefined }))).toBe("bad_void");
    expect(await code(rec(w, w.student, { void: true, about: "thing:x", payload: { count: 1 } }))).toBe("bad_payload");
  });

  test("covers AC-7: currentFor returns null when there is nothing, and checks its inputs", async () => {
    const w = await world();
    const none = await w.t.run(async (ctx) => await currentFor(ctx, { memberId: w.student.memberId, about: "thing:none", day: "2026-10-19" }));
    expect(none).toBeNull();
    expect(await code(w.t.run(async (ctx) => await currentFor(ctx, { memberId: w.student.memberId, about: "thing:none", day: "bad" })))).toBe("bad_day");
    expect(await code(w.t.run(async (ctx) => await currentFor(ctx, { memberId: w.student.memberId, about: "NOPE", day: "2026-10-19" })))).toBe("bad_key");
  });

  test("covers AC-7: events with no thing are each their own", async () => {
    const w = await world();
    await rec(w, w.student, {});
    await rec(w, w.student, {});
    expect(await eventsOn(w, "2026-10-19")).toHaveLength(2);
  });
});

describe("the registry, the payload and the keys (AC-8)", () => {
  test("covers AC-8: an unknown type, a type under the wrong room and a room that does not exist are unknown_type", async () => {
    const w = await world();
    expect(await code(rec(w, w.student, { type: "test.nothing" }))).toBe("unknown_type");
    expect(await code(rec(w, w.student, { room: "meals" }))).toBe("unknown_type");
    expect(await code(rec(w, w.student, { room: "nowhere" }))).toBe("unknown_type");
  });

  test("covers AC-8: a type defined but not listed in the static registry is refused", async () => {
    const w = await world();
    const unlisted = defineEvent({ room: "test", type: "test.unlisted", version: 1, payload: { count: { kind: "int" } } });
    expect(EVENT_DEFS.includes(unlisted)).toBe(false);
    expect(await code(rec(w, w.student, { type: "test.unlisted" }))).toBe("unknown_type");
  });

  test("covers AC-8: a payload that does not match is bad_payload", async () => {
    const w = await world();
    const bad: Array<Record<string, unknown> | undefined> = [
      undefined,
      {},
      { count: "1" },
      { count: 1.5 },
      { count: -1 },
      { count: 1001 },
      { count: Number.NaN },
      { count: 1, level: "extreme" },
      { count: 1, flag: "yes" },
      { count: 1, ref: "has space" },
      { count: 1, ref: "a".repeat(65) },
      { count: 1, unknown: 1 },
      { count: 1, picks: [1, "2"] },
      { count: 1, picks: Array.from({ length: 11 }, () => 1) },
      { count: 1, extra: { c: 1 } },
      { count: 1, extra: { a: 1.5 } },
      { count: 1, extra: { a: { deeper: 1 } } },
      { count: 1, score: Number.POSITIVE_INFINITY },
    ];
    for (const payload of bad) expect(await code(rec(w, w.student, { payload })), JSON.stringify(payload)).toBe("bad_payload");
    const good = await rec(w, w.student, { payload: { count: 1, level: "mid", flag: false, ref: "k57abc_DEF-1", score: 55.5, picks: [1, 2, 3], extra: { a: 3, b: "y" } } });
    expect(good.duplicate).toBe(false);
  });

  test("covers AC-8: a payload over 2 KB is payload_too_big, measured in UTF-8 bytes", async () => {
    const w = await world();
    expect(await code(rec(w, w.student, { payload: { count: 1, pad: "x".repeat(2100) } }))).toBe("payload_too_big");
    // 700 three byte characters are 2100 bytes of text although only 700 characters.
    expect(await code(rec(w, w.student, { payload: { count: 1, pad: "€".repeat(700) } }))).toBe("payload_too_big");
    const def: EventDef = defineEvent({ room: "test", type: "test.big", version: 1, payload: { ids: { kind: "list", of: { kind: "id" }, max: 100 } } });
    const ids = Array.from({ length: 40 }, (_, i) => `${String(i).padStart(2, "0")}${"a".repeat(62)}`);
    expect(checkPayload(def, { ids })).toBe("payload_too_big");
    expect(checkPayload(def, { ids: ids.slice(0, 20) })).toBeNull();
  });

  test("covers AC-8: the registry cannot hold a free text field", () => {
    const text = { kind: "text" } as unknown as { kind: "int" };
    expect(() => defineEvent({ room: "test", type: "test.words", version: 1, payload: { note: text } })).toThrow();
    const str = { kind: "string" } as unknown as { kind: "int" };
    expect(() => defineEvent({ room: "test", type: "test.words", version: 1, payload: { note: str } })).toThrow();
    expect(() => defineEvent({ room: "test", type: "test.words", version: 1, payload: { note: { kind: "list", of: str as never, max: 3 } } })).toThrow();
    expect(() => defineEvent({ room: "test", type: "test.words", version: 1, payload: { note: { kind: "group", fields: { inner: str as never } } } })).toThrow();
    expect(() => defineEvent({ room: "test", type: "test.words", version: 1, payload: { note: { kind: "code", values: [] } } })).toThrow();
    expect(() => defineEvent({ room: "test", type: "test.words", version: 1, payload: { note: { kind: "code", values: ["Not A Code"] } } })).toThrow();
    expect(() => defineEvent({ room: "test", type: "test.words", version: 1, payload: { note: { kind: "code", values: ["x".repeat(41)] } } })).toThrow();
  });

  test("covers AC-8: a type must belong to its room and a room must exist", () => {
    expect(() => defineEvent({ room: "test", type: "meals.logged", version: 1, payload: {} })).toThrow();
    expect(() => defineEvent({ room: "elsewhere" as never, type: "elsewhere.x", version: 1, payload: {} })).toThrow();
    expect(() => defineEvent({ room: "test", type: "test.ok", version: 0, payload: {} })).toThrow();
    expect(() => defineEvent({ room: "test", type: "test.ok", version: 1, payload: { "bad name": { kind: "int" } } })).toThrow();
    expect(defineEvent({ room: "test", type: "test.fine", version: 1, payload: {} }).type).toBe("test.fine");
  });

  test("covers AC-8: every registered type is well formed and none holds free text", () => {
    for (const def of EVENT_DEFS) {
      expect(() => defineEvent(def)).not.toThrow();
      expect(def.type.startsWith(`${def.room}.`)).toBe(true);
    }
    expect(new Set(EVENT_DEFS.map((d) => d.type)).size).toBe(EVENT_DEFS.length);
  });

  test("covers AC-8: about and eventKey must be table:id, or the call is bad_key", async () => {
    const w = await world();
    for (const key of ["meals", "Meals:1", "meal s:1", "meals:", ":1", "meals:a b", "meals:a:b", "meals:ü", "m1:abc", `a:${"b".repeat(99)}`, ""]) {
      expect(isEventKey(key), key).toBe(false);
      expect(await code(rec(w, w.student, { eventKey: key })), `key ${key}`).toBe("bad_key");
      expect(await code(rec(w, w.student, { about: key })), `about ${key}`).toBe("bad_key");
    }
    for (const key of ["meals:abc", "meals:k57_2A-z", `a:${"b".repeat(98)}`]) expect(isEventKey(key), key).toBe(true);
    expect(await code(rec(w, w.student, { eventKey: `a:${"b".repeat(98)}` }))).toBe("ok");
  });
});

describe("who and tenancy (AC-9)", () => {
  test("covers AC-9: the class at the moment is kept after a class move", async () => {
    const w = await world();
    const before = await rec(w, w.student, { eventKey: "thing:cls1" });
    await w.A.admin.as.mutation(api.members.setClass, { memberId: w.student.memberId, classId: w.a2 });
    const after = await rec(w, w.student, { eventKey: "thing:cls2" });
    const rows = await w.t.run(async (ctx) => await Promise.all([ctx.db.get(before.eventId), ctx.db.get(after.eventId)]));
    expect(rows[0]?.classId).toBe(w.a1);
    expect(rows[1]?.classId).toBe(w.a2);
  });

  test("covers AC-9: a student records only about themselves", async () => {
    const w = await world();
    expect(await code(rec(w, w.student, { memberId: w.student2.memberId }))).toBe("forbidden");
    expect(await code(rec(w, w.student, { memberId: w.studentB.memberId }))).toBe("forbidden");
    // Even for a member id that is not a student, a student learns nothing about it.
    expect(await code(rec(w, w.student, { memberId: w.teacher.memberId }))).toBe("forbidden");
  });

  test("covers AC-9: a teacher records only about a student of an assigned class", async () => {
    const w = await world();
    expect(await code(rec(w, w.teacher, { memberId: w.student.memberId }))).toBe("ok");
    expect(await code(rec(w, w.teacher2, { memberId: w.student.memberId }))).toBe("forbidden");
    expect(await code(rec(w, w.teacherB, { memberId: w.student.memberId }))).toBe("forbidden");
    expect(await code(rec(w, w.teacher, { memberId: w.studentB.memberId }))).toBe("forbidden");
    // Assigned only after: the teacher's current assignments are what counts.
    await w.A.admin.as.mutation(api.classes.unassignTeacher, { classId: w.a1, memberId: w.teacher.memberId });
    expect(await code(rec(w, w.teacher, { memberId: w.student.memberId }))).toBe("forbidden");
  });

  test("covers AC-9: a DHI admin records about any student; a counselor and an institute admin never", async () => {
    const w = await world();
    expect(await code(rec(w, w.dhi, { memberId: w.student.memberId }))).toBe("ok");
    expect(await code(rec(w, w.dhi, { memberId: w.studentB.memberId }))).toBe("ok");
    expect(await code(rec(w, w.counselor, { memberId: w.student.memberId }))).toBe("forbidden");
    expect(await code(rec(w, w.A.admin, { memberId: w.student.memberId }))).toBe("forbidden");
    expect(await code(rec(w, w.B.admin, { memberId: w.student.memberId }))).toBe("forbidden");
  });

  test("covers AC-9: the actor is stored, and an event about a teacher or any non student is not_a_student", async () => {
    const w = await world();
    const r = await rec(w, w.teacher, { memberId: w.student.memberId });
    const row = await w.t.run(async (ctx) => await ctx.db.get(r.eventId));
    expect(row?.actorId).toBe(w.teacher.memberId);
    expect(await code(rec(w, w.dhi, { memberId: w.teacher.memberId }))).toBe("not_a_student");
    expect(await code(rec(w, w.teacher, { memberId: w.A.admin.memberId }))).toBe("not_a_student");
    expect(await code(rec(w, w.dhi, { memberId: w.counselor.memberId }))).toBe("not_a_student");
  });

  test("covers AC-9: a removed member and a member of a suspended institute receive no new events", async () => {
    const w = await world();
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.student.memberId });
    expect(await code(rec(w, w.dhi, { memberId: w.student.memberId }))).toBe("member_inactive");
    expect(await code(rec(w, w.dhi, { memberId: w.student2.memberId }))).toBe("ok");
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.A.instituteId, status: "suspended" });
    expect(await code(rec(w, w.dhi, { memberId: w.student2.memberId }))).toBe("member_inactive");
    expect(await code(rec(w, w.dhi, { memberId: w.studentB.memberId }))).toBe("ok");
  });

  test("covers AC-9: a member who was removed and reinstated can fill in the last 7 days again, and the removed days read notLogged", async () => {
    const w = await world();
    await w.t.run(async (ctx) => ctx.db.patch(w.student.memberId, { joinedAt: at("2026-10-01T10:00:00+05:30") }));
    await rec(w, w.student, { occurredAt: at("2026-10-19T09:00:00+05:30") });
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.student.memberId });
    setTime("2026-10-23T10:00:00+05:30");
    expect(await code(rec(w, w.dhi, { memberId: w.student.memberId, occurredAt: at("2026-10-22T09:00:00+05:30") }))).toBe("member_inactive");
    await w.A.admin.as.mutation(api.members.reinstate, { memberId: w.student.memberId });
    expect(await day(w, "2026-10-21")).toBe("notLogged");
    expect(await day(w, "2026-10-22")).toBe("notLogged");
    // The last 7 days are open again, including days they were removed.
    expect(await code(rec(w, w.student, { occurredAt: at("2026-10-22T09:00:00+05:30") }))).toBe("ok");
    expect(await code(rec(w, w.student, { occurredAt: at("2026-10-16T09:00:00+05:30") }))).toBe("ok");
    expect(await day(w, "2026-10-22")).toBe("logged");
  });

  test("covers AC-9: system is available only through the internal wrapper, and is stored as system", async () => {
    const w = await world();
    const r = await w.t.run(async (ctx) => await recordSystemEvent(ctx, input(w)));
    const row = await w.t.run(async (ctx) => await ctx.db.get(r.eventId));
    expect(row?.actorId).toBe("system");
    // The wrapper still checks the student, the registry and the time.
    expect(await code(w.t.run(async (ctx) => await recordSystemEvent(ctx, input(w, { memberId: w.teacher.memberId }))))).toBe("not_a_student");
    expect(await code(w.t.run(async (ctx) => await recordSystemEvent(ctx, input(w, { type: "test.nothing" }))))).toBe("unknown_type");
    expect(await code(w.t.run(async (ctx) => await recordSystemEvent(ctx, input(w, { occurredAt: T0 + 60 * 60 * 1000 }))))).toBe("in_future");
    // `system` cannot be passed as the actor of recordEvent: the type does not allow it.
    // @ts-expect-error the actor of recordEvent is a member context, never the word system
    const wrong: EventActor = "system";
    expect(await code(w.t.run(async (ctx) => await recordEvent(ctx, { by: wrong, ...input(w) })))).not.toBe("ok");
  });

  test("covers AC-9: a student with no class is still recorded, with no class on the event", async () => {
    const w = await world();
    await w.t.run(async (ctx) => ctx.db.patch(w.student.memberId, { classId: undefined }));
    const r = await rec(w, w.student, {});
    expect((await w.t.run(async (ctx) => await ctx.db.get(r.eventId)))?.classId).toBeUndefined();
  });
});

describe("source scans (AC-10, AC-12, AC-14)", () => {
  const files = import.meta.glob("./**/*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
  const source = (name: string) => files[name] ?? "";
  // Application code: not tests, not generated.
  const app = Object.entries(files).filter(([name]) => !name.endsWith(".test.ts") && !name.startsWith("./_generated/"));
  // Comment lines hold prose that may name a function; only code is scanned.
  const code = (text: string) => text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");

  // The files that may call the log's helpers or read the table. A room adds its file here when it is built (AC-12). Everything not on this
  // list that imports the log fails the scan.
  const LOG_IMPORTERS = ["./eventLog.ts", "./eventProof.ts", "./moods.ts", "./habits.ts"];
  // eventProof.ts is the development proof of the retry rule (AC-4); it needs the read helper to count what a race stored.
  // staffRead.ts counts, for a class total, which students have data of a kind in a month (house spec 0005, AC-23).
  const READ_HELPER_IMPORTERS: string[] = ["./eventProof.ts", "./staffRead.ts", "./moods.ts", "./habits.ts"]; // moods.ts reads the current event to replace it (house spec 0006)
  const RECORD_ONLY_IMPORTERS: string[] = [];

  test("covers AC-10: no app code updates or deletes an event, and only the log inserts one", () => {
    for (const [name, text] of app) {
      const c = code(text);
      expect(c, `${name} patches or replaces events`).not.toMatch(/db\s*\.\s*(patch|replace)\s*\(\s*["']events["']/);
      // The only removal is the erase path of house spec 0005 (eventData.ts).
      if (name !== "./eventData.ts") expect(c, `${name} deletes events`).not.toMatch(/db\s*\.\s*delete\s*\(\s*["']events["']/);
      if (name !== "./eventLog.ts") expect(c, `${name} writes events`).not.toMatch(/insert\s*\(\s*["']events["']/);
    }
    // In the log itself, no write names anything but an insert: it has no patch, replace or delete at all.
    expect(code(source("./eventLog.ts"))).not.toMatch(/db\s*\.\s*(patch|replace|delete)\s*\(/);
    expect(code(source("./eventLog.ts"))).toMatch(/insert\s*\(\s*"events"/);
  });

  test("covers AC-10, AC-12: no other file reads the events table, and no file outside the allowlist imports the log", () => {
    for (const [name, text] of app) {
      // eventData.ts is the person's own export and erase (house spec 0005): the one other place that reads or deletes events.
      if (name === "./eventLog.ts" || name === "./eventData.ts" || name === "./moodProof.ts" || name === "./habitProof.ts") continue; // moodProof.ts and habitProof.ts are the dev only live race checks of the first two rooms // moodProof.ts is the dev only live race check of the mood room
      const c = code(text);
      expect(c, `${name} reads events`).not.toMatch(/query\s*\(\s*["']events["']/);
      expect(c, `${name} gets an event`).not.toMatch(/db\s*\.\s*get\s*\(\s*["']events["']/);
      if (/from\s+["']\.\/eventLog["']/.test(c)) {
        expect([...LOG_IMPORTERS, ...READ_HELPER_IMPORTERS, ...RECORD_ONLY_IMPORTERS], `${name} imports the event log`).toContain(name);
      }
      if (/\b(eventsForDay|currentFor|dayStatus|hasEventInRange)\b/.test(c)) {
        expect(READ_HELPER_IMPORTERS, `${name} uses a read helper`).toContain(name);
      }
      if (/\brecordSystemEvent\b/.test(c)) expect(name, "the system wrapper is for internal jobs").toMatch(/^\.\/eventProof\.ts$/);
    }
  });

  test("covers AC-12: no public function takes or returns an event, and none returns an event document", async () => {
    const loaders = import.meta.glob(["./*.ts", "!./*.test.ts"]) as Record<string, () => Promise<Record<string, unknown>>>;
    const mods: Record<string, Record<string, unknown>> = {};
    // The two config files import component packages that only the Convex bundler resolves.
    const notLoadable: string[] = [];
    for (const [name, load] of Object.entries(loaders)) {
      if (name.endsWith(".config.ts")) continue;
      try {
        mods[name] = await load();
      } catch {
        notLoadable.push(name);
      }
    }
    // The sign in and HTTP files need a configured deployment to load; they hold no event code (the source scans above cover them).
    expect(notLoadable.every((n) => ["./auth.ts", "./http.ts"].includes(n)), notLoadable.join(",")).toBe(true);
    const eventish = /"events"|loggedFor|eventKey|schemaVer/;
    let publicFunctions = 0;
    for (const [name, mod] of Object.entries(mods)) {
      if (name.endsWith(".test.ts")) continue;
      for (const [fnName, fn] of Object.entries(mod)) {
        const f = fn as { isConvexFunction?: boolean; isPublic?: boolean; exportReturns?: () => string; exportArgs?: () => string };
        if (!f || typeof f.exportReturns !== "function" || f.isPublic !== true) continue;
        publicFunctions += 1;
        const returns = f.exportReturns?.() ?? "";
        const args = f.exportArgs?.() ?? "";
        expect(returns, `${name}:${fnName} returns an event`).not.toMatch(eventish);
        expect(args, `${name}:${fnName} takes an event`).not.toMatch(eventish);
      }
    }
    // The scan really walked the functions: the house has dozens of public ones.
    expect(publicFunctions).toBeGreaterThan(30);
  });

  test("covers AC-12: the log's helpers are not Convex functions, so a browser cannot call them", async () => {
    const log = (await import("./eventLog")) as Record<string, unknown>;
    for (const [name, value] of Object.entries(log)) {
      expect(typeof (value as { exportReturns?: unknown })?.exportReturns, name).not.toBe("function");
    }
  });

  test("covers AC-14: the log's own files log nothing and refuse with fixed codes only", () => {
    for (const name of ["./eventLog.ts", "./eventShapes.ts", "./eventRegistry.ts", "./dayRules.ts", "./eventTypes/test.ts"]) {
      const c = code(source(name));
      expect(c, `${name} logs`).not.toMatch(/console\s*\./);
      expect(c, `${name} throws a message`).not.toMatch(/new ConvexError/);
      for (const m of c.matchAll(/\bfail\s*\(([^)]*)\)/g)) expect(m[1], `${name}: ${m[0]}`).toMatch(/^\s*"[a-z_]+"\s*$/);
    }
    // The only thrown messages are build time ones about a registry entry's own shape; they carry a type name, never a payload.
    expect(code(source("./eventShapes.ts")).match(/throw new \w+\([^)]*\)/g) ?? []).toHaveLength(1);
  });
});

describe("the access table, live schema shape (AC-9, AC-10)", () => {
  test("covers AC-10: a stored event has exactly the fields of the design and no loggedFor can be set by a room", async () => {
    const w = await world();
    const r = await rec(w, w.student, { about: "thing:shape", replaces: undefined });
    const row = await w.t.run(async (ctx) => await ctx.db.get(r.eventId));
    expect(Object.keys(row ?? {}).sort()).toEqual(["_creationTime", "_id", "about", "actorId", "eventKey", "instituteId", "classId", "late", "loggedFor", "memberId", "occurredAt", "payload", "room", "schemaVer", "type"].sort());
  });
});
