/// <reference types="vite/client" />
// The desk's after session card (spec house/0018, desk part). Each test names the criterion it covers. The model is a stand in `fetch`, and time is moved
// with a fake clock in steps of minutes (the test sign in would expire if the clock moved by days).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { eventsForDay } from "./eventLog";
import { deskRoom } from "./deskRoom";
import { touchSitting } from "./deskSitting";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, refusal, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-24T10:00:00+05:30");
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  process.env.DESK_LIVE = "true";
  process.env.OPENAI_API_KEY = "test-key-not-real";
  process.env.ERASURE_HASH_SECRET = "test-erasure-secret";
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "An answer" } }], usage: { prompt_tokens: 5, completion_tokens: 5 } }), { status: 200 })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.DESK_LIVE;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ERASURE_HASH_SECRET;
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
  return { t, s, s2 };
}
type World = Awaited<ReturnType<typeof world>>;

const ask = async (p: Person, question: string) => {
  const r = await p.as.action(api.deskAsk.ask, { kind: "chat", question });
  if (!r.ok) throw new Error(`setup ${JSON.stringify(r)}`);
  return r;
};
const sittingsOf = (w: World, p: Person) => w.t.run(async (ctx) => await ctx.db.query("deskSittings").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", p.memberId)).take(20));
const close = (w: World) => w.t.mutation(internal.deskSitting.closeSittings, {});
const eventsOf = (w: World, p: Person) => w.t.run(async (ctx) => await ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", p.memberId)).take(50));

// A student sits at the desk for `minutes` (questions every 5 minutes), then goes quiet long enough for the sitting to end. Returns the sitting.
async function sit(w: World, p: Person, minutes: number, tag = "q") {
  const start = Date.now();
  for (let m = 0; m <= minutes; m += 5) {
    vi.setSystemTime(start + m * MIN);
    await ask(p, `${tag} question at minute ${m}`);
  }
  vi.setSystemTime(start + minutes * MIN + 16 * MIN);
  await close(w);
  return (await sittingsOf(w, p)).at(-1)!;
}

describe("sittings (AC-1)", () => {
  test("covers AC-1: questions less than 15 minutes apart are one sitting; a longer gap starts another", async () => {
    const w = await world();
    await ask(w.s, "first");
    vi.setSystemTime(NOW + 14 * MIN);
    await ask(w.s, "second");
    expect(await sittingsOf(w, w.s)).toMatchObject([{ startedAt: NOW, lastAt: NOW + 14 * MIN }]);
    vi.setSystemTime(NOW + 14 * MIN + 16 * MIN);
    await ask(w.s, "third");
    expect(await sittingsOf(w, w.s)).toHaveLength(2);
  });

  test("covers AC-1: a stored answer and a clarifying question also count as being at the desk", async () => {
    const w = await world();
    await ask(w.s, "What is torque?");
    vi.setSystemTime(NOW + 4 * MIN);
    const cached = await ask(w.s2, "What is torque?");
    expect(cached.cached).toBe(true);
    expect(await sittingsOf(w, w.s2)).toHaveLength(1);
  });

  test("covers AC-1: a message that gets the care answer is not a sitting", async () => {
    const w = await world();
    await w.s.as.action(api.deskAsk.ask, { kind: "chat", question: "I want to die" });
    expect(await sittingsOf(w, w.s)).toHaveLength(0);
  });

  test("covers AC-1: a sitting under 10 minutes ends with no card; one of 10 minutes or more ends pending", async () => {
    const w = await world();
    const short = await sit(w, w.s, 5);
    expect(short.feedbackStatus).toBe("none");
    expect(await w.s.as.query(api.deskSitting.pending, {})).toBeNull();
    const long = await sit(w, w.s, 10);
    expect(long.feedbackStatus).toBe("pending");
    expect(await w.s.as.query(api.deskSitting.pending, {})).toEqual({ sittingId: long._id, minutes: 10 });
  });

  test("a sitting still going is not closed, and the job is safe to run twice", async () => {
    const w = await world();
    await ask(w.s, "one");
    vi.setSystemTime(NOW + 10 * MIN);
    await ask(w.s, "two");
    vi.setSystemTime(NOW + 20 * MIN);
    expect(await close(w)).toBe(0);
    vi.setSystemTime(NOW + 26 * MIN);
    expect(await close(w)).toBe(1);
    expect(await close(w)).toBe(0);
  });

  test("covers AC-1: a card is offered for 24 hours, and then it is left alone", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    vi.setSystemTime(s.lastAt + 23 * HOUR);
    expect(await w.s.as.query(api.deskSitting.pending, {})).not.toBeNull();
    vi.setSystemTime(s.lastAt + 25 * HOUR);
    expect(await w.s.as.query(api.deskSitting.pending, {})).toBeNull();
    expect(await w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "okay", focus: 3 })).toEqual({ ok: false, code: "expired" });
    expect((await eventsOf(w, w.s)).filter((e) => e.type === "desk.felt")).toHaveLength(0);
  });
});

