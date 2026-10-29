/// <reference types="vite/client" />
// The staff houses (house spec 0026). Each test names the criterion it covers. Time is fixed with a fake clock; every person is made up.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T10:00:00+05:30");
const HOUR = 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

const mcq = { kind: "mcq" as const, subject: "Maths", topic: "Fractions", text: "Half of four?", options: ["one", "two", "three"], rightOption: 1, tags: ["misread", null, "concept"] };

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const other = await makeTeacher(t, A.admin, "other@alpha.test", [a2]);
  const s1 = await makeStudent(t, A.admin, a1, "s1@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  const minor = await makeStudent(t, A.admin, a1, "minor@alpha.test", true, { consent: false });
  const s3 = await makeStudent(t, A.admin, a2, "s3@alpha.test", false);
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  return { t, dhi, A, a1, a2, teacher, other, s1, s2, minor, s3, B };
}

async function sendPaper(teacher: Person, classId: Id<"classes">, dueAt: number) {
  const id = await teacher.as.mutation(api.papers.create, { title: "Term test", questions: [mcq] });
  await teacher.as.mutation(api.papers.send, { paperId: id, target: { kind: "class", classId }, opensAt: NOW - HOUR, dueAt });
  return id;
}

describe("the staff home", () => {
  test("covers AC-1: a teacher's to-dos count papers to mark and confirm, papers closing soon, and posts waiting in their classes", async () => {
    const { t, teacher, a1, s1, s2 } = await world();
    const paper = await sendPaper(teacher, a1, NOW + 10 * HOUR);
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("paperAttempts").withIndex("by_paperId_and_memberId", (q) => q.eq("paperId", paper)).take(10)) {
        if (row.memberId === s1.memberId) await ctx.db.patch(row._id, { status: "submitted", missed: false });
        if (row.memberId === s2.memberId) await ctx.db.patch(row._id, { status: "marked", missed: false });
      }
    });
    await s1.as.mutation(api.blog.write, { title: "My day", tag: "reflection", body: "<p>Made up words.</p>" });
    expect(await teacher.as.query(api.staffHome.todo, { now: NOW })).toEqual({ role: "teacher", toMark: 1, toConfirm: 1, postsToReview: 1, commentsToReview: 0, closingSoon: 1 });
  });

  test("covers AC-1: another class's teacher sees none of it", async () => {
    const { other, teacher, a1, s1 } = await world();
    await sendPaper(teacher, a1, NOW + 10 * HOUR);
    await s1.as.mutation(api.blog.write, { title: "My day", tag: "reflection", body: "<p>Made up words.</p>" });
    expect(await other.as.query(api.staffHome.todo, { now: NOW })).toMatchObject({ toMark: 0, postsToReview: 0, closingSoon: 0 });
  });

  test("covers AC-2: an institute admin's to-dos count parent consents waiting, invites pending and expiring, and paused classes", async () => {
    const { A, a2 } = await world();
    await A.admin.as.mutation(api.invites.create, { role: "student", email: "new@alpha.test", name: "New Made", classId: a2, under18: false });
    await A.admin.as.mutation(api.classes.pause, { classId: a2 });
    expect(await A.admin.as.query(api.staffHome.todo, { now: NOW })).toEqual({ role: "institute_admin", parentWaiting: 1, invitesPending: 1, invitesExpiring: 0, classesPaused: 1 });
    expect(await A.admin.as.query(api.staffHome.todo, { now: NOW + 12 * 24 * HOUR })).toMatchObject({ invitesPending: 1, invitesExpiring: 1 });
  });

  test("covers AC-3: a DHI admin's to-dos count dishes waiting, desk questions today, paused institutes and counselor invites", async () => {
    const { t, dhi, B } = await world();
    await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counsel@example.test", name: "Made Counselor" });
    await dhi.as.mutation(api.institutes.update, { instituteId: B.instituteId, status: "suspended" });
    await t.run((ctx) => ctx.db.insert("deskDaily", { day: "2026-10-20", questions: 7 }));
    expect(await dhi.as.query(api.staffHome.todo, { now: NOW })).toEqual({ role: "dhi_admin", filmsWaiting: 0, dishesWaiting: 0, deskToday: 7, institutesPaused: 1, counselorInvitesPending: 1, institutesWithoutAdmin: 0 });
  });

  test("a DHI admin is told when an institute has students but no institute admin, since only one can record a parent's consent", async () => {
    const { t, dhi, A } = await world();
    expect(await dhi.as.query(api.staffHome.todo, { now: NOW })).toMatchObject({ institutesWithoutAdmin: 0 });
    await t.run((ctx) => ctx.db.patch(A.admin.memberId, { status: "removed" }));
    expect(await dhi.as.query(api.staffHome.todo, { now: NOW })).toMatchObject({ institutesWithoutAdmin: 1 });
    // An institute with no student yet (Beta) is not counted, and a paused one is not either.
    await dhi.as.mutation(api.institutes.update, { instituteId: A.instituteId, status: "suspended" });
    expect(await dhi.as.query(api.staffHome.todo, { now: NOW })).toMatchObject({ institutesWithoutAdmin: 0 });
  });

  test("People tells an admin which students cannot enter yet and why, and tells a teacher nothing", async () => {
    const { A, a1, teacher, minor, s1 } = await world();
    const rows = (await A.admin.as.query(api.members.list, { paginationOpts: { numItems: 25, cursor: null }, instituteId: A.instituteId, role: "student" })).page;
    expect(rows.find((r) => r._id === minor.memberId)?.waiting).toBe("parent");
    expect(rows.find((r) => r._id === s1.memberId)?.waiting).toBeUndefined();
    const seen = (await teacher.as.query(api.members.list, { paginationOpts: { numItems: 25, cursor: null }, classId: a1 })).page;
    expect(seen.every((r) => r.waiting === undefined)).toBe(true);
  });

  test("covers AC-1: a student gets nothing", async () => {
    const { s1 } = await world();
    expect(await s1.as.query(api.staffHome.todo, { now: NOW })).toBeNull();
  });
});

