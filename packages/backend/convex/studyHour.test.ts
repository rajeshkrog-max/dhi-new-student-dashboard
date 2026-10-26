// The study hour (spec house/0015). Each test names the criterion it covers. Time is fixed and moved with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { hourRoom } from "./hourRoom";
import { MAX_MESSAGE, canSee, cleanMessage, minutesPresent, overlaps, seatIsCurrent, windowProblem } from "./hourRules";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

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
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const otherTeacher = await makeTeacher(t, A.admin, "other@alpha.test", [a2]);
  const s1 = await makeStudent(t, A.admin, a1, "s1@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  const s3 = await makeStudent(t, A.admin, a2, "s3@alpha.test", false);
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const outsider = await makeStudent(t, B.admin, b1, "outsider@beta.test", false);
  await t.run(async (ctx) => {
    for (const p of [s1, s2, s3, outsider]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, teacher, otherTeacher, s1, s2, s3, outsider };
}

// An hour open now, closing in an hour.
async function openNow(w: Awaited<ReturnType<typeof world>>) {
  return await w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW - 10 * MIN, closesAt: NOW + HOUR });
}
const presenceEvents = async (w: Awaited<ReturnType<typeof world>>) => (await w.t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.room === "hour");

describe("the study hour clock", () => {
  test("covers AC-1: only a DHI admin sets the hour, and it must be a real window that closes in the future and overlaps no other", async () => {
    const w = await world();
    expect(await refusal(w.s1.as.mutation(api.studyHour.set, { opensAt: NOW, closesAt: NOW + HOUR }))).toBe("forbidden");
    expect(await refusal(w.teacher.as.mutation(api.studyHour.set, { opensAt: NOW, closesAt: NOW + HOUR }))).toBe("forbidden");
    expect(await refusal(w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW, closesAt: NOW + 60_000 }))).toBe("bad_window");
    expect(await refusal(w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW - 3 * HOUR, closesAt: NOW - HOUR }))).toBe("bad_window");
    await w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW, closesAt: NOW + HOUR });
    expect(await refusal(w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW + 30 * MIN, closesAt: NOW + 2 * HOUR }))).toBe("overlap");
    await w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW + HOUR, closesAt: NOW + 2 * HOUR });
    expect(await w.dhi.as.query(api.studyHour.hours, {})).toHaveLength(2);
  });

  test("covers AC-2: entry before the hour opens, and after it closes, is refused", async () => {
    const w = await world();
    await w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW + HOUR, closesAt: NOW + 2 * HOUR });
    expect(await w.s1.as.mutation(api.studyHour.enter, { mode: "live" })).toEqual({ ok: false, code: "not_open" });
    expect(await w.s1.as.query(api.studyHour.current, {})).toMatchObject({ state: "upcoming" });
    vi.setSystemTime(NOW + HOUR + 5 * MIN);
    expect(await w.s1.as.mutation(api.studyHour.enter, { mode: "live" })).toEqual({ ok: true });
    vi.setSystemTime(NOW + 3 * HOUR);
    expect(await w.s2.as.mutation(api.studyHour.enter, { mode: "live" })).toEqual({ ok: false, code: "closed" });
  });

  test("covers AC-2: a bad mode is refused, and a teacher has no seat", async () => {
    const w = await world();
    await openNow(w);
    expect(await w.s1.as.mutation(api.studyHour.enter, { mode: "loud" })).toEqual({ ok: false, code: "bad_mode" });
    expect(await refusal(w.teacher.as.mutation(api.studyHour.enter, { mode: "live" }))).toBe("forbidden");
  });
});

