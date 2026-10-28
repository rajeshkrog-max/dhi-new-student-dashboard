/// <reference types="vite/client" />
// The topic and subject tags (house spec 0028; owner, 2026-10-28: teachers tag each paper question, students tap on the card). Each test names the
// criterion it covers. Time is fixed with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { tagsOfDay } from "./metricRules";
import { subjectCodeOf, topicKeyOf } from "./sessionRules";
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

const mcq = (subject: string, topic: string) => ({ kind: "mcq" as const, subject, topic, text: "Half of four?", options: ["one", "two", "three"], rightOption: 1, tags: [null, null, null] });

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1, a2]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s3 = await makeStudent(t, A.admin, a2, "s3@alpha.test", false);
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const betaTeacher = await makeTeacher(t, B.admin, "teacher@beta.test", [b1]);
  const sb = await makeStudent(t, B.admin, b1, "sb@beta.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, s3, sb]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, a1, a2, b1, teacher, betaTeacher, s, s3, sb };
}
type W = Awaited<ReturnType<typeof world>>;

const topicsOf = (w: W) => w.t.run((ctx) => ctx.db.query("paperTopics").collect());
async function sendTo(w: W, who: W["teacher"], classId: Id<"classes">, questions: ReturnType<typeof mcq>[]) {
  const paperId = await who.as.mutation(api.papers.create, { title: "Check", questions });
  await who.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId }, opensAt: NOW - HOUR, dueAt: NOW + HOUR });
  return paperId;
}
// A pending desk card for a student, as the minute job leaves it.
const pendingSitting = (w: W, who: W["s"]) =>
  w.t.run(async (ctx) => {
    const m = await ctx.db.get(who.memberId);
    return await ctx.db.insert("deskSittings", { memberId: who.memberId, instituteId: m!.instituteId!, startedAt: NOW - 30 * MIN, lastAt: NOW - 10 * MIN, feedbackStatus: "pending" });
  });

