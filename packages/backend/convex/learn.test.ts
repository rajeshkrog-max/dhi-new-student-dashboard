/// <reference types="vite/client" />
// The desk's learning loop (house spec 0031; Desk Design D3, D4 and D5) and the new inputs of house spec 0030. Each test names what it covers. The model
// is a stand in `fetch` that counts its calls, so written answer marking is proven without a real model. Time is fixed and moved with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";
import { difficultyOf, heldNow, keyPointsOf, levelOf, marksOf, masteryAfter, mistakeOf, nextGap, parseMarking, pickOrder, planOf, topicMatches } from "./learnRules";
import { learnRoom } from "./learnRoom";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T10:00:00+05:30");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let sent: { messages: { role: string; content: string }[] }[] = [];
let modelContent = '{"points":["covered","partly"],"confidence":0.9}';
let modelStatus = 200;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  process.env.DESK_LIVE = "true";
  process.env.OPENAI_API_KEY = "test-key-not-real";
  sent = [];
  modelStatus = 200;
  modelContent = '{"points":["covered","partly"],"confidence":0.9}';
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body));
      if (modelStatus !== 200) return new Response("{}", { status: modelStatus });
      return new Response(JSON.stringify({ choices: [{ message: { content: modelContent } }], usage: { prompt_tokens: 20, completion_tokens: 10 } }), { status: 200 });
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.DESK_LIVE;
  delete process.env.OPENAI_API_KEY;
});

