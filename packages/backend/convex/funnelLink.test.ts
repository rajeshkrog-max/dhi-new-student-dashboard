/// <reference types="vite/client" />
// Linking the DhiRise funnel check to the house account (house spec 0002 follow up). Link and download only: the house never deletes a funnel row, and a
// result or a flag never reaches the download.
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

beforeEach(() => {
  process.env.ERASURE_HASH_SECRET = "test-erasure-secret";
});
afterEach(() => {
  delete process.env.ERASURE_HASH_SECRET;
});

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  return { t, s, s2, teacher, admin: A.admin };
}
type World = Awaited<ReturnType<typeof world>>;

// Gives a student the funnel's profile and a finished check with two answers and a result that holds flags.
async function takeCheck(w: World, who: World["s"]) {
  await w.t.run(async (ctx) => {
    const member = (await ctx.db.get(who.memberId))!;
    const studentId = await ctx.db.insert("students", { authUserId: member.authUserId, email: member.email, name: "Asha Rao", age: 15, class: "Class 10" });
    const checkId = await ctx.db.insert("checks", { studentId, seed: "seed", source: "fresh", completedAt: 1700000000000 });
    await ctx.db.insert("answers", { checkId, q: 1, optionId: "a", answeredAt: 1700000000001 });
    await ctx.db.insert("answers", { checkId, q: 2, optionId: "c", answeredAt: 1700000000002 });
  });
}
const headerOf = async (who: World["s"]) => {
  const r = (await who.as.mutation(api.dataRights.exportMine, {})) as { ok: true; rows: { funnel: unknown }[] };
  return r.rows[0];
};

describe("the funnel link", () => {
  test("without a funnel profile there is nothing to link", async () => {
    const w = await world();
    expect(await w.s.as.query(api.funnelLink.status, {})).toEqual({ hasProfile: false, linkedAt: null });
    expect(await w.s.as.mutation(api.funnelLink.link, {})).toEqual({ ok: false, code: "no_profile" });
  });

  test("a student with a profile links with their own tap, and linking twice changes nothing", async () => {
    const w = await world();
    await takeCheck(w, w.s);
    expect(await w.s.as.query(api.funnelLink.status, {})).toEqual({ hasProfile: true, linkedAt: null });
    const first = await w.s.as.mutation(api.funnelLink.link, {});
    expect(first).toMatchObject({ ok: true });
    const second = await w.s.as.mutation(api.funnelLink.link, {});
    expect(second).toEqual(first);
    expect((await w.s.as.query(api.funnelLink.status, {})).linkedAt).not.toBeNull();
    expect(await w.t.run((ctx) => ctx.db.query("funnelLinks").take(10))).toHaveLength(1);
  });

  test("the download holds the answers of a linked student and nothing else from the funnel", async () => {
    const w = await world();
    await takeCheck(w, w.s);
    expect((await headerOf(w.s)).funnel).toBeNull();
    await w.s.as.mutation(api.funnelLink.link, {});
    const funnel = (await headerOf(w.s)).funnel as { profile: Record<string, unknown>; checks: { answers: unknown[] }[] };
    expect(funnel.profile).toEqual({ name: "Asha Rao", age: 15, class: "Class 10" });
    expect(funnel.checks).toHaveLength(1);
    expect(funnel.checks[0].answers).toEqual([
      { q: 1, optionId: "a", answeredAt: 1700000000001 },
      { q: 2, optionId: "c", answeredAt: 1700000000002 },
    ]);
    const text = JSON.stringify(funnel);
    for (const word of ["lowMood", "selfDoubt", "flags", "result", "score", "email"]) expect(text).not.toContain(word);
  });

  test("a student's link and answers are their own: another student's download holds nothing of theirs", async () => {
    const w = await world();
    await takeCheck(w, w.s);
    await w.s.as.mutation(api.funnelLink.link, {});
    expect((await headerOf(w.s2)).funnel).toBeNull();
    expect(await w.s2.as.mutation(api.funnelLink.link, {})).toEqual({ ok: false, code: "no_profile" });
  });

  test("unlinking removes the link and the funnel is untouched", async () => {
    const w = await world();
    await takeCheck(w, w.s);
    await w.s.as.mutation(api.funnelLink.link, {});
    expect(await w.s.as.mutation(api.funnelLink.unlink, {})).toEqual({ ok: true });
    expect((await headerOf(w.s)).funnel).toBeNull();
    const kept = await w.t.run(async (ctx) => ({ students: (await ctx.db.query("students").take(10)).length, checks: (await ctx.db.query("checks").take(10)).length }));
    expect(kept).toEqual({ students: 1, checks: 1 });
  });

  test("erasing in the house deletes the link and leaves the funnel's profile, check and answers", async () => {
    const w = await world();
    await takeCheck(w, w.s);
    await w.s.as.mutation(api.funnelLink.link, {});
    expect(await w.s.as.mutation(api.dataRights.eraseMine, { confirm: true })).toMatchObject({ ok: true });
    const after = await w.t.run(async (ctx) => ({
      links: (await ctx.db.query("funnelLinks").take(10)).length,
      students: (await ctx.db.query("students").take(10)).length,
      checks: (await ctx.db.query("checks").take(10)).length,
      answers: (await ctx.db.query("answers").take(10)).length,
    }));
    expect(after).toEqual({ links: 0, students: 1, checks: 1, answers: 2 });
  });

  test("only a student may link", async () => {
    const w = await world();
    expect(await refusal(w.teacher.as.mutation(api.funnelLink.link, {}))).toBe("forbidden");
    expect(await refusal(w.teacher.as.query(api.funnelLink.status, {}))).toBe("forbidden");
  });

  // Your data shows the card only while consent is in place, because these functions sit behind the consent gate; a link made before stays in the
  // download, which a locked student still reaches.
  test("a withdrawn or paused student cannot read or make the link, and an earlier link stays in their download", async () => {
    const w = await world();
    await takeCheck(w, w.s);
    await w.s.as.mutation(api.funnelLink.link, {});
    await w.s.as.mutation(api.consent.withdraw, {});
    expect(await refusal(w.s.as.query(api.funnelLink.status, {}))).toBe("consent_withdrawn");
    expect(await refusal(w.s.as.mutation(api.funnelLink.link, {}))).toBe("consent_withdrawn");
    expect(await refusal(w.s.as.mutation(api.funnelLink.unlink, {}))).toBe("consent_withdrawn");
    expect((await headerOf(w.s)).funnel).not.toBeNull();

    await takeCheck(w, w.s2);
    await w.admin.as.mutation(api.members.remove, { memberId: w.s2.memberId });
    expect(await refusal(w.s2.as.mutation(api.funnelLink.link, {}))).not.toBeNull();
    expect(await w.t.run((ctx) => ctx.db.query("funnelLinks").take(10))).toHaveLength(1);
  });
});
