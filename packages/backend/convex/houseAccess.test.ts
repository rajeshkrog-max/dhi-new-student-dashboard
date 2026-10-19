// The access matrix of the house (spec house/0002): every role against every function, the walls between institutes, lock out, the last admin
// guards and the daily clean up. Each test names the criterion it covers.
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ABANDONED_AFTER_MS } from "./purge";
import { makeBackend, signInAs } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const page = { numItems: 25, cursor: null };

// Two institutes, a DHI admin, a counselor, and in Alpha: an admin, a teacher assigned to A1, a student in A1, an empty class A2 and a pending
// invite for a student of A1. In Beta: an admin, a class and a student.
async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const student = await makeStudent(t, A.admin, a1, "sa@alpha.test");
  const studentB = await makeStudent(t, B.admin, b1, "sb@beta.test");
  await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counselor@dhi.test", name: "Counselor" });
  const counselor = await joinAs(t, "counselor@dhi.test", { name: "Counselor" });
  const pending = await A.admin.as.mutation(api.invites.create, { role: "student", email: "pending@alpha.test", name: "Pending", classId: a1, under18: false });
  if (!pending.ok) throw new Error("setup");
  return { t, dhi, A, B, a1, a2, b1, teacher, student, studentB, counselor, pendingId: pending.inviteId };
}
type World = Awaited<ReturnType<typeof world>>;

type Role = "dhi" | "admin" | "teacher" | "student" | "counselor";
const ROLES: Role[] = ["dhi", "admin", "teacher", "student", "counselor"];
const personOf = (w: World, role: Role): Person => ({ dhi: w.dhi, admin: w.A.admin, teacher: w.teacher, student: w.student, counselor: w.counselor })[role];