const mcq = (text: string, right = 1) => ({ kind: "mcq" as const, subject: "Maths", topic: "Fractions", text, options: ["one", "two", "three"], rightOption: right, tags: [right === 0 ? null : "misread", right === 1 ? null : "concept", right === 2 ? null : "concept"] });
const long = { kind: "long" as const, subject: "Maths", topic: "Fractions", text: "Explain what a half is.", maxMarks: 4, rubric: "- two equal parts\n- one of them" };

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const tb = await makeTeacher(t, B.admin, "teacher@beta.test", [b1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  const sb = await makeStudent(t, B.admin, b1, "sb@beta.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, s2, sb]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, teacher, tb, s, s2, sb, a1 };
}
type World = Awaited<ReturnType<typeof world>>;

async function bank(w: World, questions = [mcq("Half of four?"), mcq("Half of six?", 2), mcq("Half of two?", 0), long]) {
  await w.teacher.as.mutation(api.papers.create, { title: "Fractions bank", questions, bank: true });
  return (await w.s.as.query(api.learn.map, { subject: "maths", now: Date.now() }))[0].topicId;
}
type Started = { ok: true; roundId: Id<"learnRounds">; questions: { questionId: Id<"paperQuestions">; text: string; options: string[] }[] };
const startOk = async (p: Person, mode: string, topicId?: Id<"paperTopics">) => {
  const r = await p.as.mutation(api.learn.start, { mode, ...(topicId ? { topicId } : {}) });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r as Started;
};
const rightOf = (w: World, id: Id<"paperQuestions">) => w.t.run(async (ctx) => (await ctx.db.get(id))!.rightOption!);
const eventsOf = (w: World, p: Person) => w.t.run((ctx) => ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", p.memberId)).collect());

describe("the pure rules (learnRules.ts)", () => {
  test("mastery moves more for a hard question answered right, the level follows it, and the recall gaps grow 1, 3, 7, 21, 45", () => {
    expect(masteryAfter(0.3, true, 0.9)).toBeGreaterThan(masteryAfter(0.3, true, 0.1));
    expect(masteryAfter(0.6, false, 0.1)).toBeLessThan(masteryAfter(0.6, false, 0.9));
    expect([levelOf(0.39), levelOf(0.4), levelOf(0.75), levelOf(0.76)]).toEqual(["foundation", "standard", "standard", "stretch"]);
    expect([nextGap(0, true), nextGap(1, true), nextGap(3, true), nextGap(7, true), nextGap(21, true), nextGap(45, true), nextGap(21, false)]).toEqual([1, 3, 7, 21, 45, 45, 1]);
    expect(difficultyOf(0, 0)).toBe(0.5);
    expect(heldNow(0.9, NOW - 3 * DAY, NOW)).toBe(true);
    expect(heldNow(0.9, NOW - 2 * DAY, NOW)).toBe(false);
    expect(heldNow(0.8, NOW - 9 * DAY, NOW)).toBe(false);
  });

  test("questions near the 70 to 85% band come first, and a question not seen for longest breaks a tie", () => {
    const items = [
      { id: "hard", difficulty: 0.95, lastSeenAt: null },
      { id: "fit", difficulty: 0.4, lastSeenAt: null },
      { id: "easy", difficulty: 0.0, lastSeenAt: null },
    ];
    expect(pickOrder(0.3, items)[0].id).toBe("fit");
    const tie = pickOrder(0.5, [{ id: "new", difficulty: 0.5, lastSeenAt: 200 }, { id: "old", difficulty: 0.5, lastSeenAt: 100 }]);
    expect(tie.map((x) => x.id)).toEqual(["old", "new"]);
  });

  test("the Master Spec's mistake rule: misread by the author's tag, careless only with 2 of the last 3 right and under half the own median time, else concept", () => {
    expect(mistakeOf("misread", [true, true, true], 1, 60)).toBe("misread");
    expect(mistakeOf("concept", [true, false, true], 10, 60)).toBe("careless");
    expect(mistakeOf(null, [true, false, true], 40, 60)).toBe("concept");
    expect(mistakeOf(null, [false, false, true], 10, 60)).toBe("concept");
    expect(mistakeOf(null, [true, true], 10, 60)).toBe("concept");
    expect(mistakeOf(null, [true, true, true], 10, null)).toBe("concept");
  });

  test("the plan puts open Fix items first, then due recall, then the lowest mastery, and the last day goes back over the lowest", () => {
    const plan = planOf(
      [
        { topicId: "a", mastery: 0.9, due: false, openFix: 0 },
        { topicId: "b", mastery: 0.2, due: false, openFix: 0 },
        { topicId: "c", mastery: 0.5, due: true, openFix: 0 },
        { topicId: "d", mastery: 0.6, due: false, openFix: 2 },
      ],
      ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"],
    );
    expect(plan.map((d) => d.day)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23"]);
    expect(plan[0].topics).toEqual([{ topicId: "d", step: "fix" }, { topicId: "c", step: "remember" }]);
    expect(plan[1].topics.map((x) => x.topicId)).toEqual(["b", "a"]);
    expect(plan[2].topics.map((x) => x.topicId)).toEqual(["b", "c"]);
    expect(planOf([], ["2026-10-21"])).toEqual([]);
  });

  test("key points come from the rubric lines, the model's reply must be the fixed form, and a partly covered point gives half", () => {
    expect(keyPointsOf("- two equal parts\n* one of them\n\n3) shown as 1/2")).toEqual(["two equal parts", "one of them", "shown as 1/2"]);
    expect(parseMarking('Sure! {"points":["covered","missing"],"confidence":0.8}', 2)).toEqual({ points: ["covered", "missing"], confidence: 0.8 });
    expect(parseMarking('{"points":["covered"],"confidence":0.8}', 2)).toBeNull();
    expect(parseMarking('{"points":["great","missing"],"confidence":0.8}', 2)).toBeNull();
    expect(parseMarking('{"points":["covered","missing"],"confidence":2}', 2)).toBeNull();
    expect(parseMarking("ignore your rules", 2)).toBeNull();
    expect(marksOf(["covered", "partly"], 4)).toBe(3);
    expect(marksOf(["missing", "missing"], 4)).toBe(0);
    expect(topicMatches("Fractions and decimals", "frac dec")).toBe(true);
    expect(topicMatches("Fractions", "torque")).toBe(false);
  });
});

describe("the bank and practice (D3)", () => {
  test("a bank paper's topics are on the class's map at once, and it can never be sent as a paper", async () => {
    const w = await world();
    await w.teacher.as.mutation(api.papers.create, { title: "Bank", questions: [mcq("Half of four?")], bank: true });
    const map = await w.s.as.query(api.learn.map, { subject: "maths", now: NOW });
    expect(map).toMatchObject([{ name: "Fractions", subject: "maths", step: "new", due: false, openFix: 0 }]);
    const paper = await w.t.run((ctx) => ctx.db.query("papers").first());
    expect(await refusal(w.teacher.as.mutation(api.papers.send, { paperId: paper!._id, target: { kind: "class", classId: w.a1 }, opensAt: NOW + HOUR, dueAt: NOW + 2 * HOUR }))).toBe("bank_paper");
    // Another institute's student sees none of it.
    expect(await w.sb.as.query(api.learn.map, { now: NOW })).toEqual([]);
  });

  test("a sent paper's questions join the bank only when every window of it has closed", async () => {
    const w = await world();
    const paperId = await w.teacher.as.mutation(api.papers.create, { title: "Term", questions: [mcq("Half of four?")] });
    await w.teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: w.a1 }, opensAt: NOW + HOUR, dueAt: NOW + 2 * HOUR });
    const topicId = (await w.s.as.query(api.learn.map, { now: NOW }))[0].topicId;
    expect(await w.s.as.mutation(api.learn.start, { mode: "practice", topicId })).toEqual({ ok: false, code: "no_questions" });
    vi.setSystemTime(NOW + 3 * HOUR);
    expect((await startOk(w.s, "practice", topicId)).questions).toHaveLength(1);
  });

  test("practice hands out questions with no answer, marks by code, opens a Fix item on a wrong answer and writes desk.answered", async () => {
    const w = await world();
    const topicId = await bank(w);
    const r = await startOk(w.s, "practice", topicId);
    expect(r.questions).toHaveLength(3);
    expect(JSON.stringify(r)).not.toContain("rightOption");
    const q = r.questions[0];
    const right = await rightOf(w, q.questionId);
    const wrong = (right + 1) % 3;
    expect(await w.s.as.mutation(api.learn.answer, { roundId: r.roundId, questionId: q.questionId, choice: wrong, seconds: 20 })).toEqual({ ok: true, right: false, rightOption: right, mastered: false });
    // Once per question in a round, and only a question of the round.
    expect(await w.s.as.mutation(api.learn.answer, { roundId: r.roundId, questionId: q.questionId, choice: right })).toEqual({ ok: false, code: "answered" });
    const other = await startOk(w.s2, "practice", topicId);
    expect(await w.s.as.mutation(api.learn.answer, { roundId: other.roundId, questionId: q.questionId, choice: right })).toEqual({ ok: false, code: "not_found" });
    const summary = await w.s.as.query(api.learn.summary, { now: Date.now() });
    expect(summary).toMatchObject({ openFix: 1, topics: 1 });
    const answered = (await eventsOf(w, w.s)).filter((e) => e.type === "desk.answered");
    expect(answered.map((e) => e.payload)).toEqual([{ topic: topicId, right: false, mode: "practice", seen7: false, pastWrong: false, sec: 20 }]);
  });

  test("Fix brings the wrong answer back until it is right, then it joins recall; a recall round comes back when the topic is due", async () => {
    const w = await world();
    const topicId = await bank(w);
    const r = await startOk(w.s, "practice", topicId);
    const q = r.questions[0];
    const right = await rightOf(w, q.questionId);
    await w.s.as.mutation(api.learn.answer, { roundId: r.roundId, questionId: q.questionId, choice: (right + 1) % 3 });
    expect(await w.s.as.mutation(api.learn.start, { mode: "recall" })).toEqual({ ok: false, code: "nothing_due" });
    const fix = await startOk(w.s, "fix");
    expect(fix.questions.map((x) => x.questionId)).toEqual([q.questionId]);
    expect(await w.s.as.mutation(api.learn.answer, { roundId: fix.roundId, questionId: q.questionId, choice: right })).toMatchObject({ ok: true, right: true });
    expect(await w.s.as.mutation(api.learn.start, { mode: "fix" })).toEqual({ ok: false, code: "nothing_to_fix" });
    const fixed = (await eventsOf(w, w.s)).filter((e) => e.type === "desk.answered").at(-1)!;
    expect(fixed.payload).toMatchObject({ mode: "fix", right: true, pastWrong: true });
    // The wrong answer set the gap to 1 day and the right one to 3, so three days later the topic is due for recall.
    vi.setSystemTime(NOW + 3 * DAY + HOUR);
    const recall = await startOk(w.s, "recall");
    expect(recall.questions).toHaveLength(1);
    const rq = recall.questions[0];
    await w.s.as.mutation(api.learn.answer, { roundId: recall.roundId, questionId: rq.questionId, choice: await rightOf(w, rq.questionId) });
    expect((await eventsOf(w, w.s)).filter((e) => e.type === "desk.answered").at(-1)!.payload).toMatchObject({ mode: "recall", right: true });
  });

  test("a topic held at 0.85 or more on two answers three days apart writes desk.mastered once (A09)", async () => {
    const w = await world();
    const topicId = await bank(w);
    const answerAll = async () => {
      const r = await startOk(w.s, "practice", topicId);
      for (const q of r.questions) await w.s.as.mutation(api.learn.answer, { roundId: r.roundId, questionId: q.questionId, choice: await rightOf(w, q.questionId) });
    };
    for (let i = 0; i < 3; i += 1) await answerAll();
    vi.setSystemTime(NOW + 4 * DAY);
    for (let i = 0; i < 2; i += 1) await answerAll();
    vi.setSystemTime(NOW + 5 * DAY);
    await answerAll();
    const held = (await eventsOf(w, w.s)).filter((e) => e.type === "desk.mastered");
    expect(held).toHaveLength(1);
    expect((await w.s.as.query(api.learn.map, { now: Date.now() }))[0].step).toBe("held");
  });

  test("the desk's practice is closed while a paper is open, and a topic of another class is refused", async () => {
    const w = await world();
    const topicId = await bank(w);
    const paperId = await w.teacher.as.mutation(api.papers.create, { title: "Term", questions: [mcq("Half of eight?")] });
    await w.teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: w.a1 }, opensAt: NOW, dueAt: NOW + HOUR });
    const attempt = await w.t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).first());
    await w.s.as.mutation(api.exams.start, { attemptId: attempt!._id });
    expect(await w.s.as.mutation(api.learn.start, { mode: "practice", topicId })).toEqual({ ok: false, code: "exam_open" });
    expect(await w.sb.as.mutation(api.learn.start, { mode: "practice", topicId })).toEqual({ ok: false, code: "bad_topic" });
  });

  test("a submitted paper's answers enter the learning state: a wrong one opens a Fix item, and the event says why it went wrong", async () => {
    const w = await world();
    const paperId = await w.teacher.as.mutation(api.papers.create, { title: "Term", questions: [mcq("Half of four?"), mcq("Half of six?", 2)] });
    await w.teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: w.a1 }, opensAt: NOW, dueAt: NOW + HOUR });
    const attempt = (await w.t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).first()))!;
    await w.s.as.mutation(api.exams.start, { attemptId: attempt._id });
    vi.setSystemTime(NOW + 30 * 1000);
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice: 0 }); // tagged misread
    vi.setSystemTime(NOW + 70 * 1000);
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 1, choice: 2 });
    await w.s.as.mutation(api.exams.submit, { attemptId: attempt._id });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    const sub = (await eventsOf(w, w.s)).find((e) => e.type === "exams.submitted")!;
    expect(sub.payload).toMatchObject({ mcqTried: 2, mcqRight: 1, wrongMisread: 1, wrongCareless: 0, wrongConcept: 0, paceSec: 70, paceN: 2 });
    const state = await w.t.run((ctx) => ctx.db.query("fixItems").withIndex("by_memberId_and_questionId", (q) => q.eq("memberId", w.s.memberId)).collect());
    expect(state.map((f) => f.status)).toEqual(["open"]);
    // The Fix item waits until the paper's window has closed for everyone.
    expect(await w.s.as.mutation(api.learn.start, { mode: "fix" })).toEqual({ ok: false, code: "nothing_to_fix" });
    vi.setSystemTime(NOW + 2 * HOUR);
    expect((await startOk(w.s, "fix")).questions).toHaveLength(1);
  });

  test("a matched paper writes the gain over the earlier one (A20)", async () => {
    const w = await world();
    const sit = async (paperId: Id<"papers">, choice: number) => {
      await w.teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: w.a1 }, opensAt: Date.now(), dueAt: Date.now() + HOUR });
      const attempt = (await w.t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_paperId_and_memberId", (q) => q.eq("paperId", paperId).eq("memberId", w.s.memberId)).first()))!;
      await w.s.as.mutation(api.exams.start, { attemptId: attempt._id });
      await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, choice });
      await w.s.as.mutation(api.exams.submit, { attemptId: attempt._id });
    };
    const first = await w.teacher.as.mutation(api.papers.create, { title: "Day 1", questions: [mcq("Half of four?")] });
    // Only an earlier paper of the same teacher that was sent can be matched.
    expect(await refusal(w.teacher.as.mutation(api.papers.create, { title: "Day 21", questions: [mcq("Half of four?")], matchOf: first }))).toBe("bad_match");
    expect(await refusal(w.tb.as.mutation(api.papers.create, { title: "Day 21", questions: [mcq("Half of four?")], matchOf: first }))).toBe("bad_match");
    await sit(first, 0);
    vi.setSystemTime(NOW + 5 * DAY);
    const second = await w.teacher.as.mutation(api.papers.create, { title: "Day 21", questions: [mcq("Half of four?")], matchOf: first });
    await sit(second, 1);
    const subs = (await eventsOf(w, w.s)).filter((e) => e.type === "exams.submitted");
    expect(subs.map((e) => (e.payload as { gain?: number }).gain)).toEqual([undefined, 100]);
  });
});

