/// <reference types="vite/client" />
// Moving a teacher or an institute admin to another institute (house spec 0002 follow up). Staff only, DHI admin only; a student is never moved.
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const student = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  return { t, dhi, A, B, a1, b1, teacher, student };
}

describe("moving staff between institutes", () => {
  test("a DHI admin moves a teacher: the institute changes and the old class links end", async () => {
    const w = await world();
    expect(await w.dhi.as.mutation(api.members.moveStaff, { memberId: w.teacher.memberId, instituteId: w.B.instituteId })).toEqual({ ok: true });
    const after = await w.t.run(async (ctx) => ({
      member: await ctx.db.get(w.teacher.memberId),
      links: await ctx.db.query("teacherClasses").withIndex("by_memberId", (q) => q.eq("memberId", w.teacher.memberId)).take(10),
    }));
    expect(after.member?.instituteId).toBe(w.B.instituteId);
    expect(after.links).toEqual([]);
  });

  test("the moved teacher can no longer read the old class and the old institute's admin no longer finds them", async () => {
    const w = await world();
    await w.dhi.as.mutation(api.members.moveStaff, { memberId: w.teacher.memberId, instituteId: w.B.instituteId });
    expect(await refusal(w.teacher.as.query(api.members.list, { paginationOpts: { numItems: 25, cursor: null }, classId: w.a1 }))).toBeTruthy();
    expect(await refusal(w.A.admin.as.mutation(api.members.remove, { memberId: w.teacher.memberId }))).toBe("not_found");
  });

  test("the move is written to the access log for both institutes, with ids only", async () => {
    const w = await world();
    await w.dhi.as.mutation(api.members.moveStaff, { memberId: w.teacher.memberId, instituteId: w.B.instituteId });
    const rows = await w.t.run((ctx) => ctx.db.query("accessLog").take(200));
    const moves = rows.filter((r) => r.action === "member.move");
    expect(moves.map((r) => r.instituteId).sort()).toEqual([w.A.instituteId, w.B.instituteId].sort());
    expect(JSON.stringify(moves)).not.toContain("alpha.test");
  });

  test("a student is never moved", async () => {
    const w = await world();
    expect(await refusal(w.dhi.as.mutation(api.members.moveStaff, { memberId: w.student.memberId, instituteId: w.B.instituteId }))).toBe("not_staff");
  });

  test("the same institute, a missing institute and a suspended institute are refused", async () => {
    const w = await world();
    expect(await refusal(w.dhi.as.mutation(api.members.moveStaff, { memberId: w.teacher.memberId, instituteId: w.A.instituteId }))).toBe("same_institute");
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.B.instituteId, status: "suspended" });
    expect(await refusal(w.dhi.as.mutation(api.members.moveStaff, { memberId: w.teacher.memberId, instituteId: w.B.instituteId }))).toBe("institute_not_found");
  });

  test("the last active admin of an institute cannot be moved out, but a second admin can", async () => {
    const w = await world();
    const admin = (await w.t.run((ctx) => ctx.db.query("members").withIndex("by_instituteId_and_role", (q) => q.eq("instituteId", w.A.instituteId).eq("role", "institute_admin")).first()))!;
    expect(await refusal(w.dhi.as.mutation(api.members.moveStaff, { memberId: admin._id, instituteId: w.B.instituteId }))).toBe("last_admin");
  });

  test("an institute admin and a teacher cannot move anyone", async () => {
    const w = await world();
    expect(await refusal(w.A.admin.as.mutation(api.members.moveStaff, { memberId: w.teacher.memberId, instituteId: w.B.instituteId }))).toBe("forbidden");
    expect(await refusal(w.teacher.as.mutation(api.members.moveStaff, { memberId: w.teacher.memberId, instituteId: w.B.instituteId }))).toBe("forbidden");
  });
});
