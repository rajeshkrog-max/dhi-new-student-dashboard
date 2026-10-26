/// <reference types="vite/client" />
// A day an open paper touched (owner, 2026-10-26): the exam lock closes the study hour, so the Brain writes no real zero for it that day (metric
// version 7). The same day without a paper is a real zero, as before.
import { describe, expect, test } from "vitest";
import { valuesFor } from "./brainDay";
import { dayBounds } from "./dayRules";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher } from "../tests/houseTestUtils";

const DAY = "2026-10-20";

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const { start } = dayBounds(DAY);
  await t.run(async (ctx) => {
    await ctx.db.patch(s.memberId, { joinedAt: start - 30 * 24 * 60 * 60 * 1000 });
    // The study hour was open that day and the student did not sit.
    await ctx.db.insert("studyHours", { opensAt: start + 10 * 60 * 60 * 1000, closesAt: start + 11 * 60 * 60 * 1000, setBy: dhi.memberId, createdAt: start });
  });
  return { t, teacher, s, start };
}

describe("the study hour on a day an open paper touched", () => {
  test("without a paper the unsat hour is a real zero; with a paper open that day there is no zero", async () => {
    const w = await world();
    const later = dayBounds(DAY).end + 60 * 60 * 1000;
    const before = await w.t.run(async (ctx) => valuesFor(ctx, (await ctx.db.get(w.s.memberId))!, DAY, later));
    expect(before.H12).toEqual({ num: 0, den: 1 });

    await w.t.run(async (ctx) => {
      const member = (await ctx.db.get(w.s.memberId))!;
      const paperId = await ctx.db.insert("papers", { teacherMemberId: w.teacher.memberId, instituteId: member.instituteId!, title: "Long window", status: "sent", createdAt: w.start });
      await ctx.db.insert("paperAttempts", {
        paperId,
        memberId: w.s.memberId,
        instituteId: member.instituteId!,
        status: "submitted",
        opensAt: w.start,
        dueAt: w.start + 3 * 24 * 60 * 60 * 1000,
        startedAt: w.start + 9 * 60 * 60 * 1000,
        submittedAt: w.start + 30 * 60 * 60 * 1000,
      });
    });
    const after = await w.t.run(async (ctx) => valuesFor(ctx, (await ctx.db.get(w.s.memberId))!, DAY, later));
    expect(after.H12).toBeUndefined();
    expect(after.X01).toBeUndefined();
  });
});