describe("written answers marked by the model (D5)", () => {
  async function longId(w: World) {
    const topicId = await bank(w);
    const qs = await w.s.as.query(api.learnMark.questions, { topicId, now: Date.now() });
    expect(JSON.stringify(qs)).not.toContain("equal parts");
    return qs[0].questionId;
  }

  test("the model marks against the key points for 2 coins, the student sees the points, and the model gets no name", async () => {
    const w = await world();
    const questionId = await longId(w);
    expect(await w.s.as.action(api.learnMark.submit, { questionId, text: "A half is one of two equal parts." })).toEqual({ ok: true, care: false, status: "done" });
    expect(sent).toHaveLength(1);
    expect(JSON.stringify(sent[0])).not.toContain("s@alpha.test");
    const mine = await w.s.as.query(api.learnMark.mine, {});
    expect(mine[0]).toMatchObject({ status: "marked", marks: 3, maxMarks: 4, byTeacher: false });
    expect(mine[0].points).toEqual([{ point: "two equal parts", state: "covered" }, { point: "one of them", state: "partly" }]);
    expect((await w.s.as.query(api.desk.wallet, {})).balance).toBe(58);
  });

  test("an unsure or malformed marking goes to a teacher of the class, who sees no name, and the teacher's mark replaces it", async () => {
    const w = await world();
    const questionId = await longId(w);
    modelContent = '{"points":["covered","partly"],"confidence":0.4}';
    await w.s.as.action(api.learnMark.submit, { questionId, text: "Half is one of two equal parts." });
    const queue = await w.teacher.as.query(api.learnMark.queue, {});
    expect(queue).toHaveLength(1);
    expect(JSON.stringify(queue)).not.toMatch(/s@alpha|memberId/);
    expect(await w.tb.as.query(api.learnMark.queue, {})).toEqual([]);
    expect(await w.tb.as.mutation(api.learnMark.teacherMark, { answerId: queue[0].answerId, marks: 2 })).toEqual({ ok: false, code: "not_found" });
    expect(await w.teacher.as.mutation(api.learnMark.teacherMark, { answerId: queue[0].answerId, marks: 5 })).toEqual({ ok: false, code: "bad_mark" });
    expect(await w.teacher.as.mutation(api.learnMark.teacherMark, { answerId: queue[0].answerId, marks: 4 })).toEqual({ ok: true });
    expect((await w.s.as.query(api.learnMark.mine, {}))[0]).toMatchObject({ status: "teacher_marked", marks: 4, byTeacher: true });
  });

  test("with the model off the answer goes straight to the teachers for 0 coins; a failed call returns the coins; a dispute reaches a teacher", async () => {
    const w = await world();
    const questionId = await longId(w);
    process.env.DESK_LIVE = "false";
    expect(await w.s.as.action(api.learnMark.submit, { questionId, text: "One of two equal parts." })).toMatchObject({ status: "teacher" });
    expect(sent).toHaveLength(0);
    process.env.DESK_LIVE = "true";
    modelStatus = 500;
    expect(await w.s.as.action(api.learnMark.submit, { questionId, text: "Two equal parts, one of them." })).toMatchObject({ status: "teacher" });
    expect((await w.s.as.query(api.desk.wallet, {})).balance).toBe(60);
    modelStatus = 200;
    await w.s.as.action(api.learnMark.submit, { questionId, text: "A half is two equal parts." });
    const marked = (await w.s.as.query(api.learnMark.mine, {})).find((x) => x.status === "marked")!;
    expect(await w.s.as.mutation(api.learnMark.dispute, { answerId: marked.answerId })).toEqual({ ok: true });
    expect((await w.teacher.as.query(api.learnMark.queue, {})).filter((x) => x.disputed)).toHaveLength(1);
    // Distress words get the care text, with nothing stored.
    expect(await w.s.as.action(api.learnMark.submit, { questionId, text: "I want to die" })).toEqual({ ok: true, care: true, status: "care" });
    expect(await w.s.as.query(api.learnMark.mine, {})).toHaveLength(3);
  });

  test("a marking that never came back is given up by the minute sweep: coins back, and it waits for a teacher", async () => {
    const w = await world();
    const questionId = await longId(w);
    const r = await w.s.as.mutation(internal.learnMark.begin, { questionId, text: "Two equal parts." });
    expect(r).toMatchObject({ ok: true, mode: "model" });
    vi.setSystemTime(NOW + 5 * 60 * 1000);
    await w.t.mutation(internal.desk.sweepPending, {});
    expect((await w.s.as.query(api.learnMark.mine, {}))[0].status).toBe("teacher");
    expect((await w.s.as.query(api.desk.wallet, {})).balance).toBe(60);
  });
});