type Call = (w: World, p: Person) => Promise<unknown>;
// [function, how it is called, what each role gets: dhi, admin, teacher, student, counselor]. "ok" or the refusal code.
const MATRIX: [string, Call, [string, string, string, string, string]][] = [
  ["institutes.create", (w, p) => p.as.mutation(api.institutes.create, { name: "New School" }), ["ok", "forbidden", "forbidden", "forbidden", "forbidden"]],
  ["institutes.update", (w, p) => p.as.mutation(api.institutes.update, { instituteId: w.A.instituteId, plan: "pro" }), ["ok", "forbidden", "forbidden", "forbidden", "forbidden"]],
  ["institutes.list", (w, p) => p.as.query(api.institutes.list, { paginationOpts: page }), ["ok", "forbidden", "forbidden", "forbidden", "forbidden"]],
  ["classes.create", (w, p) => p.as.mutation(api.classes.create, { grade: "Class 9", section: "Z", instituteId: w.A.instituteId }), ["ok", "ok", "forbidden", "forbidden", "forbidden"]],
  ["classes.archive", (w, p) => p.as.mutation(api.classes.archive, { classId: w.a2 }), ["ok", "ok", "forbidden", "forbidden", "forbidden"]],
  ["classes.list", (w, p) => p.as.query(api.classes.list, { paginationOpts: page, instituteId: w.A.instituteId }), ["ok", "ok", "ok", "forbidden", "forbidden"]],
  ["classes.assignTeacher", (w, p) => p.as.mutation(api.classes.assignTeacher, { classId: w.a2, memberId: w.teacher.memberId }), ["ok", "ok", "forbidden", "forbidden", "forbidden"]],
  ["classes.unassignTeacher", (w, p) => p.as.mutation(api.classes.unassignTeacher, { classId: w.a1, memberId: w.teacher.memberId }), ["ok", "ok", "forbidden", "forbidden", "forbidden"]],
  ["classes.teachers", (w, p) => p.as.query(api.classes.teachers, { classId: w.a1, paginationOpts: page }), ["ok", "ok", "forbidden", "forbidden", "forbidden"]],
  ["members.list (a class)", (w, p) => p.as.query(api.members.list, { paginationOpts: page, classId: w.a1 }), ["ok", "ok", "ok", "forbidden", "forbidden"]],
  ["members.remove", (w, p) => p.as.mutation(api.members.remove, { memberId: w.student.memberId }), ["ok", "ok", "forbidden", "forbidden", "forbidden"]],
  ["members.reinstate", (w, p) => p.as.mutation(api.members.reinstate, { memberId: w.student.memberId }), ["ok", "ok", "forbidden", "forbidden", "forbidden"]],
  ["members.setClass", (w, p) => p.as.mutation(api.members.setClass, { memberId: w.student.memberId, classId: w.a2 }), ["ok", "ok", "forbidden", "forbidden", "forbidden"]],
  ["members.setUnder18", (w, p) => p.as.mutation(api.members.setUnder18, { memberId: w.student.memberId, under18: true }), ["ok", "forbidden", "forbidden", "forbidden", "forbidden"]],
  ["invites.create (a student)", (w, p) => p.as.mutation(api.invites.create, { role: "student", email: "new@alpha.test", name: "N", classId: w.a1, under18: false, instituteId: w.A.instituteId }), ["ok", "ok", "ok", "forbidden", "forbidden"]],
  ["invites.create (a teacher)", (w, p) => p.as.mutation(api.invites.create, { role: "teacher", email: "newt@alpha.test", name: "N", instituteId: w.A.instituteId }), ["ok", "ok", "forbidden", "forbidden", "forbidden"]],
  ["invites.create (an institute admin)", (w, p) => p.as.mutation(api.invites.create, { role: "institute_admin", email: "newa@alpha.test", name: "N", instituteId: w.A.instituteId }), ["ok", "forbidden", "forbidden", "forbidden", "forbidden"]],
  ["invites.create (a DHI admin)", (w, p) => p.as.mutation(api.invites.create, { role: "dhi_admin", email: "newd@dhi.test", name: "N" }), ["ok", "forbidden", "forbidden", "forbidden", "forbidden"]],
  ["invites.create (a counselor)", (w, p) => p.as.mutation(api.invites.create, { role: "counselor", email: "newc@dhi.test", name: "N" }), ["ok", "forbidden", "forbidden", "forbidden", "forbidden"]],
  ["invites.createBatch", (w, p) => p.as.mutation(api.invites.createBatch, { rows: [{ name: "Z", email: "z@alpha.test", class: "10A", under18: false }], instituteId: w.A.instituteId }), ["ok", "ok", "ok", "forbidden", "forbidden"]],
  ["invites.list", (w, p) => p.as.query(api.invites.list, { paginationOpts: page, classId: w.a1 }), ["ok", "ok", "ok", "forbidden", "forbidden"]],
  ["invites.update", (w, p) => p.as.mutation(api.invites.update, { inviteId: w.pendingId, email: "fixed@alpha.test" }), ["ok", "ok", "ok", "forbidden", "forbidden"]],
  ["invites.extend", (w, p) => p.as.mutation(api.invites.extend, { inviteId: w.pendingId }), ["ok", "ok", "ok", "forbidden", "forbidden"]],
  ["invites.revoke", (w, p) => p.as.mutation(api.invites.revoke, { inviteId: w.pendingId }), ["ok", "ok", "ok", "forbidden", "forbidden"]],
];

describe("the role by function matrix (AC-7, AC-8)", () => {
  for (const [name, call, expected] of MATRIX) {
    test(`covers AC-7, AC-8: ${name}`, async () => {
      for (let i = 0; i < ROLES.length; i++) {
        // A fresh world for each role, so one role's success cannot change what the next one meets.
        const w = await world();
        const got = await refusal(call(w, personOf(w, ROLES[i])));
        expect({ role: ROLES[i], got }).toEqual({ role: ROLES[i], got: expected[i] });
      }
    });
  }

  test("covers AC-7: a signed in stranger and a signed out caller are refused by every function", async () => {
    const w = await world();
    const stranger = await signInAs(w.t, { email: "nobody@example.com" });
    for (const [name, call] of MATRIX) {
      const asStranger = await refusal(call(w, { ...stranger, memberId: w.student.memberId }));
      expect({ name, asStranger }).toEqual({ name, asStranger: "not_a_member" });
      const signedOut = await refusal(call(w, { as: w.t, userId: "", sessionId: "", email: "", memberId: w.student.memberId } as unknown as Person));
      expect({ name, signedOut }).toEqual({ name, signedOut: "not_signed_in" });
    }
  });
});

