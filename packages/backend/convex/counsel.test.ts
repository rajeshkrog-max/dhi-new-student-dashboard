/// <reference types="vite/client" />
// Counseling (spec house/0024; the owner's answers of 2026-10-27): slots, booking, what a counselor sees, the summary, sharing a recording, who may
// join a call and when, and export and erase. The Stream calls themselves (counselCall.ts) are not run here; `callAccess` is the rule they follow.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { SLOT_MS } from "./counselRules";
import { counselRoom } from "./counselRoom";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const NOW = Date.parse("2026-10-27T10:00:00+05:30");
const HOUR = 60 * 60 * 1000;
const slotAt = (hours: number) => Math.ceil((NOW + hours * HOUR) / SLOT_MS) * SLOT_MS;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
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
  const s = await makeStudent(t, A.admin, a1, "asha@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "ravi@alpha.test", false);
  await dhi.as.mutation(api.invites.create, { role: "counselor", email: "meera@dhi.test", name: "Meera Rao" });
  const counselor = await joinAs(t, "meera@dhi.test", { name: "Meera Rao" });
  await t.run(async (ctx) => {
    await ctx.db.patch(s.memberId, { name: "Asha Verma" });
  });
  return { t, dhi, A, teacher, s, s2, counselor };
}
type World = Awaited<ReturnType<typeof world>>;
const open = async (w: World, hours: number) => {
  const r = await w.counselor.as.mutation(api.counsel.openSlot, { startsAt: slotAt(hours) });
  if (!r.ok) throw new Error(r.code);
  return r.slotId;
};
const bookAs = async (who: World["s"], slotId: Id<"counselSlots">, note = "") => {
  const r = await who.as.mutation(api.counsel.book, { slotId, note });
  if (!r.ok) throw new Error(r.code);
  return r.bookingId;
};

describe("slots and booking", () => {
  test("a counselor opens half hour slots in the future only, and a student sees them with the counselor's first name", async () => {
    const w = await world();
    expect(await w.counselor.as.mutation(api.counsel.openSlot, { startsAt: slotAt(2) + 60_000 })).toEqual({ ok: false, code: "bad_time" });
    expect(await w.counselor.as.mutation(api.counsel.openSlot, { startsAt: slotAt(-1) })).toEqual({ ok: false, code: "too_soon" });
    expect(await w.counselor.as.mutation(api.counsel.openSlot, { startsAt: slotAt(24 * 70) })).toEqual({ ok: false, code: "too_far" });
    await open(w, 2);
    expect(await w.counselor.as.mutation(api.counsel.openSlot, { startsAt: slotAt(2) })).toEqual({ ok: false, code: "slot_taken" });
    expect(await w.s.as.query(api.counsel.freeSlots, { now: NOW })).toMatchObject([{ startsAt: slotAt(2), counselor: "Meera" }]);
  });

  test("a student books one slot at a time; the slot leaves the free list; cancelling before the start opens it again", async () => {
    const w = await world();
    const a = await open(w, 2);
    const b = await open(w, 3);
    const booking = await bookAs(w.s, a, "I feel stressed about exams");
    expect(await w.s.as.mutation(api.counsel.book, { slotId: b, note: "" })).toEqual({ ok: false, code: "already_booked" });
    expect(await w.s2.as.mutation(api.counsel.book, { slotId: a, note: "" })).toEqual({ ok: false, code: "slot_gone" });
    expect((await w.s2.as.query(api.counsel.freeSlots, { now: NOW })).map((x) => x.slotId)).toEqual([b]);
    expect(await w.s.as.mutation(api.counsel.cancel, { bookingId: booking })).toEqual({ ok: true });
    expect((await w.s2.as.query(api.counsel.freeSlots, { now: NOW })).length).toBe(2);
    expect(await w.s.as.mutation(api.counsel.book, { slotId: a, note: "x".repeat(301) })).toEqual({ ok: false, code: "note_too_long" });
  });
});