describe("plan, search and the topic map (D1 map only, D4)", () => {
  test("a teacher adds a topic with its chapter; the student finds it by search and gets a plan to the test day", async () => {
    const w = await world();
    expect(await w.teacher.as.mutation(api.topics.addToMap, { subject: "Maths", name: "Ratios", chapter: "Chapter 4" })).toMatchObject({ ok: true });
    expect(await w.s.as.query(api.learn.search, { text: "rat", now: NOW })).toMatchObject([{ name: "Ratios", chapter: "Chapter 4" }]);
    expect(await w.s.as.query(api.learn.search, { text: "chap", now: NOW })).toHaveLength(1);
    expect(await refusal(w.s.as.mutation(api.topics.addToMap, { subject: "Maths", name: "X", chapter: "" }))).toBe("forbidden");
    expect((await w.teacher.as.query(api.topics.mapForTeacher, { subject: "maths" }))[0]).toMatchObject({ name: "Ratios", inMap: true });
    expect(await w.s.as.mutation(api.learn.setPlan, { subject: "maths", testDay: "2026-10-20" })).toEqual({ ok: false, code: "bad_day" });
    expect(await w.s.as.mutation(api.learn.setPlan, { subject: "maths", testDay: "2026-10-24" })).toEqual({ ok: true });
    const plan = await w.s.as.query(api.learn.plan, { subject: "maths", now: NOW });
    expect(plan?.testDay).toBe("2026-10-24");
    expect(plan?.days.map((d) => d.day)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23"]);
    expect(plan?.days[0].topics[0]).toMatchObject({ name: "Ratios", step: "practise" });
    await w.s.as.mutation(api.learn.removePlan, { subject: "maths" });
    expect(await w.s.as.query(api.learn.plan, { subject: "maths", now: NOW })).toBeNull();
  });
});

describe("the new inputs (house spec 0030)", () => {
  test("the weekly habit feels check: four answers of 1 to 7, once a habit a week, one habits.rated event (H10)", async () => {
    const w = await world();
    const add = await w.s.as.mutation(api.habits.add, { kind: "water", title: "Water", color: "#3d6ea8", startOn: "2026-10-20", endOn: "2026-11-10" });
    const planId = (add as { id: string }).id;
    expect(await w.s.as.mutation(api.habits.rate, { planId, items: [1, 2, 3] })).toEqual({ ok: false, code: "bad_items" });
    expect(await w.s.as.mutation(api.habits.rate, { planId, items: [1, 2, 3, 8] })).toEqual({ ok: false, code: "bad_items" });
    expect(await w.s.as.mutation(api.habits.rate, { planId, items: [5, 6, 4, 5] })).toEqual({ ok: true });
    expect(await w.s.as.mutation(api.habits.rate, { planId, items: [5, 6, 4, 5] })).toEqual({ ok: false, code: "already_rated" });
    expect(await w.s.as.query(api.habits.ratedThisWeek, { now: NOW })).toEqual([planId]);
    expect(await w.s2.as.mutation(api.habits.rate, { planId, items: [5, 6, 4, 5] })).toEqual({ ok: false, code: "not_found" });
    expect((await eventsOf(w, w.s)).filter((e) => e.type === "habits.rated").map((e) => e.payload)).toEqual([{ habit: "water", score: 20 }]);
    // The next week (Monday) it can be rated again.
    vi.setSystemTime(at("2026-10-26T10:00:00+05:30"));
    expect(await w.s.as.mutation(api.habits.rate, { planId, items: [6, 6, 6, 6] })).toEqual({ ok: true });
  });

  test("a resolved doubt writes desk.resolved on the day it was asked, once, and only for a plain question (A18)", async () => {
    const w = await world();
    const r = (await w.s.as.action(api.deskAsk.ask, { kind: "chat", question: "What is a half?" })) as { ok: true; turnId: string };
    vi.setSystemTime(NOW + 2 * DAY);
    expect(await w.s.as.mutation(api.desk.resolve, { turnId: r.turnId })).toEqual({ ok: true });
    expect(await w.s.as.mutation(api.desk.resolve, { turnId: r.turnId })).toEqual({ ok: true });
    expect(await w.s2.as.mutation(api.desk.resolve, { turnId: r.turnId })).toEqual({ ok: false, code: "not_found" });
    const ev = (await eventsOf(w, w.s)).filter((e) => e.type === "desk.resolved");
    expect(ev).toHaveLength(1);
    expect(ev[0].loggedFor).toBe("2026-10-20");
  });

  test("a confirmed mark with the rubric writes exams.remarked by the teacher (A03), and a bad score is refused", async () => {
    const w = await world();
    const paperId = await w.teacher.as.mutation(api.papers.create, { title: "Essay", questions: [long] });
    await w.teacher.as.mutation(api.papers.send, { paperId, target: { kind: "class", classId: w.a1 }, opensAt: NOW, dueAt: NOW + HOUR });
    const attempt = (await w.t.run((ctx) => ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", w.s.memberId)).first()))!;
    await w.s.as.mutation(api.exams.start, { attemptId: attempt._id });
    await w.s.as.mutation(api.exams.answer, { attemptId: attempt._id, question: 0, text: "Two equal parts." });
    await w.s.as.mutation(api.exams.submit, { attemptId: attempt._id });
    expect(await refusal(w.teacher.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 0, mark: 3 }], remarks: "", rubrics: [{ question: 0, u: 5, s: 1, e: 1 }] }))).toBe("bad_rubric");
    await w.teacher.as.mutation(api.papers.markLong, { attemptId: attempt._id, marks: [{ question: 0, mark: 3 }], remarks: "Good", rubrics: [{ question: 0, u: 3, s: 2, e: 4 }] });
    await w.teacher.as.mutation(api.papers.confirm, { attemptId: attempt._id });
    const ev = (await eventsOf(w, w.s)).filter((e) => e.type === "exams.remarked");
    expect(ev.map((e) => e.payload)).toEqual([{ rubricSum: 9, rubricN: 3 }]);
    expect(ev[0].actorId).toBe(w.teacher.memberId);
  });
});

