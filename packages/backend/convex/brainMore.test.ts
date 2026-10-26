// The Brain's second set of measures (spec house/0019, version 3 of the formula): the pure rules that feed them (late night minutes, a post's range of words and
// structure, the words of a note) and the capture in the rooms (a comment written and received, the late minutes of a stay, the words of a note). Each test
// names the criterion it covers.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { hasParagraphs, movingTtr } from "./blogRules";
import { lateMinutes } from "./hourRules";
import { noteWords } from "./moodRules";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T12:00:00+05:30");
const MIN = 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the pure rules behind the new measures (AC-1)", () => {
  test("covers AC-1: late night minutes are the part of a stay after 23:00 on the house day, up to 04:00", () => {
    expect(lateMinutes(at("2026-10-20T22:30:00+05:30"), at("2026-10-20T23:30:00+05:30"))).toBe(30);
    expect(lateMinutes(at("2026-10-20T21:00:00+05:30"), at("2026-10-20T22:59:00+05:30"))).toBe(0);
    expect(lateMinutes(at("2026-10-20T23:10:00+05:30"), at("2026-10-21T00:10:00+05:30"))).toBe(60);
    expect(lateMinutes(at("2026-10-21T03:30:00+05:30"), at("2026-10-21T04:30:00+05:30"))).toBe(30);
    expect(lateMinutes(at("2026-10-21T04:00:00+05:30"), at("2026-10-21T05:00:00+05:30"))).toBe(0);
    expect(lateMinutes(NOW, NOW)).toBe(0);
  });

  test("covers AC-1: the range of words is the moving type-token ratio in thousandths, and a short post has none", () => {
    const alike = Array.from({ length: 60 }, () => "word").join(" ");
    const varied = Array.from({ length: 60 }, (_, i) => `w${i}`).join(" ");
    expect(movingTtr(alike)).toBe(20); // one word in every window of 50: 1/50
    expect(movingTtr(varied)).toBe(1000);
    expect(movingTtr("only a few words here")).toBeNull();
    expect(movingTtr(`<b>${varied}</b>`)).toBe(1000);
  });

  test("covers AC-1: a post has paragraphs when a blank line stands between two parts of its text", () => {
    expect(hasParagraphs("First part.\n\nSecond part.")).toBe(true);
    expect(hasParagraphs("First part.\nSecond part.")).toBe(false);
    expect(hasParagraphs("One block of text")).toBe(false);
    expect(hasParagraphs("\n\nstarts with blank")).toBe(false);
  });

  test("covers AC-1: a note's words are counted by spaces", () => {
    expect(noteWords("")).toBe(0);
    expect(noteWords("  one  two\nthree ")).toBe(3);
  });
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
  const events = (type: string) => t.run(async (ctx) => (await ctx.db.query("events").collect()).filter((e) => e.type === type));
  return { t, dhi, A, a1, teacher, s, s2, events };
}

describe("what the rooms write for the new measures (AC-1)", () => {
  test("covers AC-1: a mood event carries the number of words of the note and none of the words", async () => {
    const w = await world();
    await w.s.as.mutation(api.moods.save, { mood: "happy", note: "one two three four five six seven eight nine ten eleven" });
    const [event] = await w.events("mood.logged");
    expect(event.payload).toEqual({ mood: "happy", noteWords: 11 });
    expect(JSON.stringify(event)).not.toContain("seven");
  });

  test("covers AC-1: an approved comment is a log for the commenter and a reply, not a log, for the post's author, written once", async () => {
    const w = await world();
    const postId = await w.s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    const commentId = await w.s2.as.mutation(api.blog.comment, { postId, text: "Nice" });
    expect(await w.events("blog.commented")).toHaveLength(0);
    await w.teacher.as.mutation(api.blog.reviewComment, { commentId, action: "approve" });
    await w.teacher.as.mutation(api.blog.reviewComment, { commentId, action: "hide" });
    await w.teacher.as.mutation(api.blog.reviewComment, { commentId, action: "approve" });
    const [written] = await w.events("blog.commented");
    const [received] = await w.events("blog.replied");
    expect(await w.events("blog.commented")).toHaveLength(1);
    expect(await w.events("blog.replied")).toHaveLength(1);
    expect(written.memberId).toBe(w.s2.memberId);
    expect(received.memberId).toBe(w.s.memberId);
    expect(written.payload).toEqual({});
  });

  test("covers AC-1: a student who comments on their own post writes one event, not a reply to themselves", async () => {
    const w = await world();
    const postId = await w.s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    const commentId = await w.s.as.mutation(api.blog.comment, { postId, text: "Thanks all" });
    await w.teacher.as.mutation(api.blog.reviewComment, { commentId, action: "approve" });
    expect(await w.events("blog.commented")).toHaveLength(1);
    expect(await w.events("blog.replied")).toHaveLength(0);
  });

  test("covers AC-1: the new measures reach the stored day, and a reply received does not make a logged day", async () => {
    const w = await world();
    await w.s.as.mutation(api.moods.save, { mood: "heavy", note: "a b c d e f g h i j" });
    const postId = await w.s2.as.mutation(api.blog.write, { title: "T", tag: "study", body: "Hello" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    const commentId = await w.s.as.mutation(api.blog.comment, { postId, text: "Nice" });
    await w.teacher.as.mutation(api.blog.reviewComment, { commentId, action: "approve" });
    vi.setSystemTime(Date.now() + 11 * 1000);
    await w.t.mutation(internal.brainRollup.run, {});
    const rows = await w.t.run((ctx) => ctx.db.query("brainDays").collect());
    const mine = rows.find((r) => r.memberId === w.s.memberId)!;
    expect(mine.values).toMatchObject({ E06H: { num: 1, den: 1 }, E06L: { num: 0, den: 1 }, E08: { num: 1, den: 1 }, E16: { num: 1, den: 1 }, C02: { num: 2, den: 1 } });
    const theirs = rows.find((r) => r.memberId === w.s2.memberId)!;
    expect(theirs.values).toMatchObject({ E11: { num: 1, den: 1 }, E15S: { num: 1, den: 1 }, E16R: { num: 1, den: 1 } });
  });
});