describe("the walls between institutes (AC-7, AC-8)", () => {
  test("covers AC-7, AC-8: an institute admin cannot read, change or invite into another institute", async () => {
    const w = await world();
    const admin = w.A.admin;
    const code = (p: Promise<unknown>) => refusal(p);
    expect(await code(admin.as.query(api.classes.list, { paginationOpts: page, instituteId: w.B.instituteId }))).toBe("forbidden");
    expect(await code(admin.as.query(api.members.list, { paginationOpts: page, instituteId: w.B.instituteId }))).toBe("forbidden");
    expect(await code(admin.as.query(api.members.list, { paginationOpts: page, classId: w.b1 }))).toBe("class_not_in_scope");
    expect(await code(admin.as.query(api.invites.list, { paginationOpts: page, instituteId: w.B.instituteId }))).toBe("forbidden");
    expect(await code(admin.as.mutation(api.classes.create, { grade: "Class 9", section: "Q", instituteId: w.B.instituteId }))).toBe("forbidden");
    expect(await code(admin.as.mutation(api.classes.archive, { classId: w.b1 }))).toBe("not_found");
    expect(await code(admin.as.mutation(api.classes.assignTeacher, { classId: w.b1, memberId: w.teacher.memberId }))).toBe("not_found");
    expect(await code(admin.as.mutation(api.members.remove, { memberId: w.studentB.memberId }))).toBe("not_found");
    expect(await code(admin.as.mutation(api.members.reinstate, { memberId: w.studentB.memberId }))).toBe("not_found");
    expect(await code(admin.as.mutation(api.members.setClass, { memberId: w.studentB.memberId, classId: w.a1 }))).toBe("not_found");
    expect(await code(admin.as.mutation(api.members.setClass, { memberId: w.student.memberId, classId: w.b1 }))).toBe("class_not_in_scope");
    expect(await code(admin.as.mutation(api.invites.create, { role: "teacher", email: "x@beta.test", name: "X", instituteId: w.B.instituteId }))).toBe("forbidden");
    expect(await code(admin.as.mutation(api.invites.create, { role: "student", email: "y@beta.test", name: "Y", classId: w.b1, under18: false }))).toBe("class_not_found");
    // Nothing of Beta changed.
    const beta = await w.t.run(async (ctx) => await ctx.db.get(w.studentB.memberId));
    expect(beta?.status).toBe("active");
  });

  test("covers AC-7, AC-8: an institute admin cannot touch a DHI admin or a counselor", async () => {
    const w = await world();
    for (const target of [w.dhi, w.counselor]) {
      expect(await refusal(w.A.admin.as.mutation(api.members.remove, { memberId: target.memberId }))).toBe("forbidden");
      expect(await refusal(w.A.admin.as.mutation(api.members.reinstate, { memberId: target.memberId }))).toBe("forbidden");
    }
  });

  test("covers AC-7: a teacher sees only the students of classes assigned to them, and another class is out of scope", async () => {
    const w = await world();
    expect((await w.teacher.as.query(api.members.list, { paginationOpts: page, classId: w.a1 })).page.map((m) => m.name)).toEqual(["Asha Rao"]);
    expect(await refusal(w.teacher.as.query(api.members.list, { paginationOpts: page, classId: w.a2 }))).toBe("class_not_in_scope");
    expect(await refusal(w.teacher.as.query(api.members.list, { paginationOpts: page, classId: w.b1 }))).toBe("class_not_in_scope");
    expect(await refusal(w.teacher.as.query(api.members.list, { paginationOpts: page }))).toBe("class_not_in_scope");
    // Their own class list holds only what is assigned.
    expect((await w.teacher.as.query(api.classes.list, { paginationOpts: page })).page.map((c) => c._id)).toEqual([w.a1]);
    // They cannot invite into a class that is not theirs, nor read its invites.
    expect(await refusal(w.teacher.as.mutation(api.invites.create, { role: "student", email: "n@alpha.test", name: "N", classId: w.a2, under18: false }))).toBe("class_not_in_scope");
    expect(await refusal(w.teacher.as.query(api.invites.list, { paginationOpts: page, classId: w.a2 }))).toBe("class_not_in_scope");
    // And cannot manage an invite of a class that is not theirs.
    const other = await w.A.admin.as.mutation(api.invites.create, { role: "student", email: "other@alpha.test", name: "O", classId: w.a2, under18: false });
    if (!other.ok) throw new Error("setup");
    expect(await refusal(w.teacher.as.mutation(api.invites.revoke, { inviteId: other.inviteId }))).toBe("forbidden");
  });

  test("covers AC-7: a teacher who has just been unassigned loses the class on their very next call", async () => {
    const w = await world();
    expect(await refusal(w.teacher.as.query(api.members.list, { paginationOpts: page, classId: w.a1 }))).toBe("ok");
    await w.A.admin.as.mutation(api.classes.unassignTeacher, { classId: w.a1, memberId: w.teacher.memberId });
    expect(await refusal(w.teacher.as.query(api.members.list, { paginationOpts: page, classId: w.a1 }))).toBe("class_not_in_scope");
    expect(await refusal(w.teacher.as.mutation(api.invites.revoke, { inviteId: w.pendingId }))).toBe("forbidden");
  });

  test("covers AC-7: assigning needs a teacher of the same institute, and unassigning twice is harmless", async () => {
    const w = await world();
    expect(await refusal(w.A.admin.as.mutation(api.classes.assignTeacher, { classId: w.a2, memberId: w.student.memberId }))).toBe("not_a_teacher");
    expect(await refusal(w.A.admin.as.mutation(api.classes.assignTeacher, { classId: w.a2, memberId: w.A.admin.memberId }))).toBe("not_a_teacher");
    await w.A.admin.as.mutation(api.classes.assignTeacher, { classId: w.a2, memberId: w.teacher.memberId });
    await w.A.admin.as.mutation(api.classes.assignTeacher, { classId: w.a2, memberId: w.teacher.memberId });
    expect(await w.t.run(async (ctx) => (await ctx.db.query("teacherClasses").withIndex("by_classId", (q) => q.eq("classId", w.a2)).collect()).length)).toBe(1);
    await w.A.admin.as.mutation(api.classes.unassignTeacher, { classId: w.a2, memberId: w.teacher.memberId });
    expect(await refusal(w.A.admin.as.mutation(api.classes.unassignTeacher, { classId: w.a2, memberId: w.teacher.memberId }))).toBe("ok");
  });

  test("covers AC-7: a student reads only their own membership, and nothing from another institute", async () => {
    const w = await world();
    expect(await w.student.as.query(api.members.me, {})).toMatchObject({ role: "student", name: "Asha Rao", className: "Class 10 A" });
    for (const [name, call] of MATRIX.filter(([n]) => !n.startsWith("classes.list"))) {
      expect({ name, got: await refusal(call(w, w.student)) }).toEqual({ name, got: "forbidden" });
    }
  });
});