describe("seats and modes", () => {
  test("covers AC-3 and AC-5: a seated student sees the seats of their own institute only, and an unseated student sees none", async () => {
    const w = await world();
    await openNow(w);
    expect(await w.s1.as.query(api.studyHour.seats, {})).toEqual({ seated: false, people: [] });
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s2.as.mutation(api.studyHour.enter, { mode: "away" });
    await w.outsider.as.mutation(api.studyHour.enter, { mode: "live" });
    const seen = await w.s1.as.query(api.studyHour.seats, {});
    expect(seen.seated).toBe(true);
    expect(seen.people.map((p) => p.mode).sort()).toEqual(["away", "live"]);
    expect(seen.people.some((p) => p.name.includes("outsider"))).toBe(false);
    expect((await w.outsider.as.query(api.studyHour.seats, {})).people).toHaveLength(1);
  });

  test("covers AC-5: Do not disturb hides the student from others, and shows them no one", async () => {
    const w = await world();
    await openNow(w);
    await w.s1.as.mutation(api.studyHour.enter, { mode: "dnd" });
    await w.s2.as.mutation(api.studyHour.enter, { mode: "live" });
    expect((await w.s2.as.query(api.studyHour.seats, {})).people.map((p) => p.mine)).toEqual([true]);
    const quiet = await w.s1.as.query(api.studyHour.seats, {});
    expect(quiet.seated).toBe(true);
    expect(quiet.people.map((p) => p.mine)).toEqual([true]);
  });

  test("covers AC-5: the mode can be changed while seated, and the seat is the same one", async () => {
    const w = await world();
    await openNow(w);
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s1.as.mutation(api.studyHour.enter, { mode: "away" });
    expect((await w.s1.as.query(api.studyHour.current, {})).mySeat).toEqual({ mode: "away" });
    expect(await w.t.run((ctx) => ctx.db.query("seats").collect())).toHaveLength(1);
  });

  test("covers AC-4: leaving drops the seat and writes the minutes as one event holding only a number", async () => {
    const w = await world();
    await openNow(w);
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    for (let i = 1; i <= 9; i += 1) {
      vi.setSystemTime(NOW + i * 30 * 1000);
      await w.s1.as.mutation(api.studyHour.beat, {});
    }
    vi.setSystemTime(NOW + 5 * MIN);
    await w.s1.as.mutation(api.studyHour.leave, {});
    const events = await presenceEvents(w);
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ minutes: 5, lateMinutes: 0 });
    expect((await w.s1.as.query(api.studyHour.seats, {})).seated).toBe(false);
  });

  test("covers AC-4: a seat with no heartbeat for 60 seconds is dropped by the sweep, counted until its last heartbeat", async () => {
    const w = await world();
    await openNow(w);
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    for (let i = 1; i <= 10; i += 1) {
      vi.setSystemTime(NOW + i * 30 * 1000);
      await w.s1.as.mutation(api.studyHour.beat, {});
    }
    // The tab closes: no more heartbeats. Seven minutes later the sweep runs.
    vi.setSystemTime(NOW + 12 * MIN);
    expect(await w.t.mutation(internal.studyHour.sweep, {})).toBe(1);
    const events = await presenceEvents(w);
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ minutes: 5, lateMinutes: 0 });
    expect(await w.t.mutation(internal.studyHour.sweep, {})).toBe(0);
  });

  test("covers AC-4: a seat that keeps its heartbeat is not dropped, and the hour closing drops every seat at the close", async () => {
    const w = await world();
    await openNow(w);
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    vi.setSystemTime(NOW + 30 * 1000);
    await w.s1.as.mutation(api.studyHour.beat, {});
    vi.setSystemTime(NOW + 50 * 1000);
    expect(await w.t.mutation(internal.studyHour.sweep, {})).toBe(0);
    // Beat to the end of the hour, then the hour closes.
    for (let i = 2; i <= 120; i += 1) {
      vi.setSystemTime(NOW + i * 30 * 1000);
      if (NOW + i * 30 * 1000 < NOW + HOUR) await w.s1.as.mutation(api.studyHour.beat, {});
    }
    vi.setSystemTime(NOW + HOUR + 10 * MIN);
    expect(await w.s1.as.mutation(api.studyHour.beat, {})).toEqual({ open: false, seated: false });
    const events = await presenceEvents(w);
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ minutes: 59, lateMinutes: 0 });
  });
});