describe("the DHI admin's overview and counselor roster", () => {
  test("covers AC-4: counts per institute, and no name of anyone in it", async () => {
    const { dhi, teacher, a1 } = await world();
    await sendPaper(teacher, a1, NOW + 10 * HOUR);
    const rows = await dhi.as.query(api.staffHome.overview, { now: NOW });
    expect(rows.map((r) => r.name)).toEqual(["Alpha School", "Beta School"]);
    expect(rows[0]).toMatchObject({ classes: 2, students: 4, staff: 3, invitesPending: 0, papersThisMonth: 1, deskThisMonth: 0 });
    const text = JSON.stringify(rows);
    for (const word of ["Asha", "Test Teacher", "Head Teacher", "@alpha.test"]) expect(text).not.toContain(word);
  });

  test("covers AC-4 and AC-5: only a DHI admin opens the overview or the roster", async () => {
    const { A, teacher, s1 } = await world();
    for (const who of [A.admin, teacher, s1]) {
      expect(await refusal(who.as.query(api.staffHome.overview, { now: NOW }))).toBe("forbidden");
      expect(await refusal(who.as.query(api.staffHome.counselors, { now: NOW }))).toBe("forbidden");
    }
  });

  test("covers AC-5: the roster lists counselors with their open times and pending invites, never a booking or a student", async () => {
    const { t, dhi, s1 } = await world();
    await dhi.as.mutation(api.invites.create, { role: "counselor", email: "c1@example.com", name: "Made Counselor" });
    const c1 = await joinAs(t, "c1@example.com", { name: "Made Counselor" });
    await dhi.as.mutation(api.invites.create, { role: "counselor", email: "c2@example.com", name: "Second Counselor" });
    const tomorrow = Math.ceil((NOW + 24 * HOUR) / (30 * 60 * 1000)) * 30 * 60 * 1000;
    await c1.as.mutation(api.counsel.openSlot, { startsAt: tomorrow });
    const booked = await c1.as.mutation(api.counsel.openSlot, { startsAt: tomorrow + 30 * 60 * 1000 });
    if (!booked.ok) throw new Error("slot");
    await s1.as.mutation(api.counsel.book, { slotId: booked.slotId, note: "A made up note" });
    const r = await dhi.as.query(api.staffHome.counselors, { now: NOW });
    expect(r.counselors).toEqual([{ memberId: c1.memberId, name: "Made Counselor", email: "c1@example.com", status: "active", openTimes: 1 }]);
    expect(r.invites.map((i) => i.email)).toEqual(["c2@example.com"]);
    expect(JSON.stringify(r)).not.toContain("made up note");
    // Pausing a counselor is the existing remove, which a DHI admin may do.
    expect(await dhi.as.mutation(api.members.remove, { memberId: c1.memberId })).toEqual({ status: "removed" });
    expect((await dhi.as.query(api.staffHome.counselors, { now: NOW })).counselors[0].status).toBe("removed");
  });
});

describe("the teacher's page per student", () => {
  test("covers AC-6: the class's teacher sees every paper's state, confirmed marks and remarks, and the student sees the look", async () => {
    const { t, teacher, a1, s1 } = await world();
    const p1 = await sendPaper(teacher, a1, NOW + HOUR);
    const p2 = await sendPaper(teacher, a1, NOW + 2 * HOUR);
    await t.run(async (ctx) => {
      for (const row of await ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", s1.memberId)).take(10)) {
        if (row.paperId === p1) await ctx.db.patch(row._id, { status: "confirmed", missed: false, mcqCorrect: 1, remarks: "Well done." });
        if (row.paperId === p2) await ctx.db.patch(row._id, { status: "submitted", missed: true });
      }
    });
    const page = await teacher.as.mutation(api.papers.studentForTeacher, { memberId: s1.memberId });
    expect(page.className).toBe("Class 10 A");
    expect(page.papers.map((p) => [p.state, p.total, p.maxTotal, p.remarks])).toEqual([
      ["missed", 0, 1, ""],
      ["confirmed", 1, 1, "Well done."],
    ]);
    expect(JSON.stringify(page)).not.toContain("answers");
    const views = await t.run((ctx) => ctx.db.query("viewLog").take(10));
    expect(views.map((v) => [v.targetMemberId, v.kind])).toEqual([[s1.memberId, "academic"]]);
  });

  test("covers AC-6: another class's teacher, the institute admin and a student cannot open it; a withdrawn student is not found", async () => {
    const { other, A, s1, s2, s3, teacher } = await world();
    for (const who of [other, A.admin, s2]) expect(await refusal(who.as.mutation(api.papers.studentForTeacher, { memberId: s1.memberId }))).toBe("forbidden");
    expect(await refusal(teacher.as.mutation(api.papers.studentForTeacher, { memberId: s3.memberId }))).toBe("forbidden");
    await s1.as.mutation(api.consent.withdraw, {});
    expect(await refusal(teacher.as.mutation(api.papers.studentForTeacher, { memberId: s1.memberId }))).toBe("not_found");
  });

  test("covers AC-7: the staff home's files read no room, Brain, desk words or counseling content", () => {
    const files = import.meta.glob(["./staffHome.ts"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const code = Object.values(files)[0].replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/moodDays|sleepNights|mealPlates|habitChecks|brainDays|events|counselBookings|\.question\b|\.answer\b|\.note\b/);
  });
});
