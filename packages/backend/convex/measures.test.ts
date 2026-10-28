// The new inputs and the Progress page's measures block (house spec 0030): a film's two checks (A16, A17), a comment marked helpful (A19), a counseling
// booking (E17), and the report's `measures`, the student's own and nobody else's. Time is fixed with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, type Person } from "../tests/houseTestUtils";
import { METRIC_VERSION } from "./metricRules";
import { shiftDay, todayOf } from "./dayRules";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T12:00:00+05:30");

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
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, s2]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, a1, teacher, s, s2 };
}
type World = Awaited<ReturnType<typeof world>>;
const eventsOf = (w: World, p: Person) => w.t.run((ctx) => ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", p.memberId)).collect());

const check = { question: "What is the leaf's kitchen?", options: ["Root", "Chloroplast", "Stem"], rightOption: 1 };
const academic = { title: "The leaf kitchen", category: "academic", blurb: "Stay until the end.", cover: "/mood/thought.jpg", hostRef: "/landing/night.mp4", durationSec: 20, scoreValue: 10, checks: [check, check] };

describe("a film's two checks (A16, A17)", () => {
  test("shown only after the film is kept, answered once, right options only after the answer, and the topic named by id in the student's institute", async () => {
    const w = await world();
    await w.teacher.as.mutation(api.topics.addToMap, { subject: "Science", name: "Photosynthesis", chapter: "Life processes" });
    expect(await w.dhi.as.mutation(api.films.upload, { ...academic, subject: "Science", topic: "photosynthesis " }).catch(() => "refused")).not.toBe("refused");
    const filmId = (await w.t.run((ctx) => ctx.db.query("films").first()))!._id;
    await w.dhi.as.mutation(api.films.approve, { filmId });
    expect((await w.s.as.query(api.films.list, {})).films[0].checks).toBeNull();
    expect(await w.s.as.mutation(api.films.answerChecks, { filmId, answers: [1, 0] })).toEqual({ ok: false, code: "not_finished" });
    let sec = 0;
    for (let i = 0; i < 4; i += 1) {
      sec = Math.min(20, sec + 5);
      vi.setSystemTime(NOW + i * 5000);
      await w.s.as.mutation(api.films.progress, { filmId, seconds: sec });
    }
    vi.setSystemTime(NOW + 20 * 1000);
    expect(await w.s.as.mutation(api.films.finish, { filmId, seconds: 20 })).toMatchObject({ ok: true });
    const listed = (await w.s.as.query(api.films.list, {})).films[0];
    expect(listed.checks).toEqual([{ question: check.question, options: check.options }, { question: check.question, options: check.options }]);
    expect(JSON.stringify(listed)).not.toContain("rightOption");
    expect(await w.s.as.mutation(api.films.answerChecks, { filmId, answers: [1] })).toEqual({ ok: false, code: "bad_answers" });
    expect(await w.s.as.mutation(api.films.answerChecks, { filmId, answers: [1, 0] })).toEqual({ ok: true, right: 1, rightOptions: [1, 1] });
    expect(await w.s.as.mutation(api.films.answerChecks, { filmId, answers: [1, 1] })).toEqual({ ok: false, code: "already_answered" });
    expect((await w.s.as.query(api.films.list, {})).films[0]).toMatchObject({ checks: null, checkRight: 1 });
    const topic = await w.t.run((ctx) => ctx.db.query("paperTopics").first());
    expect((await eventsOf(w, w.s)).filter((e) => e.type === "modules.checked").map((e) => e.payload)).toEqual([{ right: 1, asked: 2, topic: topic!._id }]);
  });

  test("a subject on a film that is not academic is refused", async () => {
    const w = await world();
    const err = await w.dhi.as.mutation(api.films.upload, { ...academic, category: "self_help", checks: [], subject: "Science" }).then(() => null, (e: Error) => e.message);
    expect(err).toContain("bad_subject");
  });
});

describe("a comment marked helpful (A19)", () => {
  test("only the post's author marks a classmate's approved comment, once, and the commenter's log counts it", async () => {
    const w = await world();
    const postId = await w.s.as.mutation(api.blog.write, { title: "My week", tag: "reflection", body: "A good week" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    const commentId = await w.s2.as.mutation(api.blog.comment, { postId, text: "Try writing it as a list." });
    expect(await w.s.as.mutation(api.blog.markHelpful, { commentId })).toEqual({ ok: false, code: "not_found" });
    await w.teacher.as.mutation(api.blog.reviewComment, { commentId, action: "approve" });
    expect(await w.s2.as.mutation(api.blog.markHelpful, { commentId })).toEqual({ ok: false, code: "not_found" });
    expect(await w.s.as.mutation(api.blog.markHelpful, { commentId })).toEqual({ ok: true });
    expect(await w.s.as.mutation(api.blog.markHelpful, { commentId })).toEqual({ ok: true });
    expect((await eventsOf(w, w.s2)).filter((e) => e.type === "blog.helped")).toHaveLength(1);
    expect((await w.s.as.query(api.blog.list, {}))[0].comments[0].helpful).toBe(true);
  });
});

describe("asked for help (E17)", () => {
  test("a counseling booking writes counsel.asked with nothing in it", async () => {
    const w = await world();
    await w.dhi.as.mutation(api.invites.create, { role: "counselor", email: "meera@dhi.test", name: "Meera Rao" });
    const counselor = await joinAs(w.t, "meera@dhi.test", { name: "Meera Rao" });
    const startsAt = at("2026-10-21T10:00:00+05:30");
    const slot = await counselor.as.mutation(api.counsel.openSlot, { startsAt });
    if (!slot.ok) throw new Error(slot.code);
    const r = await w.s.as.mutation(api.counsel.book, { slotId: slot.slotId, note: "exams" });
    expect(r.ok).toBe(true);
    const asked = (await eventsOf(w, w.s)).filter((e) => e.type === "counsel.asked");
    expect(asked.map((e) => [e.room, e.payload])).toEqual([["counsel", {}]]);
  });
});

describe("the measures on the Progress page", () => {
  test("worked out from the student's own days only: the stress word, the streak, desk time by subject and the practice shares", async () => {
    const w = await world();
    const today = todayOf(Date.now());
    const day = (n: number) => shiftDay(today, -n);
    await w.t.run(async (ctx) => {
      const member = (await ctx.db.get(w.s.memberId))!;
      const rows: { day: string; values: Record<string, { num: number; den: number }>; tags?: Record<string, { num: number; den: number }> }[] = [
        { day: day(3), values: { E01: { num: 1, den: 1 }, E04: { num: 1, den: 1 }, E07P: { num: 1, den: 1 }, E07T: { num: 0, den: 1 }, E07O: { num: 0, den: 1 }, A04: { num: 1, den: 2 } } },
        { day: day(2), values: { E01: { num: 1, den: 1 }, E04: { num: 0, den: 1 }, X02: { num: 40, den: 1 }, A13: { num: 2, den: 3 } }, tags: { "m:maths": { num: 20, den: 1 } } },
        { day: day(1), values: { E01: { num: 1, den: 1 }, E04: { num: 0, den: 1 }, H10: { num: 20, den: 4 }, A09: { num: 1, den: 1 } } },
      ];
      for (const r of rows) await ctx.db.insert("brainDays", { memberId: member._id, instituteId: member.instituteId!, ...r, version: METRIC_VERSION, computedAt: Date.now() });
    });
    const m = (await w.s.as.query(api.brain.report, {})).measures;
    expect(m.stress).toBe("moderate");
    expect(m.stressDays).toBe(3);
    expect(m.stressWhen).toEqual({ paper: 1, hours: 0, other: 0 });
    expect(m.streak).toEqual({ current: 3, longest: 3 });
    expect(m.deskBySubject).toEqual([{ subject: "maths", share: 0.5 }]);
    expect(m.habitFeel).toBe(5);
    expect(m.recall7).toEqual({ num: 1, den: 2 });
    expect(m.recallRounds).toEqual({ num: 2, den: 3 });
    expect(m.held).toBe(1);
    // A classmate's report holds none of it.
    const other = (await w.s2.as.query(api.brain.report, {})).measures;
    expect(other).toMatchObject({ stress: null, stressDays: 0, held: 0, deskBySubject: [], streak: { current: 0, longest: 0 } });
    void (null as unknown as Id<"members">);
  });
});