describe("what each person sees", () => {
  test("the counselor sees the first name, class, school and the note only; never the email or anything from the rooms", async () => {
    const w = await world();
    const a = await open(w, 2);
    await bookAs(w.s, a, "I feel stressed about exams");
    const slots = await w.counselor.as.query(api.counsel.mySlots, { now: NOW });
    expect(slots[0].booking).toMatchObject({ firstName: "Asha", className: "Class 10 A", school: "Alpha School", note: "I feel stressed about exams", status: "booked" });
    expect(JSON.stringify(slots)).not.toContain("asha@alpha.test");
    expect(JSON.stringify(slots)).not.toContain("Verma");
  });

  test("school staff, a DHI admin and another student reach no booking; a student and a counselor reach only their own side", async () => {
    const w = await world();
    const a = await open(w, 2);
    await bookAs(w.s, a);
    for (const p of [w.teacher, w.A.admin, w.dhi, w.s]) expect(await refusal(p.as.query(api.counsel.mySlots, { now: NOW }))).toBe("forbidden");
    for (const p of [w.teacher, w.A.admin, w.dhi, w.counselor]) {
      expect(await refusal(p.as.query(api.counsel.mine, {}))).toBe("forbidden");
      expect(await refusal(p.as.mutation(api.counsel.book, { slotId: a, note: "" }))).toBe("forbidden");
    }
    expect(await w.s2.as.query(api.counsel.mine, {})).toEqual([]);
    expect(await refusal(w.t.query(api.counsel.freeSlots, { now: NOW }))).toBe("not_signed_in");
  });

  test("the summary is written only after the start, and only the student and that counselor read it", async () => {
    const w = await world();
    const a = await open(w, 2);
    const booking = await bookAs(w.s, a);
    expect(await w.counselor.as.mutation(api.counsel.finish, { bookingId: booking, summary: "Talked about a study plan." })).toEqual({ ok: false, code: "not_started" });
    vi.setSystemTime(slotAt(2) + 5 * 60_000);
    expect(await w.counselor.as.mutation(api.counsel.finish, { bookingId: booking, summary: "Talked about a study plan." })).toEqual({ ok: true });
    expect((await w.s.as.query(api.counsel.mine, {}))[0]).toMatchObject({ status: "done", summary: "Talked about a study plan.", counselor: "Meera" });
    expect(await w.s2.as.query(api.counsel.mine, {})).toEqual([]);
  });
});

describe("the call and its recording", () => {
  test("the two members may join only inside the window; nobody else may join; the counselor and people they share with may watch", async () => {
    const w = await world();
    const a = await open(w, 2);
    const booking = await bookAs(w.s, a);
    const access = (p: World["s"], now: number) => p.as.query(internal.counsel.callAccess, { bookingId: booking, now });
    expect(await access(w.s, NOW)).toMatchObject({ ok: true, mayJoin: false, mayWatch: false });
    const start = slotAt(2);
    expect(await access(w.s, start - 5 * 60_000)).toMatchObject({ ok: true, mayJoin: true, mayWatch: false });
    expect(await access(w.counselor, start + 10 * 60_000)).toMatchObject({ ok: true, mayJoin: true, mayWatch: true });
    expect(await access(w.s, start + SLOT_MS + 31 * 60_000)).toMatchObject({ mayJoin: false });
    for (const p of [w.s2, w.teacher, w.A.admin, w.dhi]) expect(await access(p, start)).toEqual({ ok: false, code: "not_found" });

    expect(await w.counselor.as.mutation(api.counsel.shareRecording, { bookingId: booking, email: "nobody@alpha.test" })).toEqual({ ok: false, code: "no_such_person" });
    expect(await w.counselor.as.mutation(api.counsel.shareRecording, { bookingId: booking, email: "admin-a@alpha.test" })).toEqual({ ok: true });
    expect(await access(w.A.admin, start)).toMatchObject({ ok: true, mayJoin: false, mayWatch: true });
    expect(await w.A.admin.as.query(api.counsel.sharedWithMe, {})).toMatchObject([{ bookingId: booking, counselor: "Meera" }]);
    await w.counselor.as.mutation(api.counsel.unshareRecording, { bookingId: booking, email: "admin-a@alpha.test" });
    expect(await access(w.A.admin, start)).toEqual({ ok: false, code: "not_found" });
    expect(await refusal(w.s.as.mutation(api.counsel.shareRecording, { bookingId: booking, email: "ravi@alpha.test" }))).toBe("forbidden");
  });
});

describe("export and erase", () => {
  test("the download holds the student's bookings; the erase removes them and the shares, opens a future slot, and asks Stream to delete the recordings", async () => {
    const w = await world();
    const a = await open(w, 2);
    const booking = await bookAs(w.s, a, "my note");
    await w.counselor.as.mutation(api.counsel.shareRecording, { bookingId: booking, email: "admin-a@alpha.test" });
    const page = await w.t.run((ctx) => counselRoom.exporter(ctx, w.s.memberId, null, 10));
    expect(page.rows).toMatchObject([{ note: "my note", counselor: "Meera", status: "booked", recordedOnStream: true }]);
    const erased = await w.t.run((ctx) => counselRoom.eraser(ctx, w.s.memberId, 10));
    expect(erased).toEqual({ deleted: 1, done: true });
    const left = await w.t.run(async (ctx) => ({
      bookings: (await ctx.db.query("counselBookings").take(5)).length,
      shares: (await ctx.db.query("counselShares").take(5)).length,
      slot: (await ctx.db.get(a))?.status,
      scheduled: (await ctx.db.system.query("_scheduled_functions").take(5)).map((f) => f.name),
    }));
    expect(left).toMatchObject({ bookings: 0, shares: 0, slot: "open" });
    expect(left.scheduled.some((n) => n.includes("counselCall") && n.includes("forget"))).toBe(true);
  });
});