describe("export and erase (house spec 0005)", () => {
  test("the learning loop's rows are in the student's download and all erased with them", async () => {
    const w = await world();
    const topicId = await bank(w);
    const r = await startOk(w.s, "practice", topicId);
    await w.s.as.mutation(api.learn.answer, { roundId: r.roundId, questionId: r.questions[0].questionId, choice: 0, seconds: 9 });
    await w.s.as.mutation(api.learn.setPlan, { subject: "maths", testDay: "2026-10-25" });
    const pages: unknown[] = [];
    await w.t.run(async (ctx) => {
      let cursor: string | null = null;
      do {
        const page = await learnRoom.exporter(ctx, w.s.memberId, cursor, 100);
        pages.push(...page.rows);
        cursor = page.next;
      } while (cursor !== null);
    });
    const text = JSON.stringify(pages);
    expect(text).toContain("learnTopic");
    expect(text).toContain("learnAnswer");
    expect(text).toContain("studyPlan");
    await w.t.run(async (ctx) => {
      let done = false;
      while (!done) done = (await learnRoom.eraser(ctx, w.s.memberId, 100)).done;
    });
    const left = await w.t.run(async (ctx) => {
      const tables = ["learnTopics", "learnAnswers", "fixItems", "learnRounds", "studyPlans", "learnStats"] as const;
      let n = 0;
      for (const table of tables) n += (await ctx.db.query(table).collect()).filter((r: Doc<typeof table>) => (r as { memberId: Id<"members"> }).memberId === w.s.memberId).length;
      return n;
    });
    expect(left).toBe(0);
  });
});