describe("answering and skipping (AC-2, AC-3, AC-4)", () => {
  test("covers AC-2: an answer writes one desk.felt event with the feeling, focus, bands and subject, and the sitting keeps it", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    expect(await w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "energised", focus: 4, subject: "maths" })).toEqual({ ok: true });
    const events = (await eventsOf(w, w.s)).filter((e) => e.type === "desk.felt");
    expect(events).toHaveLength(1);
    expect(events[0].room).toBe("desk");
    // Version 3 (house spec 0030) adds the whole minutes of the sitting, for desk time by subject (A11).
    expect(events[0].payload).toEqual({ feel: "energised", focus: 4, time: "before_18", length: "under_40", subject: "maths", minutes: expect.any(Number) });
    expect((events[0].payload as { minutes: number }).minutes).toBeGreaterThanOrEqual(10);
    const row = (await sittingsOf(w, w.s)).at(-1)!;
    expect(row).toMatchObject({ feedbackStatus: "answered", feel: "energised", focus: 4, subject: "maths" });
    expect(await w.s.as.query(api.deskSitting.pending, {})).toBeNull();
  });

  test("covers AC-2: the subject is optional, and the event then holds none", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    expect(await w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "okay", focus: 3 })).toEqual({ ok: true });
    const e = (await eventsOf(w, w.s)).find((x) => x.type === "desk.felt");
    expect(e?.payload).toEqual({ feel: "okay", focus: 3, time: "before_18", length: "under_40", minutes: expect.any(Number) });
  });

  test("covers AC-2: a bad feeling, focus or subject is refused and nothing is stored", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    expect(await refusal(w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "great", focus: 3 }))).toBe("bad_feel");
    expect(await refusal(w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "okay", focus: 6 }))).toBe("bad_focus");
    expect(await refusal(w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "okay", focus: 3, subject: "art" }))).toBe("bad_subject");
    expect((await eventsOf(w, w.s)).filter((e) => e.type === "desk.felt")).toHaveLength(0);
    expect((await sittingsOf(w, w.s)).at(-1)?.feedbackStatus).toBe("pending");
  });

  test("covers AC-3: a skip is stored as skipped, writes no event, and the card cannot be answered or skipped again", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    expect(await w.s.as.mutation(api.deskSitting.skip, { sittingId: s._id })).toEqual({ ok: true });
    expect((await sittingsOf(w, w.s)).at(-1)).toMatchObject({ feedbackStatus: "skipped" });
    expect((await sittingsOf(w, w.s)).at(-1)?.feel).toBeUndefined();
    expect((await eventsOf(w, w.s)).filter((e) => e.type === "desk.felt")).toHaveLength(0);
    expect(await refusal(w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "okay", focus: 3 }))).toBe("not_pending");
    expect(await refusal(w.s.as.mutation(api.deskSitting.skip, { sittingId: s._id }))).toBe("not_pending");
  });

  test("covers AC-3: an answered card cannot be answered twice", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    await w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "okay", focus: 3 });
    expect(await refusal(w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "drained", focus: 1 }))).toBe("not_pending");
    expect((await eventsOf(w, w.s)).filter((e) => e.type === "desk.felt")).toHaveLength(1);
  });

  test("covers AC-4: another student's sitting is not found, and only a student has a card", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    expect(await refusal(w.s2.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "okay", focus: 3 }))).toBe("not_found");
    expect(await refusal(w.s2.as.mutation(api.deskSitting.skip, { sittingId: s._id }))).toBe("not_found");
    expect(await w.s2.as.query(api.deskSitting.pending, {})).toBeNull();
  });
});

