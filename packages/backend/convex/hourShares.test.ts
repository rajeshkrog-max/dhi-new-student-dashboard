// The study hour call's access, recordings and shares (house spec 0027). Each test names the criterion it covers. The Stream calls themselves are
// proved in the browser (pnpm hourcall:check); here is who may join, watch and share, and what a look and an erase leave. Every person is made up.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { hourRoom } from "./hourRoom";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const NOW = Date.parse("2026-10-20T18:00:00+05:30");
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
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s1 = await makeStudent(t, A.admin, a1, "s1@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const betaTeacher = await makeTeacher(t, B.admin, "teacher@beta.test", [b1]);
  const outsider = await makeStudent(t, B.admin, b1, "outsider@beta.test", false);
  const hourId = await dhi.as.mutation(api.studyHour.set, { opensAt: NOW - 10 * MIN, closesAt: NOW + HOUR });
  return { t, dhi, A, a1, teacher, s1, s2, B, b1, betaTeacher, outsider, hourId };
}

describe("joining the study hour call", () => {
  test("covers AC-1: only a Live seat joins, as a member of its own institute's call", async () => {
    const w = await world();
    expect(await w.s1.as.query(internal.hourShares.joinAccess, { now: NOW })).toEqual({ ok: false, code: "not_live" });
    await w.s1.as.mutation(api.studyHour.enter, { mode: "away" });
    expect(await w.s1.as.query(internal.hourShares.joinAccess, { now: NOW })).toEqual({ ok: false, code: "not_live" });
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    expect(await w.s1.as.query(internal.hourShares.joinAccess, { now: NOW })).toMatchObject({ ok: true, role: "call_member", hourId: w.hourId, instituteId: w.A.instituteId, me: { name: "Asha" } });
    // A student cannot name another institute's call: the call is always their seat's.
    await w.outsider.as.mutation(api.studyHour.enter, { mode: "live" });
    expect(await w.outsider.as.query(internal.hourShares.joinAccess, { now: NOW, instituteId: w.A.instituteId })).toMatchObject({ ok: true, instituteId: w.B.instituteId });
  });

  test("covers AC-2: a teacher joins their own institute's call as a moderator; a DHI admin names one; an institute admin cannot", async () => {
    const w = await world();
    expect(await w.teacher.as.query(internal.hourShares.joinAccess, { now: NOW })).toMatchObject({ ok: true, role: "moderator", instituteId: w.A.instituteId });
    expect(await w.teacher.as.query(internal.hourShares.joinAccess, { now: NOW, instituteId: w.B.instituteId })).toEqual({ ok: false, code: "forbidden" });
    expect(await w.dhi.as.query(internal.hourShares.joinAccess, { now: NOW })).toEqual({ ok: false, code: "forbidden" });
    expect(await w.dhi.as.query(internal.hourShares.joinAccess, { now: NOW, instituteId: w.B.instituteId })).toMatchObject({ ok: true, role: "moderator", instituteId: w.B.instituteId });
    expect(await w.A.admin.as.query(internal.hourShares.joinAccess, { now: NOW })).toEqual({ ok: false, code: "forbidden" });
  });

  test("covers AC-1: no call outside an open hour", async () => {
    const w = await world();
    expect(await w.teacher.as.query(internal.hourShares.joinAccess, { now: NOW + 2 * HOUR })).toEqual({ ok: false, code: "not_open" });
    expect(await w.teacher.as.query(api.hourShares.openNow, { now: NOW + 2 * HOUR })).toBeNull();
    expect(await w.teacher.as.query(api.hourShares.openNow, { now: NOW })).toMatchObject({ hourId: w.hourId });
    expect(await refusal(w.s1.as.query(api.hourShares.openNow, { now: NOW }))).toBe("forbidden");
  });
});

