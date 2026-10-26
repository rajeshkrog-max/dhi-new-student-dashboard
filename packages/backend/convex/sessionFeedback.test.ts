// The after session feeling card (spec house/0018, scope row 16). Each test names the criterion it covers. Time is fixed and moved with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { asksForCard, isFeel, isFocus, lengthBandOf, timeBandOf } from "./sessionRules";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, refusal } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T18:00:00+05:30");
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

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
  const other = await makeStudent(t, A.admin, a1, "other@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, other]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  await dhi.as.mutation(api.studyHour.set, { opensAt: NOW - 10 * MIN, closesAt: NOW + 3 * HOUR });
  return { t, dhi, s, other };
}

type W = Awaited<ReturnType<typeof world>>;
// A stay with a heartbeat every 30 seconds, ending in a leave.
async function stay(student: W["s"], minutes: number) {
  vi.setSystemTime(NOW);
  await student.as.mutation(api.studyHour.enter, { mode: "live" });
  for (let t = 30 * 1000; t < minutes * MIN; t += 30 * 1000) {
    vi.setSystemTime(NOW + t);
    await student.as.mutation(api.studyHour.beat, {});
  }
  vi.setSystemTime(NOW + minutes * MIN);
  await student.as.mutation(api.studyHour.leave, {});
}
const felt = async (w: W) => (await w.t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.type === "hour.felt");

describe("the after session card", () => {
  test("covers AC-1: a stay of 20 minutes asks for the card, and a stay of 19 does not", async () => {
    const w = await world();
    await stay(w.s, 19);
    expect(await w.s.as.query(api.sessionFeedback.pending, {})).toBeNull();
    await stay(w.other, 20);
    expect(await w.other.as.query(api.sessionFeedback.pending, {})).toMatchObject({ source: "hour", minutes: 20 });
  });

  test("covers AC-2: an answer writes one event of fixed codes and a small number, with the bands of the stay", async () => {
    const w = await world();
    await stay(w.s, 25);
    const card = await w.s.as.query(api.sessionFeedback.pending, {});
    expect(await w.s.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "okay", focus: 4 })).toEqual({ ok: true });
    const events = await felt(w);
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ feel: "okay", focus: 4, time: "evening", length: "under_40" });
    expect(await w.s.as.query(api.sessionFeedback.pending, {})).toBeNull();
    expect(await w.s.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "drained", focus: 1 })).toEqual({ ok: false, code: "not_pending" });
    expect(await felt(w)).toHaveLength(1);
  });

  test("covers AC-3: a skip is stored as skipped, changes no value and writes no event, and a skipped card cannot be answered later", async () => {
    const w = await world();
    await stay(w.s, 30);
    const card = await w.s.as.query(api.sessionFeedback.pending, {});
    expect(await w.s.as.mutation(api.sessionFeedback.skip, { seatId: card!.seatId })).toEqual({ ok: true });
    expect(await felt(w)).toHaveLength(0);
    const seat = await w.t.run((ctx) => ctx.db.get(card!.seatId));
    expect(seat).toMatchObject({ feedbackStatus: "skipped" });
    expect(seat?.feel).toBeUndefined();
    expect(seat?.focus).toBeUndefined();
    expect(await w.s.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "okay", focus: 3 })).toEqual({ ok: false, code: "not_pending" });
  });

  test("covers AC-2: a feeling that is not one of the three, and a focus outside 1 to 5 or not whole, are refused", async () => {
    const w = await world();
    await stay(w.s, 25);
    const card = await w.s.as.query(api.sessionFeedback.pending, {});
    expect(await w.s.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "angry", focus: 3 })).toEqual({ ok: false, code: "bad_feel" });
    expect(await w.s.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "okay", focus: 6 })).toEqual({ ok: false, code: "bad_focus" });
    expect(await w.s.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "okay", focus: 2.5 })).toEqual({ ok: false, code: "bad_focus" });
    expect(await felt(w)).toHaveLength(0);
  });

  test("covers AC-4: another student's seat is not found, so no one answers or skips for someone else", async () => {
    const w = await world();
    await stay(w.s, 25);
    const card = await w.s.as.query(api.sessionFeedback.pending, {});
    expect(await refusal(w.other.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "okay", focus: 3 }))).toBe("not_found");
    expect(await refusal(w.other.as.mutation(api.sessionFeedback.skip, { seatId: card!.seatId }))).toBe("not_found");
    expect(await w.other.as.query(api.sessionFeedback.pending, {})).toBeNull();
  });

  test("covers AC-1: a card is offered for 24 hours, and then it is left alone", async () => {
    const w = await world();
    await stay(w.s, 25);
    const card = await w.s.as.query(api.sessionFeedback.pending, {});
    vi.setSystemTime(NOW + 26 * HOUR);
    expect(await w.s.as.query(api.sessionFeedback.pending, {})).toBeNull();
    expect(await w.s.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "okay", focus: 3 })).toEqual({ ok: false, code: "expired" });
  });

  test("covers AC-1: a seat dropped by the sweep after a 22 minute stay also asks for the card", async () => {
    const w = await world();
    await w.s.as.mutation(api.studyHour.enter, { mode: "live" });
    for (let t = 30 * 1000; t <= 22 * MIN; t += 30 * 1000) {
      vi.setSystemTime(NOW + t);
      await w.s.as.mutation(api.studyHour.beat, {});
    }
    vi.setSystemTime(NOW + 40 * MIN);
    expect(await w.t.mutation(internal.studyHour.sweep, {})).toBe(1);
    expect(await w.s.as.query(api.sessionFeedback.pending, {})).toMatchObject({ minutes: 22 });
  });

  test("covers AC-5: a DHI admin has no card", async () => {
    const w = await world();
    expect(await refusal(w.dhi.as.query(api.sessionFeedback.pending, {}))).toBe("forbidden");
  });
});

describe("the card rules", () => {
  test("covers AC-1: the stay that asks, the bands and the values", () => {
    expect(asksForCard("hour", 19)).toBe(false);
    expect(asksForCard("hour", 20)).toBe(true);
    expect(asksForCard("desk", 9)).toBe(false);
    expect(asksForCard("desk", 10)).toBe(true);
    expect(timeBandOf(at("2026-10-20T17:59:00+05:30"))).toBe("before_18");
    expect(timeBandOf(at("2026-10-20T18:00:00+05:30"))).toBe("evening");
    expect(timeBandOf(at("2026-10-20T20:59:00+05:30"))).toBe("evening");
    expect(timeBandOf(at("2026-10-20T21:00:00+05:30"))).toBe("night");
    expect(lengthBandOf(39)).toBe("under_40");
    expect(lengthBandOf(40)).toBe("forty_plus");
    expect(isFeel("okay")).toBe(true);
    expect(isFeel("fine")).toBe(false);
    expect([1, 5].every(isFocus)).toBe(true);
    expect([0, 6, 2.5, Number.NaN].some(isFocus)).toBe(false);
  });
});