describe("lock out (AC-9, AC-16)", () => {
  test("covers AC-9: removing a member locks them out on their next call, leaves their rows untouched, and reinstating restores entry", async () => {
    const w = await world();
    const before = await w.t.run(async (ctx) => await ctx.db.get(w.student.memberId));
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.student.memberId });
    expect(await w.student.as.query(api.members.me, {})).toEqual({ state: "removed" });
    expect(await refusal(w.student.as.query(api.members.list, { paginationOpts: page }))).toBe("removed");
    expect(await refusal(w.student.as.query(api.classes.list, { paginationOpts: page }))).toBe("removed");
    const during = await w.t.run(async (ctx) => await ctx.db.get(w.student.memberId));
    expect({ ...during, status: before?.status, removedAt: undefined }).toEqual({ ...before, removedAt: undefined });
    expect(during?.status).toBe("removed");
    // Removed twice is harmless; an invite for the removed address is still email_in_use, so they can only be reinstated.
    expect(await w.A.admin.as.mutation(api.members.remove, { memberId: w.student.memberId })).toEqual({ status: "removed" });
    await w.A.admin.as.mutation(api.members.reinstate, { memberId: w.student.memberId });
    expect(await w.student.as.query(api.members.me, {})).toMatchObject({ state: "active", role: "student" });
    expect((await w.t.run(async (ctx) => await ctx.db.get(w.student.memberId)))?.removedAt).toBeUndefined();
  });

  test("covers AC-9: a removed teacher is locked out and their assignments stay", async () => {
    const w = await world();
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.teacher.memberId });
    expect(await refusal(w.teacher.as.query(api.members.list, { paginationOpts: page, classId: w.a1 }))).toBe("removed");
    expect(await w.t.run(async (ctx) => (await ctx.db.query("teacherClasses").withIndex("by_memberId", (q) => q.eq("memberId", w.teacher.memberId)).collect()).length)).toBe(1);
  });

  test("covers AC-16: a suspended institute locks out every member at once, and a DHI admin can still see and reinstate it", async () => {
    const w = await world();
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.A.instituteId, status: "suspended" });
    for (const p of [w.A.admin, w.teacher, w.student]) {
      expect(await p.as.query(api.members.me, {})).toMatchObject({ state: "suspended", instituteName: "Alpha School" });
      expect(await refusal(p.as.query(api.members.list, { paginationOpts: page, classId: w.a1 }))).toBe("institute_suspended");
    }
    // Beta is untouched.
    expect(await w.B.admin.as.query(api.members.me, {})).toMatchObject({ state: "active" });
    // The DHI admin can see everything and reinstate, but not add access to it.
    expect((await w.dhi.as.query(api.institutes.list, { paginationOpts: page })).page.find((i) => i.name === "Alpha School")?.status).toBe("suspended");
    expect(await refusal(w.dhi.as.query(api.members.list, { paginationOpts: page, instituteId: w.A.instituteId }))).toBe("ok");
    expect(await w.dhi.as.mutation(api.invites.create, { role: "teacher", email: "n@alpha.test", name: "N", instituteId: w.A.instituteId })).toEqual({ ok: false, code: "institute_suspended" });
    expect(await refusal(w.dhi.as.mutation(api.invites.revoke, { inviteId: w.pendingId }))).toBe("ok");
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.A.instituteId, status: "active" });
    expect(await w.student.as.query(api.members.me, {})).toMatchObject({ state: "active" });
  });

  test("covers AC-16: an institute name is unique, ignoring case", async () => {
    const w = await world();
    expect(await refusal(w.dhi.as.mutation(api.institutes.create, { name: "  alpha SCHOOL " }))).toBe("name_taken");
    expect(await refusal(w.dhi.as.mutation(api.institutes.update, { instituteId: w.B.instituteId, name: "Alpha School" }))).toBe("name_taken");
    expect(await refusal(w.dhi.as.mutation(api.institutes.update, { instituteId: w.B.instituteId, name: "Beta School" }))).toBe("ok");
  });
});