describe("the subject and the topic of a paper question", () => {
  test("covers AC-1: the subject is one of the fixed list, by its code or its usual name; anything else is refused", async () => {
    expect(subjectCodeOf("maths")).toBe("maths");
    expect(subjectCodeOf(" Mathematics ")).toBe("maths");
    expect(subjectCodeOf("Social  Studies")).toBe("social");
    expect(subjectCodeOf("Art")).toBeNull();
    const w = await world();
    expect(await refusal(w.teacher.as.mutation(api.papers.create, { title: "X", questions: [mcq("Art", "Colour")] }))).toBe("bad_question");
    const id = await w.teacher.as.mutation(api.papers.create, { title: "X", questions: [mcq("Maths", "Fractions")] });
    const qs = await w.t.run((ctx) => ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", id)).collect());
    expect(qs[0].subject).toBe("maths");
  });

  test("covers AC-2: the same words in any case or spacing are one topic of an institute; another subject or institute is another", async () => {
    const w = await world();
    expect(topicKeyOf("  Linear   Equations ")).toBe("linear equations");
    await w.teacher.as.mutation(api.papers.create, { title: "X", questions: [mcq("maths", "Linear equations"), mcq("maths", "linear  EQUATIONS"), mcq("science", "Linear equations")] });
    await w.betaTeacher.as.mutation(api.papers.create, { title: "Y", questions: [mcq("maths", "Linear equations")] });
    const topics = await topicsOf(w);
    expect(topics).toHaveLength(3);
    expect(topics.filter((t) => t.instituteId === w.A.instituteId).map((t) => [t.subject, t.name]).sort()).toEqual([
      ["maths", "Linear equations"],
      ["science", "Linear equations"],
    ]);
    const qs = await w.t.run((ctx) => ctx.db.query("paperQuestions").collect());
    expect(new Set(qs.filter((q) => q.subject === "maths").map((q) => q.topicId)).size).toBe(2); // one in each institute
  });
});

describe("the topics a card offers", () => {
  test("covers AC-3: only the topics sent to the student's own class, for the subject asked, newest first", async () => {
    const w = await world();
    await sendTo(w, w.teacher, w.a1, [mcq("maths", "Fractions")]);
    vi.setSystemTime(NOW + MIN);
    await sendTo(w, w.teacher, w.a1, [mcq("maths", "Decimals"), mcq("science", "Light")]);
    await sendTo(w, w.teacher, w.a2, [mcq("maths", "Angles")]);
    await sendTo(w, w.betaTeacher, w.b1, [mcq("maths", "Ratios")]);
    expect((await w.s.as.query(api.topics.forCard, { subject: "maths" })).map((t) => t.name)).toEqual(["Decimals", "Fractions"]);
    expect((await w.s.as.query(api.topics.forCard, { subject: "science" })).map((t) => t.name)).toEqual(["Light"]);
    expect((await w.s3.as.query(api.topics.forCard, { subject: "maths" })).map((t) => t.name)).toEqual(["Angles"]);
    expect((await w.sb.as.query(api.topics.forCard, { subject: "maths" })).map((t) => t.name)).toEqual(["Ratios"]);
    expect(await w.s.as.query(api.topics.forCard, { subject: "art" })).toEqual([]);
  });

  test("covers AC-3: a draft that was never sent offers nothing, and staff cannot read a card's topics", async () => {
    const w = await world();
    await w.teacher.as.mutation(api.papers.create, { title: "Draft", questions: [mcq("maths", "Fractions")] });
    expect(await w.s.as.query(api.topics.forCard, { subject: "maths" })).toEqual([]);
    expect(await refusal(w.teacher.as.query(api.topics.forCard, { subject: "maths" }))).toBe("forbidden");
    expect(await refusal(w.dhi.as.query(api.topics.forCard, { subject: "maths" }))).toBe("forbidden");
  });
});

describe("the student's taps", () => {
  test("covers AC-4: a desk card keeps a topic of the student's class with its subject, and the event names it by id only", async () => {
    const w = await world();
    await sendTo(w, w.teacher, w.a1, [mcq("maths", "Fractions")]);
    const [topic] = await w.s.as.query(api.topics.forCard, { subject: "maths" });
    const sittingId = await pendingSitting(w, w.s);
    expect(await w.s.as.mutation(api.deskSitting.answer, { sittingId, feel: "okay", focus: 4, subject: "maths", topicId: topic.topicId })).toEqual({ ok: true });
    const events = (await w.t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.type === "desk.felt");
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ subject: "maths", topic: topic.topicId });
    expect(JSON.stringify(events[0].payload)).not.toContain("Fractions");
    expect((await w.t.run((ctx) => ctx.db.get(sittingId)))?.topicId).toBe(topic.topicId);
  });

  test("covers AC-4: a topic without its subject, of another subject, or of another class or institute is refused as bad_topic", async () => {
    const w = await world();
    await sendTo(w, w.teacher, w.a1, [mcq("maths", "Fractions")]);
    await sendTo(w, w.teacher, w.a2, [mcq("maths", "Angles")]);
    await sendTo(w, w.betaTeacher, w.b1, [mcq("maths", "Ratios")]);
    const [mine] = await w.s.as.query(api.topics.forCard, { subject: "maths" });
    const [otherClass] = await w.s3.as.query(api.topics.forCard, { subject: "maths" });
    const [otherSchool] = await w.sb.as.query(api.topics.forCard, { subject: "maths" });
    const sittingId = await pendingSitting(w, w.s);
    const tap = (subject: string | undefined, topicId: Id<"paperTopics">) =>
      w.s.as.mutation(api.deskSitting.answer, { sittingId, feel: "okay", focus: 3, ...(subject ? { subject } : {}), topicId });
    expect(await tap(undefined, mine.topicId)).toEqual({ ok: false, code: "bad_topic" });
    expect(await tap("science", mine.topicId)).toEqual({ ok: false, code: "bad_topic" });
    expect(await tap("maths", otherClass.topicId)).toEqual({ ok: false, code: "bad_topic" });
    expect(await tap("maths", otherSchool.topicId)).toEqual({ ok: false, code: "bad_topic" });
    expect(await tap("maths", mine.topicId)).toEqual({ ok: true });
  });

  test("covers AC-5: the study hour card keeps a subject, and refuses one that is not on the list", async () => {
    const w = await world();
    await w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW - 10 * MIN, closesAt: NOW + 3 * HOUR });
    await w.s.as.mutation(api.studyHour.enter, { mode: "live" });
    for (let s = 30 * 1000; s < 25 * MIN; s += 30 * 1000) {
      vi.setSystemTime(NOW + s);
      await w.s.as.mutation(api.studyHour.beat, {});
    }
    vi.setSystemTime(NOW + 25 * MIN);
    await w.s.as.mutation(api.studyHour.leave, {});
    const card = await w.s.as.query(api.sessionFeedback.pending, {});
    expect(await w.s.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "drained", focus: 2, subject: "art" })).toEqual({ ok: false, code: "bad_subject" });
    expect(await w.s.as.mutation(api.sessionFeedback.answer, { seatId: card!.seatId, feel: "drained", focus: 2, subject: "science" })).toEqual({ ok: true });
    const events = (await w.t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.type === "hour.felt");
    expect(events[0].payload).toMatchObject({ feel: "drained", subject: "science" });
  });

  test("covers AC-6: a submitted paper names each topic with its answers tried and right", async () => {
    const w = await world();
    const paperId = await sendTo(w, w.teacher, w.a1, [mcq("maths", "Fractions"), mcq("maths", "Fractions"), mcq("science", "Light")]);
    const attempt = await w.t.run(
      async (ctx) => (await ctx.db.query("paperAttempts").withIndex("by_paperId_and_memberId", (q) => q.eq("paperId", paperId).eq("memberId", w.s.memberId)).first())!,
    );
    await w.s.as.mutation(api.exams.start, { attemptId: attempt._id });
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice: 1 });
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 1, choice: 0 });
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 2, choice: 1 });
    await w.s.as.mutation(api.exams.submit, { attemptId: attempt._id });
    const [done] = (await w.t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.type === "exams.submitted");
    const topics = await topicsOf(w);
    const idOf = (name: string) => topics.find((t) => t.name === name)!._id;
    expect(done.payload).toMatchObject({ mcqTried: 3, mcqRight: 2, topics: [idOf("Fractions"), idOf("Light")], topicTried: [2, 1], topicRight: [1, 1] });
  });
});