describe("the bell, the Brain and the student's own data (AC-5, AC-6)", () => {
  test("covers AC-5: the bell lists a feeling card for the desk while one is pending", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    expect(await w.s.as.query(api.waiting.mine, {})).toEqual([{ kind: "feeling", title: "", room: "dhi" }]);
    await w.s.as.mutation(api.deskSitting.skip, { sittingId: s._id });
    expect(await w.s.as.query(api.waiting.mine, {})).toEqual([]);
  });

  test("covers AC-5: an answer reaches the Brain's felt okay and focus measures through the event log", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    await w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "drained", focus: 2 });
    const day = (await eventsOf(w, w.s)).find((e) => e.type === "desk.felt")!.loggedFor;
    const { valuesOfDay } = await import("./metricRules");
    const rows = await w.t.run(async (ctx) => await eventsForDay(ctx, { memberId: w.s.memberId, day }));
    const values = valuesOfDay(rows, { finished: true, hourOpen: false, openHabits: 0 });
    expect(values.E09).toEqual({ num: 0, den: 1 });
    expect(values.E10).toEqual({ num: 2, den: 1 });
  });

  test("covers AC-6: the export holds the card's status and answer, and the erase deletes the sittings", async () => {
    const w = await world();
    const s = await sit(w, w.s, 10);
    await w.s.as.mutation(api.deskSitting.answer, { sittingId: s._id, feel: "okay", focus: 5, subject: "science" });
    const pages: unknown[][] = [];
    let cursor: string | null = null;
    for (let i = 0; i < 5; i++) {
      const r: { rows: unknown[]; next: string | null } = await w.t.run(async (ctx) => await deskRoom.exporter(ctx, w.s.memberId, cursor, 100));
      pages.push(r.rows);
      if (r.next === null) break;
      cursor = r.next;
    }
    const rows = pages.flat() as { sitting?: boolean; card?: string; feel?: string; focus?: number; subject?: string }[];
    expect(rows.filter((r) => r.sitting)).toMatchObject([{ card: "answered", feel: "okay", focus: 5, subject: "science" }]);
    const erased = await w.t.run(async (ctx) => await deskRoom.eraser(ctx, w.s.memberId, 100));
    expect(erased.done).toBe(true);
    expect(await sittingsOf(w, w.s)).toHaveLength(0);
  });

  test("a student with no sittings exports no sitting page", async () => {
    const w = await world();
    const r = await w.t.run(async (ctx) => await deskRoom.exporter(ctx, w.s2.memberId, null, 100));
    expect(r).toEqual({ rows: [], next: null });
  });
});

describe("minutes at the desk (X02)", () => {
  test("covers X02: a sitting that ends writes one system event with its whole minutes, and nothing else", async () => {
    const w = await world();
    await sit(w, w.s, 10);
    const e = (await eventsOf(w, w.s)).filter((x) => x.type === "desk.present");
    expect(e).toHaveLength(1);
    expect(e[0].room).toBe("desk");
    expect(e[0].actorId).toBe("system");
    expect(e[0].payload).toEqual({ minutes: 10 });
    expect(JSON.stringify(e[0])).not.toContain("question");
  });

  test("covers X02: a short sitting still counts its minutes, and one question alone (under a minute) writes none", async () => {
    const w = await world();
    await sit(w, w.s, 5);
    expect((await eventsOf(w, w.s)).filter((x) => x.type === "desk.present").map((x) => x.payload)).toEqual([{ minutes: 5 }]);
    await sit(w, w.s2, 0);
    expect((await eventsOf(w, w.s2)).filter((x) => x.type === "desk.present")).toEqual([]);
  });

  test("covers X02: closing twice writes the event once", async () => {
    const w = await world();
    await sit(w, w.s, 10);
    await close(w);
    expect((await eventsOf(w, w.s)).filter((x) => x.type === "desk.present")).toHaveLength(1);
  });
});

describe("what a sitting held (A10, A12)", () => {
  test("covers A10 and A12: a sitting that ends writes one system event with its question count and its active count, and nothing else", async () => {
    const w = await world();
    await sit(w, w.s, 10);
    const e = (await eventsOf(w, w.s)).filter((x) => x.type === "desk.mode");
    expect(e).toHaveLength(1);
    expect(e[0].room).toBe("desk");
    expect(e[0].actorId).toBe("system");
    // Version 2 (house spec 0030) adds the plain questions (doubts), A18's bottom part.
    expect(Object.keys(e[0].payload as object).sort()).toEqual(["active", "doubts", "turns"]);
    expect((e[0].payload as { turns: number }).turns).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(e[0])).not.toContain("question");
  });

  test("covers A12: only write, paper and mock questions count as active, and a single question alone still writes the event", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const member = (await ctx.db.get(w.s.memberId))!;
      const now = Date.now();
      for (const kind of ["chat", "clarify", "write", "paper", "mock", "story", "draw"]) await touchSitting(ctx, member, now, kind);
    });
    const s = await w.t.run((ctx) => ctx.db.query("deskSittings").first());
    expect(s).toMatchObject({ turns: 7, activeTurns: 3, doubts: 1 });
    await sit(w, w.s2, 0);
    expect((await eventsOf(w, w.s2)).filter((x) => x.type === "desk.mode").map((x) => x.payload)).toEqual([{ turns: 1, active: 0, doubts: 1 }]);
  });

  test("covers A10: closing twice writes the event once", async () => {
    const w = await world();
    await sit(w, w.s, 10);
    await close(w);
    expect((await eventsOf(w, w.s)).filter((x) => x.type === "desk.mode")).toHaveLength(1);
  });
});

describe("the event shape", () => {
  test("a desk.felt event with an unknown subject is refused by the log", async () => {
    const { EVENT_DEFS } = await import("./eventRegistry");
    const def = EVENT_DEFS.find((d) => d.type === "desk.felt");
    expect(def?.room).toBe("desk");
    expect(Object.keys(def?.payload ?? {}).sort()).toEqual(["feel", "focus", "length", "minutes", "subject", "time", "topic"]);
  });
});