describe("the last admin guards and fixed roles (AC-10, AC-11)", () => {
  test("covers AC-10: the last active DHI admin cannot be removed, but one of two can", async () => {
    const w = await world();
    expect(await refusal(w.dhi.as.mutation(api.members.remove, { memberId: w.dhi.memberId }))).toBe("last_admin");
    await w.dhi.as.mutation(api.invites.create, { role: "dhi_admin", email: "second@dhi.test", name: "Second" });
    const second = await joinAs(w.t, "second@dhi.test");
    expect(await refusal(second.as.mutation(api.members.remove, { memberId: w.dhi.memberId }))).toBe("ok");
    expect(await refusal(second.as.mutation(api.members.remove, { memberId: second.memberId }))).toBe("last_admin");
    expect(await refusal(w.dhi.as.query(api.institutes.list, { paginationOpts: page }))).toBe("removed");
  });

  test("covers AC-10: the last active admin of an active institute cannot be removed, but a suspended institute's can", async () => {
    const w = await world();
    expect(await refusal(w.dhi.as.mutation(api.members.remove, { memberId: w.A.admin.memberId }))).toBe("last_admin");
    expect(await refusal(w.A.admin.as.mutation(api.members.remove, { memberId: w.A.admin.memberId }))).toBe("last_admin");
    await w.A.admin.as.mutation(api.invites.create, { role: "teacher", email: "t2@alpha.test", name: "T2" });
    // A second admin can only be invited by a DHI admin.
    await w.dhi.as.mutation(api.invites.create, { role: "institute_admin", email: "admin2@alpha.test", name: "A2", instituteId: w.A.instituteId });
    const admin2 = await joinAs(w.t, "admin2@alpha.test");
    expect(await refusal(admin2.as.mutation(api.members.remove, { memberId: w.A.admin.memberId }))).toBe("ok");
    expect(await refusal(w.dhi.as.mutation(api.members.remove, { memberId: admin2.memberId }))).toBe("last_admin");
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.A.instituteId, status: "suspended" });
    expect(await refusal(w.dhi.as.mutation(api.members.remove, { memberId: admin2.memberId }))).toBe("ok");
  });

  test("covers AC-10: roles never change after an account is made, and there is no function that changes one", async () => {
    const sources = import.meta.glob("./{members,invites,classes,institutes,bootstrap,demo}.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    for (const [file, source] of Object.entries(sources)) {
      expect({ file, patchesRole: /ctx\.db\.(patch|replace)\([^)]*\brole\b/.test(source) }).toEqual({ file, patchesRole: false });
    }
    const w = await world();
    const member = await w.t.run(async (ctx) => await ctx.db.get(w.student.memberId));
    expect(member?.role).toBe("student");
  });

  test("covers AC-11: the under 18 flag comes from the list, only a DHI admin corrects it, and the correction is logged", async () => {
    const w = await world();
    const flag = async () => (await w.t.run(async (ctx) => await ctx.db.get(w.student.memberId)))?.under18;
    expect(await flag()).toBe(false);
    for (const p of [w.A.admin, w.teacher, w.student, w.counselor]) {
      expect(await refusal(p.as.mutation(api.members.setUnder18, { memberId: w.student.memberId, under18: true }))).toBe("forbidden");
    }
    expect(await flag()).toBe(false);
    await w.dhi.as.mutation(api.members.setUnder18, { memberId: w.student.memberId, under18: true });
    expect(await flag()).toBe(true);
    const log = await w.t.run(async (ctx) => await ctx.db.query("accessLog").collect());
    expect(log.filter((r) => r.action === "member.under18")).toHaveLength(1);
    // A staff member has no such flag to set, and the funnel's age is never read.
    expect(await refusal(w.dhi.as.mutation(api.members.setUnder18, { memberId: w.teacher.memberId, under18: true }))).toBe("forbidden");
    expect(await refusal(w.dhi.as.mutation(api.members.setUnder18, { memberId: w.student.memberId, under18: true }))).toBe("ok");
  });

  test("setClass keeps a student inside their institute and out of archived classes", async () => {
    const w = await world();
    await w.A.admin.as.mutation(api.members.setClass, { memberId: w.student.memberId, classId: w.a2 });
    expect(await w.student.as.query(api.members.me, {})).toMatchObject({ className: "Class 10 B" });
    await w.t.run(async (ctx) => await ctx.db.patch(w.a1, { archivedAt: Date.now() }));
    expect(await refusal(w.A.admin.as.mutation(api.members.setClass, { memberId: w.student.memberId, classId: w.a1 }))).toBe("class_archived");
    expect(await refusal(w.A.admin.as.mutation(api.members.setClass, { memberId: w.A.admin.memberId, classId: w.a2 }))).toBe("forbidden");
  });

  test("a class with an active student cannot be archived, and classes are unique by grade and section", async () => {
    const w = await world();
    expect(await refusal(w.A.admin.as.mutation(api.classes.archive, { classId: w.a1 }))).toBe("class_in_use");
    expect(await refusal(w.A.admin.as.mutation(api.classes.create, { grade: "Class 10", section: "a" }))).toBe("class_exists");
    expect(await refusal(w.A.admin.as.mutation(api.classes.create, { grade: "Class 10", section: "A B" }))).toBe("bad_section");
    expect(await refusal(w.A.admin.as.mutation(api.classes.create, { grade: "Class 9", section: "A" }))).toBe("ok");
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.student.memberId });
    expect(await refusal(w.A.admin.as.mutation(api.classes.archive, { classId: w.a1 }))).toBe("ok");
    expect(await refusal(w.A.admin.as.mutation(api.classes.assignTeacher, { classId: w.a1, memberId: w.teacher.memberId }))).toBe("class_archived");
  });
});

