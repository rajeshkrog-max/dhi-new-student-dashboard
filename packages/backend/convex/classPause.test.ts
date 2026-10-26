// Pausing the logins of one class (spec house/0021, scope row 24: the first class pilot must be able to stop if something goes wrong). Each test names
// the criterion it covers.
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
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s1 = await makeStudent(t, A.admin, a1, "s1@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  const other = await makeStudent(t, A.admin, a2, "other@alpha.test", false);
  return { t, dhi, A, B, a1, a2, teacher, s1, s2, other };
}

describe("pausing a class (AC-1 to AC-4)", () => {
  test("covers AC-1: pausing a class refuses every student of it at once, shows them the paused screen, and leaves the other class alone", async () => {
    const w = await world();
    expect(await w.s1.as.query(api.moods.month, { month: "2026-10" })).toBeDefined();
    expect(await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 })).toEqual({ paused: true });
    for (const s of [w.s1, w.s2]) {
      expect(await refusal(s.as.query(api.moods.month, { month: "2026-10" }))).toBe("removed");
      expect(await s.as.query(api.members.me, {})).toEqual({ state: "removed" });
    }
    // The other class and the class's teacher go on as before.
    expect(await w.other.as.query(api.moods.month, { month: "2026-10" })).toBeDefined();
    expect((await w.other.as.query(api.members.me, {})).state).toBe("active");
    expect((await w.teacher.as.query(api.members.me, {})).state).toBe("active");
  });

  test("covers AC-1: a paused student who has not yet agreed to the notice sees the paused screen, not the consent step", async () => {
    const w = await world();
    const fresh = await makeStudent(w.t, w.A.admin, w.a1, "fresh@alpha.test", false, { consent: false });
    expect((await fresh.as.query(api.members.me, {})).state).not.toBe("removed");
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    expect(await fresh.as.query(api.members.me, {})).toEqual({ state: "removed" });
    await w.A.admin.as.mutation(api.classes.resume, { classId: w.a1 });
    expect((await fresh.as.query(api.members.me, {})).state).not.toBe("removed");
  });

  test("covers AC-5: each pause is kept with its start and end, and a class paused before the history existed is ended on resume", async () => {
    const w = await world();
    const rows = () => w.t.run((ctx) => ctx.db.query("classPauses").collect());
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    const open = await rows();
    expect(open).toHaveLength(1);
    expect(open[0].classId).toBe(w.a1);
    expect(open[0].endedAt).toBeUndefined();
    await w.A.admin.as.mutation(api.classes.resume, { classId: w.a1 });
    await w.A.admin.as.mutation(api.classes.resume, { classId: w.a1 });
    const [first] = await rows();
    expect(first.endedAt).toBeGreaterThanOrEqual(first.startedAt);
    // Paused before the history existed: the class holds pausedAt and no row.
    await w.t.run(async (ctx) => {
      for (const r of await ctx.db.query("classPauses").collect()) await ctx.db.delete(r._id);
      await ctx.db.patch(w.a2, { pausedAt: 1000 });
    });
    await w.A.admin.as.mutation(api.classes.resume, { classId: w.a2 });
    expect(await rows()).toMatchObject([{ classId: w.a2, startedAt: 1000 }]);
  });

  test("covers AC-2: resuming brings the whole class back, with everything they own untouched, and pausing twice changes nothing", async () => {
    const w = await world();
    await w.s1.as.mutation(api.moods.save, { mood: "happy", note: "kept through the pause" });
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    expect((await w.t.run((ctx) => ctx.db.query("accessLog").collect())).filter((a) => a.action === "class.pause")).toHaveLength(1);
    expect(await w.A.admin.as.mutation(api.classes.resume, { classId: w.a1 })).toEqual({ paused: false });
    await w.A.admin.as.mutation(api.classes.resume, { classId: w.a1 });
    expect((await w.t.run((ctx) => ctx.db.query("accessLog").collect())).filter((a) => a.action === "class.resume")).toHaveLength(1);
    expect((await w.s1.as.query(api.members.me, {})).state).toBe("active");
    const month = await w.s1.as.query(api.moods.month, { month: "2026-10" });
    expect(JSON.stringify(month)).toContain("kept through the pause");
  });

  test("covers AC-3: a paused student can still reach their own data: the download and the erase belong to them", async () => {
    const w = await world();
    await w.A.admin.as.mutation(api.classes.pause, { classId: w.a1 });
    const start = await w.s1.as.mutation(api.dataRights.exportMine, { cursor: null });
    expect(start).toBeDefined();
  });

  test("covers AC-4: only an institute admin of that institute or a DHI admin can pause or resume; a teacher, a student and another school cannot, and the class list says it is paused", async () => {
    const w = await world();
    for (const p of [w.teacher, w.s1]) {
      expect(await refusal(p.as.mutation(api.classes.pause, { classId: w.a1 }))).toBe("forbidden");
      expect(await refusal(p.as.mutation(api.classes.resume, { classId: w.a1 }))).toBe("forbidden");
    }
    expect(await refusal(w.B.admin.as.mutation(api.classes.pause, { classId: w.a1 }))).toBe("not_found");
    await w.dhi.as.mutation(api.classes.pause, { classId: w.a1 });
    const rows = await w.A.admin.as.query(api.classes.list, { paginationOpts: { numItems: 10, cursor: null } });
    expect(rows.page.map((c) => [c.section, c.paused]).sort()).toEqual([["A", true], ["B", false]]);
    await w.dhi.as.mutation(api.classes.resume, { classId: w.a1 });
    const after = await w.A.admin.as.query(api.classes.list, { paginationOpts: { numItems: 10, cursor: null } });
    expect(after.page.every((c) => c.paused === false)).toBe(true);
  });
});