describe("watching and sharing the recordings", () => {
  test("covers AC-4: the institute's teacher and a DHI admin watch; another institute's teacher and an unshared student do not", async () => {
    const w = await world();
    const args = { hourId: w.hourId, instituteId: w.A.instituteId };
    expect(await w.teacher.as.query(internal.hourShares.watchAccess, args)).toMatchObject({ ok: true, staff: true, viewerRole: "teacher" });
    expect(await w.dhi.as.query(internal.hourShares.watchAccess, args)).toMatchObject({ ok: true, staff: true, viewerRole: "dhi_admin" });
    expect(await w.betaTeacher.as.query(internal.hourShares.watchAccess, args)).toEqual({ ok: false, code: "not_found" });
    expect(await w.s1.as.query(internal.hourShares.watchAccess, args)).toEqual({ ok: false, code: "not_found" });
    expect(await w.A.admin.as.query(internal.hourShares.watchAccess, args)).toEqual({ ok: false, code: "not_found" });
  });

  test("covers AC-5: a share reaches only a student of that institute, who then watches it; taking it back ends that", async () => {
    const w = await world();
    const args = { hourId: w.hourId, instituteId: w.A.instituteId };
    expect(await w.teacher.as.mutation(api.hourShares.share, { ...args, email: "outsider@beta.test" })).toEqual({ ok: false, code: "no_such_student" });
    expect(await w.teacher.as.mutation(api.hourShares.share, { ...args, email: "teacher@alpha.test" })).toEqual({ ok: false, code: "no_such_student" });
    expect(await w.teacher.as.mutation(api.hourShares.share, { ...args, email: "S1@alpha.test" })).toEqual({ ok: true });
    expect(await w.s1.as.query(internal.hourShares.watchAccess, args)).toMatchObject({ ok: true, staff: false });
    expect((await w.s1.as.query(api.hourShares.sharedWithMe, {})).map((s) => s.hourId)).toEqual([w.hourId]);
    expect(await refusal(w.betaTeacher.as.mutation(api.hourShares.share, { ...args, email: "s2@alpha.test" }))).toBe("forbidden");
    expect(await refusal(w.s2.as.mutation(api.hourShares.share, { ...args, email: "s2@alpha.test" }))).toBe("forbidden");
    await w.dhi.as.mutation(api.hourShares.unshare, { ...args, email: "s1@alpha.test" });
    expect(await w.s1.as.query(internal.hourShares.watchAccess, args)).toEqual({ ok: false, code: "not_found" });
  });

  test("covers AC-6: a staff look is written for every student seated in that hour, and only them", async () => {
    const w = await world();
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.s2.as.mutation(api.studyHour.enter, { mode: "away" });
    await w.outsider.as.mutation(api.studyHour.enter, { mode: "live" });
    const n = await w.t.mutation(internal.hourShares.recordWatch, { hourId: w.hourId, instituteId: w.A.instituteId, viewerId: w.teacher.memberId, viewerRole: "teacher" });
    expect(n).toBe(2);
    const views = await w.t.run((ctx) => ctx.db.query("viewLog").take(10));
    expect(views.map((v) => v.targetMemberId).sort()).toEqual([w.s1.memberId, w.s2.memberId].sort());
    expect(views.every((v) => v.kind === "hour" && v.viewerRole === "teacher")).toBe(true);
    // A student watching a recording shared with them writes no look.
    expect(await w.t.mutation(internal.hourShares.recordWatch, { hourId: w.hourId, instituteId: w.A.instituteId, viewerId: w.s1.memberId, viewerRole: "student" })).toBe(0);
  });

  test("covers AC-4: the recorded hours list shows the institute's seated hours of the last 30 days, with their shares", async () => {
    const w = await world();
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.teacher.as.mutation(api.hourShares.share, { hourId: w.hourId, instituteId: w.A.instituteId, email: "s2@alpha.test" });
    const list = await w.teacher.as.query(api.hourShares.recordedHours, { now: NOW });
    expect(list).toEqual([{ hourId: w.hourId, instituteId: w.A.instituteId, opensAt: NOW - 10 * MIN, closesAt: NOW + HOUR, seated: 1, shares: [{ name: "Asha Rao", email: "s2@alpha.test" }] }]);
    expect(await w.betaTeacher.as.query(api.hourShares.recordedHours, { now: NOW })).toEqual([]);
    expect(await refusal(w.dhi.as.query(api.hourShares.recordedHours, { now: NOW }))).toBe("forbidden");
    expect((await w.dhi.as.query(api.hourShares.recordedHours, { now: NOW, instituteId: w.A.instituteId })).length).toBe(1);
    expect(await w.teacher.as.query(api.hourShares.recordedHours, { now: NOW + 31 * DAY })).toEqual([]);
  });

  test("covers AC-7: the daily sweep finds the calls of hours closed more than 30 days ago", async () => {
    const w = await world();
    await w.s1.as.mutation(api.studyHour.enter, { mode: "live" });
    await w.outsider.as.mutation(api.studyHour.enter, { mode: "live" });
    expect(await w.t.query(internal.hourShares.oldCalls, { now: NOW + 10 * DAY })).toEqual([]);
    const old = await w.t.query(internal.hourShares.oldCalls, { now: NOW + 31 * DAY });
    expect(old.map((c) => c.instituteId).sort()).toEqual([w.A.instituteId, w.B.instituteId].sort());
  });

  test("covers AC-8: the student's download names the day of each recording shared with them, never the recording", async () => {
    const w = await world();
    await w.teacher.as.mutation(api.hourShares.share, { hourId: w.hourId, instituteId: w.A.instituteId, email: "s1@alpha.test" });
    const page = await w.t.run((ctx) => hourRoom.exporter(ctx, w.s1.memberId, null, 50));
    expect(page.next).toBe("s:");
    const last = await w.t.run((ctx) => hourRoom.exporter(ctx, w.s1.memberId, "s:", 50));
    expect(last).toEqual({ rows: [{ sharedRecordingOfDay: "2026-10-20", sharedOn: "2026-10-20" }], next: null });
  });

  test("covers AC-8: erasing a student deletes the shares made to them", async () => {
    const w = await world();
    await w.teacher.as.mutation(api.hourShares.share, { hourId: w.hourId, instituteId: w.A.instituteId, email: "s1@alpha.test" });
    await w.t.run(async (ctx) => {
      await hourRoom.eraser(ctx, w.s1.memberId, 50);
    });
    expect(await w.t.run((ctx) => ctx.db.query("hourShares").take(10))).toEqual([]);
  });
});