describe("the tagged values of a day (pure)", () => {
  test("covers AC-7: papers by topic, desk sittings by topic and sessions by subject, and nothing for untagged events", () => {
    const tags = tagsOfDay([
      { type: "exams.submitted", payload: { mcqTried: 5, mcqRight: 3, topics: ["t1", "t2"], topicTried: [3, 2], topicRight: [2, 1] }, occurredAt: NOW },
      { type: "exams.submitted", payload: { mcqTried: 2, mcqRight: 2, topics: ["t1"], topicTried: [2], topicRight: [2] }, occurredAt: NOW },
      { type: "exams.submitted", payload: { mcqTried: 2, mcqRight: 2 }, occurredAt: NOW },
      { type: "desk.felt", payload: { feel: "drained", focus: 2, subject: "maths", topic: "t1" }, occurredAt: NOW },
      { type: "desk.felt", payload: { feel: "okay", focus: 4 }, occurredAt: NOW },
      { type: "hour.felt", payload: { feel: "okay", focus: 4, subject: "maths" }, occurredAt: NOW },
      { type: "hour.felt", payload: { feel: "drained", focus: 1 }, occurredAt: NOW },
      { type: "mood.logged", payload: { mood: "happy" }, occurredAt: NOW },
    ]);
    expect(tags).toEqual({ "p:t1": { num: 4, den: 5 }, "p:t2": { num: 1, den: 2 }, "d:t1": { num: 1, den: 1 }, "s:maths": { num: 1, den: 2 } });
    expect(tagsOfDay([{ type: "mood.logged", payload: { mood: "happy" }, occurredAt: NOW }])).toEqual({});
  });
});