describe("the daily clean up (AC-15)", () => {
  test("covers AC-15: a sign in account that is a house member survives the clean up, and an abandoned stranger does not", async () => {
    const t = makeBackend();
    const owner = await makeDhiAdmin(t);
    const { admin } = await makeInstitute(t, owner);
    const old = Date.now() - ABANDONED_AFTER_MS - 3 * 24 * 60 * 60 * 1000;
    // A teacher whose sign in account is older than 7 days, with no funnel profile, and a stranger of the same age.
    const teacher = await signInAs(t, { email: "teacher@greenfield.test", createdAt: old, sessionUpdatedAt: old });
    await admin.as.mutation(api.invites.create, { role: "teacher", email: "teacher@greenfield.test", name: "Teacher" });
    await teacher.as.mutation(api.members.claimInvite, {});
    const stranger = await signInAs(t, { email: "stranger@example.com", createdAt: old, sessionUpdatedAt: old });
    await t.mutation(internal.purge.purgeAbandoned, {});

    expect(await teacher.as.query(api.members.me, {})).toMatchObject({ state: "active", role: "teacher" });
    expect(await stranger.as.query(api.members.me, {})).toEqual({ state: "signedOut" });
    expect(await t.run(async (ctx) => (await ctx.db.query("members").collect()).length)).toBe(3);
  });
});

describe("the funnel is untouched (AC-14)", () => {
  test("covers AC-14: no funnel function reads or writes a house table, and no house function writes a funnel table", async () => {
    const all = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const houseTables = /["'](institutes|classes|members|teacherClasses|invites|accessLog)["']/;
    const funnelTables = /db\s*\.\s*(insert|patch|replace|delete)\(\s*["'](students|checks|answers|consents|consentTexts|results|resultFlags|leads|feedback)["']/;
    const funnelFiles = ["students", "checks", "results", "resultsCore", "leads", "feedback", "challenge", "challengeCore", "challengeBoard", "shares", "reportCopy", "avatars", "team"];
    const houseFiles = ["members", "invites", "classes", "institutes", "bootstrap", "demo", "inviteCore", "houseAuth"];
    for (const f of funnelFiles) expect({ f, touchesHouse: houseTables.test(all[`./${f}.ts`] ?? "") }).toEqual({ f, touchesHouse: false });
    for (const f of houseFiles) expect({ f, writesFunnel: funnelTables.test(all[`./${f}.ts`] ?? "") }).toEqual({ f, writesFunnel: false });
  });
});

type _Unused = Id<"members">;