describe("chat", () => {
  test("covers AC-6: a seated student chats, and classmates of the same institute read it", async () => {
    const w = await world();
    await openNow(w);
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s2.as.mutation(api.studyHour.enter, { mode: "away" });
    expect(await w.s1.as.mutation(api.studyHour.chat, { text: "  Let us begin  " })).toEqual({ ok: true });
    expect((await w.s2.as.query(api.studyHour.messages, {})).map((m) => m.text)).toEqual(["Let us begin"]);
    expect((await w.s1.as.query(api.studyHour.messages, {}))[0].mine).toBe(true);
  });

  test("covers AC-5 and AC-6: chat is refused without a seat and in Do not disturb, and Do not disturb reads none", async () => {
    const w = await world();
    await openNow(w);
    expect(await w.s1.as.mutation(api.studyHour.chat, { text: "hi" })).toEqual({ ok: false, code: "not_seated" });
    await w.s1.as.mutation(api.studyHour.enter, { mode: "dnd" });
    expect(await w.s1.as.mutation(api.studyHour.chat, { text: "hi" })).toEqual({ ok: false, code: "dnd" });
    await w.s2.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s2.as.mutation(api.studyHour.chat, { text: "hello" });
    expect(await w.s1.as.query(api.studyHour.messages, {})).toEqual([]);
  });

  test("covers AC-6: another institute reads nothing, and a message is limited to 300 characters", async () => {
    const w = await world();
    await openNow(w);
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.outsider.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s1.as.mutation(api.studyHour.chat, { text: "private to Alpha" });
    expect(await w.outsider.as.query(api.studyHour.messages, {})).toEqual([]);
    expect(await w.s1.as.mutation(api.studyHour.chat, { text: "x".repeat(MAX_MESSAGE + 1) })).toEqual({ ok: false, code: "bad_text" });
    expect(await w.s1.as.mutation(api.studyHour.chat, { text: "   " })).toEqual({ ok: false, code: "bad_text" });
  });

  test("covers AC-6: a student reports a message of their own institute in the open hour, and not another institute's", async () => {
    const w = await world();
    await openNow(w);
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s2.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s1.as.mutation(api.studyHour.chat, { text: "something unkind" });
    const [m] = await w.s2.as.query(api.studyHour.messages, {});
    expect(await refusal(w.outsider.as.mutation(api.studyHour.report, { messageId: m.messageId }))).toBe("not_found");
    await w.s2.as.mutation(api.studyHour.report, { messageId: m.messageId });
    expect((await w.dhi.as.query(api.studyHour.review, {})).map((r) => r.text)).toEqual(["something unkind"]);
  });

  test("covers AC-6: a teacher reviews the chat of their own classes only, and hides a message, which then disappears", async () => {
    const w = await world();
    await openNow(w);
    for (const s of [w.s1, w.s2, w.s3]) await s.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s1.as.mutation(api.studyHour.chat, { text: "from class A" });
    await w.s3.as.mutation(api.studyHour.chat, { text: "from class B" });
    expect((await w.teacher.as.query(api.studyHour.review, {})).map((r) => r.text)).toEqual(["from class A"]);
    expect((await w.otherTeacher.as.query(api.studyHour.review, {})).map((r) => r.text)).toEqual(["from class B"]);
    const [row] = await w.teacher.as.query(api.studyHour.review, {});
    expect(await refusal(w.otherTeacher.as.mutation(api.studyHour.hideMessage, { messageId: row.messageId }))).toBe("forbidden");
    expect(await refusal(w.s2.as.mutation(api.studyHour.hideMessage, { messageId: row.messageId }))).toBe("forbidden");
    await w.teacher.as.mutation(api.studyHour.hideMessage, { messageId: row.messageId });
    expect((await w.s2.as.query(api.studyHour.messages, {})).map((m) => m.text)).toEqual(["from class B"]);
  });
});

describe("export and erase", () => {
  test("covers AC-7: the export holds the day, the mode and the minutes, and erase removes the seats and the chat", async () => {
    const w = await world();
    await openNow(w);
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s1.as.mutation(api.studyHour.chat, { text: "hello" });
    for (let i = 1; i <= 5; i += 1) {
      vi.setSystemTime(NOW + i * 30 * 1000);
      await w.s1.as.mutation(api.studyHour.beat, {});
    }
    vi.setSystemTime(NOW + 3 * MIN);
    await w.s1.as.mutation(api.studyHour.leave, {});
    const page = await w.t.run((ctx) => hourRoom.exporter(ctx, w.s1.memberId, null, 10));
    expect(page.rows).toEqual([{ day: "2026-10-20", mode: "live", minutes: 3, card: "none", feel: "", focus: 0 }]);
    await w.t.run((ctx) => hourRoom.eraser(ctx, w.s1.memberId, 10));
    const left = await w.t.run(async (ctx) => ({ seats: (await ctx.db.query("seats").collect()).length, chat: (await ctx.db.query("chatMessages").collect()).length }));
    expect(left).toEqual({ seats: 0, chat: 0 });
  });
});

describe("the hour rules", () => {
  test("the window, the overlap and the visibility matrix", () => {
    expect(windowProblem(0, 4 * MIN)).toBe("bad_window");
    expect(windowProblem(0, 5 * MIN)).toBeNull();
    expect(windowProblem(0, 9 * HOUR)).toBe("bad_window");
    expect(overlaps({ opensAt: 0, closesAt: 10 }, { opensAt: 10, closesAt: 20 })).toBe(false);
    expect(overlaps({ opensAt: 0, closesAt: 11 }, { opensAt: 10, closesAt: 20 })).toBe(true);
    expect(canSee("live", "live")).toBe(true);
    expect(canSee("live", "away")).toBe(true);
    expect(canSee("live", "dnd")).toBe(false);
    expect(canSee("dnd", "live")).toBe(false);
    expect(canSee("away", "dnd")).toBe(false);
  });

  test("minutes are whole, and a seat is current only with a recent heartbeat in an open hour", () => {
    expect(minutesPresent(0, 59_999)).toBe(0);
    expect(minutesPresent(0, 61_000)).toBe(1);
    const hour = { opensAt: 0, closesAt: 1000 * 60 * 60 };
    expect(seatIsCurrent({ lastBeatAt: 100_000 }, hour, 150_000)).toBe(true);
    expect(seatIsCurrent({ lastBeatAt: 100_000 }, hour, 161_000)).toBe(false);
    expect(seatIsCurrent({ leftAt: 120_000, lastBeatAt: 100_000 }, hour, 130_000)).toBe(false);
    expect(cleanMessage("  hi ")).toBe("hi");
    expect(cleanMessage("")).toBeNull();
  });
});
