// The desk's learning loop (Desk Design D3, D4 and D5; house spec 0031; owner, 2026-10-28). A student finds a topic of their class (the map and search),
// practises its bank questions (marked by code, the answer key never leaves the server before the answer), goes back over every wrong answer (Fix), and
// answers short recall rounds at 1, 3, 7, 21 and 45 days (Remember). Each answer moves the student's own state on the topic (mastery, the next recall
// day); the level is only which questions come next and is never shown as a label. Plan builds a study plan for a test by code. None of it calls a model,
// so it costs no coins; written answers, which a model marks, are in learnMark.ts.
// The bank is the institute's own questions: a teacher's practice bank paper at once, and a sent paper's questions once every window of it has closed, so
// a question of a paper still open for a classmate is never shown with its answer. Every function starts with `requireMember` and a student check, refuses
// while the student sits a paper (the desk's exam lock), and acts only on the student's own rows. No staff function reads any of it.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { recordEvent, type EventActor } from "./eventLog";
import { hasOpenSitting } from "./examLock";
import { fail } from "./helpers";
import { requireMember, type MemberContext } from "./houseAuth";
import { rateLimiter } from "./limits";
import { DAY_MS, dayOf, shiftDay, todayOf } from "./dayRules";
import {
  FIX_SIZE,
  MASTERY_HELD,
  MASTERY_START,
  MAX_ANSWER_SEC,
  PACE_KEPT,
  PLAN_MAX_DAYS,
  PRACTICE_SIZE,
  RECALL_SEEN_DAYS,
  RECALL_SIZE,
  RECENT_KEPT,
  SEARCH_MAX,
  SEARCH_RESULTS,
  difficultyOf,
  heldNow,
  levelOf,
  masteryAfter,
  nextGap,
  pickOrder,
  planOf,
  topicMatches,
} from "./learnRules";
import { isSubject } from "./sessionRules";

const refused = v.object({ ok: v.literal(false), code: v.string() });
const CLASS_TOPICS_READ = 300;
const BANK_READ = 60;

type Reader = QueryCtx | MutationCtx;

// ---- The bank ----

// Whether a question may be served on the desk now: a multiple choice or long question of the student's institute, from a practice bank paper, or from a
// sent paper whose every window has closed.
async function servable(ctx: Reader, q: Doc<"paperQuestions">, instituteId: Id<"institutes">, now: number, papers: Map<string, boolean>): Promise<boolean> {
  const known = papers.get(q.paperId);
  if (known !== undefined) return known;
  const paper = await ctx.db.get(q.paperId);
  let ok = false;
  if (paper && paper.instituteId === instituteId) {
    if (paper.status === "bank") ok = true;
    else if (paper.status === "sent") {
      const sends = await ctx.db.query("paperSends").withIndex("by_paperId", (x) => x.eq("paperId", paper._id)).take(50);
      ok = sends.length > 0 && sends.every((s) => s.dueAt <= now);
    }
  }
  papers.set(q.paperId, ok);
  return ok;
}

async function bankOf(ctx: Reader, topicId: Id<"paperTopics">, kind: "mcq" | "long", instituteId: Id<"institutes">, now: number): Promise<Doc<"paperQuestions">[]> {
  const rows = await ctx.db.query("paperQuestions").withIndex("by_topicId", (x) => x.eq("topicId", topicId)).take(BANK_READ);
  const papers = new Map<string, boolean>();
  const out: Doc<"paperQuestions">[] = [];
  for (const q of rows) if (q.kind === kind && (await servable(ctx, q, instituteId, now, papers))) out.push(q);
  return out;
}

// The topics of the student's own class (sent papers, bank papers and the syllabus map), with their rows.
async function classTopicsOf(ctx: Reader, member: Doc<"members">): Promise<Doc<"paperTopics">[]> {
  if (member.classId === undefined) return [];
  const links = await ctx.db
    .query("classTopics")
    .withIndex("by_classId_and_subject_and_lastSentAt", (q) => q.eq("classId", member.classId!))
    .order("desc")
    .take(CLASS_TOPICS_READ);
  const out: Doc<"paperTopics">[] = [];
  for (const l of links) {
    const t = await ctx.db.get(l.topicId);
    if (t && t.instituteId === member.instituteId) out.push(t);
  }
  return out;
}

async function isMyTopic(ctx: Reader, member: Doc<"members">, topicId: Id<"paperTopics">): Promise<Doc<"paperTopics"> | null> {
  if (member.classId === undefined) return null;
  const link = await ctx.db.query("classTopics").withIndex("by_classId_and_topicId", (q) => q.eq("classId", member.classId!).eq("topicId", topicId)).first();
  if (!link) return null;
  const t = await ctx.db.get(topicId);
  return t && t.instituteId === member.instituteId ? t : null;
}

// ---- The student's state on a topic ----

const stateOf = (ctx: Reader, memberId: Id<"members">, topicId: Id<"paperTopics">) =>
  ctx.db.query("learnTopics").withIndex("by_memberId_and_topicId", (q) => q.eq("memberId", memberId).eq("topicId", topicId)).first();

export type Applied = { right: boolean; pastWrong: boolean; seen7: boolean; mastered: boolean };

// One multiple choice answer on a bank question, from any source: kept in `learnAnswers`, the question's counts (desk answers only, so a paper's many
// answers at once never meet on one row), the topic's state, and the Fix item (opened on a wrong answer, fixed on a right one). Returns what the event needs.
export async function applyAnswer(
  ctx: MutationCtx,
  member: Doc<"members">,
  q: Doc<"paperQuestions">,
  chosen: number,
  sec: number | null,
  source: "paper" | "practice" | "fix" | "recall",
  now: number,
): Promise<Applied> {
  const topicId = q.topicId!;
  const instituteId = member.instituteId!;
  const right = chosen === q.rightOption;
  const earlier = await ctx.db.query("learnAnswers").withIndex("by_memberId_and_questionId", (x) => x.eq("memberId", member._id).eq("questionId", q._id)).take(20);
  const pastWrong = earlier.some((a) => !a.right);
  const firstAt = earlier.reduce((m, a) => Math.min(m, a.at), Number.POSITIVE_INFINITY);
  const seen7 = Number.isFinite(firstAt) && now - firstAt >= RECALL_SEEN_DAYS * DAY_MS;
  await ctx.db.insert("learnAnswers", { memberId: member._id, instituteId, questionId: q._id, topicId, source, chosen, right, ...(sec !== null ? { sec } : {}), at: now });

  const stats = await ctx.db.query("questionStats").withIndex("by_questionId", (x) => x.eq("questionId", q._id)).first();
  const difficulty = difficultyOf(stats?.attempts ?? 0, stats?.correct ?? 0);
  if (source !== "paper") {
    if (stats) await ctx.db.patch(stats._id, { attempts: stats.attempts + 1, correct: stats.correct + (right ? 1 : 0) });
    else await ctx.db.insert("questionStats", { questionId: q._id, attempts: 1, correct: right ? 1 : 0 });
  }

  const state = await stateOf(ctx, member._id, topicId);
  const mastery = masteryAfter(state?.mastery ?? MASTERY_START, right, difficulty);
  const gap = nextGap(state?.gapDays ?? 0, right);
  const heldSince = mastery >= MASTERY_HELD ? (state?.heldSince ?? now) : undefined;
  const mastered = state?.heldAt === undefined && heldNow(mastery, heldSince ?? null, now);
  const row = {
    mastery,
    attempts: (state?.attempts ?? 0) + 1,
    right: (state?.right ?? 0) + (right ? 1 : 0),
    recent: [...(state?.recent ?? []), right].slice(-RECENT_KEPT),
    gapDays: gap,
    nextReviewAt: now + gap * DAY_MS,
    lastAt: now,
    heldSince,
    ...(mastered ? { heldAt: now } : {}),
  };
  if (state) await ctx.db.patch(state._id, row);
  else await ctx.db.insert("learnTopics", { memberId: member._id, instituteId, topicId, subject: q.subject, ...row });

  const open = (await ctx.db.query("fixItems").withIndex("by_memberId_and_questionId", (x) => x.eq("memberId", member._id).eq("questionId", q._id)).take(5)).find((f) => f.status === "open");
  if (!right && !open) await ctx.db.insert("fixItems", { memberId: member._id, instituteId, questionId: q._id, topicId, status: "open", openedAt: now });
  if (right && open) await ctx.db.patch(open._id, { status: "fixed", fixedAt: now });

  if (sec !== null && sec > 0) {
    const pace = await ctx.db.query("learnStats").withIndex("by_memberId", (x) => x.eq("memberId", member._id)).first();
    const recent = [...(pace?.paceRecent ?? []), Math.min(sec, MAX_ANSWER_SEC)].slice(-PACE_KEPT);
    if (pace) await ctx.db.patch(pace._id, { paceRecent: recent });
    else await ctx.db.insert("learnStats", { memberId: member._id, paceRecent: recent });
  }
  return { right, pastWrong, seen7, mastered };
}

// After a paper is submitted (exams.finishAttempt schedules it): each multiple choice answer of a tagged question enters the student's learning state.
export const fromPaper = internalMutation({
  args: { attemptId: v.id("paperAttempts") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.status === "assigned" || attempt.status === "open") return 0;
    const member = await ctx.db.get(attempt.memberId);
    if (!member || member.role !== "student" || member.instituteId === undefined || member.erasedAt !== undefined) return 0;
    const questions = await ctx.db.query("paperQuestions").withIndex("by_paperId", (x) => x.eq("paperId", attempt.paperId)).take(50);
    const pace = new Map((attempt.paceLog ?? []).map((p) => [p.question, p.sec]));
    const at = attempt.submittedAt ?? Date.now();
    let n = 0;
    for (const a of attempt.answers ?? []) {
      const q = questions.find((x) => x.order === a.question);
      if (!q || q.kind !== "mcq" || q.topicId === undefined || a.choice === undefined) continue;
      // Already taken in (a second run of this job) leaves the state as it is.
      const seen = await ctx.db.query("learnAnswers").withIndex("by_memberId_and_questionId", (x) => x.eq("memberId", member._id).eq("questionId", q._id)).take(20);
      if (seen.some((s) => s.source === "paper")) continue;
      await applyAnswer(ctx, member, q, a.choice, pace.get(a.question) ?? null, "paper", at);
      n += 1;
    }
    return n;
  },
});

// ---- Student functions ----

async function student(ctx: Reader): Promise<MemberContext> {
  const mc = await requireMember(ctx);
  if (mc.role !== "student" || mc.member.instituteId === undefined) fail("forbidden");
  return mc;
}

async function writeCheck(ctx: MutationCtx, mc: MemberContext): Promise<{ ok: false; code: string } | null> {
  if (!(await rateLimiter.limit(ctx, "learnCall", { key: mc.member._id })).ok) return { ok: false, code: "slow_down" };
  if (await hasOpenSitting(ctx, mc.member._id)) return { ok: false, code: "exam_open" };
  return null;
}

// The steps a topic can be on for the student, shown as which questions come next, never as a label: no answers yet, being practised, or held.
const stepOf = (s: Doc<"learnTopics"> | null): "new" | "practising" | "held" => (!s ? "new" : s.heldAt !== undefined ? "held" : "practising");

const topicView = v.object({
  topicId: v.id("paperTopics"),
  name: v.string(),
  subject: v.string(),
  chapter: v.union(v.string(), v.null()),
  step: v.string(),
  level: v.union(v.string(), v.null()),
  due: v.boolean(),
  openFix: v.number(),
});

async function topicViewOf(ctx: Reader, memberId: Id<"members">, t: Doc<"paperTopics">, now: number) {
  const s = await stateOf(ctx, memberId, t._id);
  const fixes = await ctx.db
    .query("fixItems")
    .withIndex("by_memberId_and_status_and_openedAt", (q) => q.eq("memberId", memberId).eq("status", "open"))
    .take(200);
  return {
    topicId: t._id,
    name: t.name,
    subject: t.subject,
    chapter: t.chapter ?? null,
    step: stepOf(s),
    level: s ? levelOf(s.mastery) : null,
    due: s !== null && s.nextReviewAt <= now,
    openFix: fixes.filter((f) => f.topicId === t._id).length,
  };
}

// The map: the topics of the student's class in one subject (or all), grouped by the screen by chapter, with the student's own step on each. `now` comes
// from the screen (a query does not read the clock), and only moves which topics read as due.
export const map = query({
  args: { subject: v.optional(v.string()), now: v.number() },
  returns: v.array(topicView),
  handler: async (ctx, args) => {
    const mc = await student(ctx);
    if (args.subject !== undefined && !isSubject(args.subject)) return [];
    const topics = (await classTopicsOf(ctx, mc.member)).filter((t) => args.subject === undefined || t.subject === args.subject);
    const out = [];
    for (const t of topics.slice(0, 100)) out.push(await topicViewOf(ctx, mc.member._id, t, args.now));
    return out;
  },
});

// Topic search (Desk Design mode Search, by code, 0 coins): the class's topics whose words start with the words typed.
export const search = query({
  args: { text: v.string(), now: v.number() },
  returns: v.array(topicView),
  handler: async (ctx, args) => {
    const mc = await student(ctx);
    const text = args.text.trim();
    if (text.length === 0 || [...text].length > SEARCH_MAX) return [];
    const topics = (await classTopicsOf(ctx, mc.member)).filter((t) => topicMatches(t.name, text) || (t.chapter !== undefined && topicMatches(t.chapter, text)));
    const out = [];
    for (const t of topics.slice(0, SEARCH_RESULTS)) out.push(await topicViewOf(ctx, mc.member._id, t, args.now));
    return out;
  },
});

// What the desk shows at the top of its Learn panel: recall due now, open Fix items and topics held. Counts of the student's own rows only.
export const summary = query({
  args: { now: v.number() },
  returns: v.object({ due: v.number(), openFix: v.number(), held: v.number(), topics: v.number() }),
  handler: async (ctx, args) => {
    const mc = await student(ctx);
    const due = await ctx.db.query("learnTopics").withIndex("by_memberId_and_nextReviewAt", (q) => q.eq("memberId", mc.member._id).lte("nextReviewAt", args.now)).take(100);
    const fixes = await ctx.db.query("fixItems").withIndex("by_memberId_and_status_and_openedAt", (q) => q.eq("memberId", mc.member._id).eq("status", "open")).take(200);
    const all = await ctx.db.query("learnTopics").withIndex("by_memberId_and_nextReviewAt", (q) => q.eq("memberId", mc.member._id)).take(500);
    return { due: due.length, openFix: fixes.length, held: all.filter((s) => s.heldAt !== undefined).length, topics: all.length };
  },
});

const questionView = v.object({ questionId: v.id("paperQuestions"), topic: v.string(), text: v.string(), options: v.array(v.string()) });

// Starts a round: `practice` (questions of one topic picked for the student's level), `fix` (open wrong answers, oldest first, optionally of one topic) or
// `recall` (one question of each topic due, up to five). Returns the questions without their answers.
export const start = mutation({
  args: { mode: v.string(), topicId: v.optional(v.id("paperTopics")) },
  returns: v.union(refused, v.object({ ok: v.literal(true), roundId: v.id("learnRounds"), questions: v.array(questionView) })),
  handler: async (ctx, args) => {
    const mc = await student(ctx);
    const blocked = await writeCheck(ctx, mc);
    if (blocked) return blocked;
    const member = mc.member;
    const instituteId = member.instituteId!;
    const now = Date.now();
    let picked: Doc<"paperQuestions">[] = [];
    if (args.mode === "practice") {
      if (args.topicId === undefined) return { ok: false as const, code: "bad_topic" };
      if (!(await isMyTopic(ctx, member, args.topicId))) return { ok: false as const, code: "bad_topic" };
      const bank = await bankOf(ctx, args.topicId, "mcq", instituteId, now);
      const s = await stateOf(ctx, member._id, args.topicId);
      const items = [];
      for (const q of bank) {
        const st = await ctx.db.query("questionStats").withIndex("by_questionId", (x) => x.eq("questionId", q._id)).first();
        const last = await ctx.db.query("learnAnswers").withIndex("by_memberId_and_questionId", (x) => x.eq("memberId", member._id).eq("questionId", q._id)).order("desc").first();
        items.push({ q, difficulty: difficultyOf(st?.attempts ?? 0, st?.correct ?? 0), lastSeenAt: last?.at ?? null });
      }
      picked = pickOrder(s?.mastery ?? MASTERY_START, items).slice(0, PRACTICE_SIZE).map((x) => x.q);
    } else if (args.mode === "fix") {
      const open = await ctx.db.query("fixItems").withIndex("by_memberId_and_status_and_openedAt", (q) => q.eq("memberId", member._id).eq("status", "open")).take(100);
      const papers = new Map<string, boolean>();
      for (const f of open) {
        if (args.topicId !== undefined && f.topicId !== args.topicId) continue;
        const q = await ctx.db.get(f.questionId);
        if (q && (await servable(ctx, q, instituteId, now, papers))) picked.push(q);
        if (picked.length >= FIX_SIZE) break;
      }
    } else if (args.mode === "recall") {
      const due = await ctx.db.query("learnTopics").withIndex("by_memberId_and_nextReviewAt", (q) => q.eq("memberId", member._id).lte("nextReviewAt", now)).take(20);
      for (const s of due) {
        if (!(await isMyTopic(ctx, member, s.topicId))) continue;
        const bank = await bankOf(ctx, s.topicId, "mcq", instituteId, now);
        if (bank.length === 0) continue;
        // The question answered longest ago, so a recall round is not the same question every time.
        const items = [];
        for (const q of bank) {
          const last = await ctx.db.query("learnAnswers").withIndex("by_memberId_and_questionId", (x) => x.eq("memberId", member._id).eq("questionId", q._id)).order("desc").first();
          items.push({ q, at: last?.at ?? 0 });
        }
        items.sort((a, b) => a.at - b.at);
        picked.push(items[0].q);
        if (picked.length >= RECALL_SIZE) break;
      }
    } else {
      return { ok: false as const, code: "bad_mode" };
    }
    if (picked.length === 0) return { ok: false as const, code: args.mode === "practice" ? "no_questions" : args.mode === "fix" ? "nothing_to_fix" : "nothing_due" };
    const roundId = await ctx.db.insert("learnRounds", {
      memberId: member._id,
      mode: args.mode,
      ...(args.topicId !== undefined ? { topicId: args.topicId } : {}),
      questionIds: picked.map((q) => q._id),
      answered: [],
      startedAt: now,
    });
    return { ok: true as const, roundId, questions: picked.map((q) => ({ questionId: q._id, topic: q.topic, text: q.text, options: q.options ?? [] })) };
  },
});

// Answers one question of the student's own round, marked by code. The right option comes back only now, with whether the topic has just been held.
export const answer = mutation({
  args: { roundId: v.id("learnRounds"), questionId: v.id("paperQuestions"), choice: v.number(), seconds: v.optional(v.number()) },
  returns: v.union(refused, v.object({ ok: v.literal(true), right: v.boolean(), rightOption: v.number(), mastered: v.boolean() })),
  handler: async (ctx, args) => {
    const mc = await student(ctx);
    const blocked = await writeCheck(ctx, mc);
    if (blocked) return blocked;
    const round = await ctx.db.get(args.roundId);
    if (!round || round.memberId !== mc.member._id) return { ok: false as const, code: "not_found" };
    if (!round.questionIds.includes(args.questionId)) return { ok: false as const, code: "not_in_round" };
    if (round.answered.includes(args.questionId)) return { ok: false as const, code: "answered" };
    const q = await ctx.db.get(args.questionId);
    if (!q || q.kind !== "mcq" || q.topicId === undefined || q.rightOption === undefined) return { ok: false as const, code: "not_found" };
    if (!Number.isInteger(args.choice) || args.choice < 0 || args.choice >= (q.options?.length ?? 0)) return { ok: false as const, code: "bad_choice" };
    const now = Date.now();
    const sec = args.seconds !== undefined && Number.isFinite(args.seconds) && args.seconds > 0 ? Math.min(Math.round(args.seconds), MAX_ANSWER_SEC) : null;
    const mode = round.mode as "practice" | "fix" | "recall";
    const done = await applyAnswer(ctx, mc.member, q, args.choice, sec, mode, now);
    await ctx.db.patch(round._id, { answered: [...round.answered, q._id] });
    const by: EventActor = mc;
    await recordEvent(ctx, {
      by,
      memberId: mc.member._id,
      room: "desk",
      type: "desk.answered",
      payload: { topic: q.topicId, right: done.right, mode, seen7: done.seen7, pastWrong: done.pastWrong, ...(sec !== null ? { sec } : {}) },
      occurredAt: now,
      eventKey: `learn:${round._id}-${round.answered.length}`,
      about: `learn:${round._id}`,
    });
    if (done.mastered) {
      await recordEvent(ctx, {
        by,
        memberId: mc.member._id,
        room: "desk",
        type: "desk.mastered",
        payload: { topic: q.topicId },
        occurredAt: now,
        eventKey: `held:${q.topicId}-0`,
        about: `held:${q.topicId}`,
      });
    }
    return { ok: true as const, right: done.right, rightOption: q.rightOption, mastered: done.mastered };
  },
});

// ---- Plan (Desk Design mode Plan, built by code) ----

const planDayView = v.object({ day: v.string(), topics: v.array(v.object({ topicId: v.string(), name: v.string(), step: v.string() })) });

// Sets the day of a test in one subject. The day must be from tomorrow to 30 days ahead.
export const setPlan = mutation({
  args: { subject: v.string(), testDay: v.string() },
  returns: v.union(refused, v.object({ ok: v.literal(true) })),
  handler: async (ctx, args) => {
    const mc = await student(ctx);
    const blocked = await writeCheck(ctx, mc);
    if (blocked) return blocked;
    if (!isSubject(args.subject)) return { ok: false as const, code: "bad_subject" };
    const today = todayOf(Date.now());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.testDay) || args.testDay <= today || args.testDay > shiftDay(today, PLAN_MAX_DAYS)) return { ok: false as const, code: "bad_day" };
    const found = await ctx.db.query("studyPlans").withIndex("by_memberId_and_subject", (q) => q.eq("memberId", mc.member._id).eq("subject", args.subject)).first();
    if (found) await ctx.db.patch(found._id, { testDay: args.testDay, createdAt: Date.now() });
    else await ctx.db.insert("studyPlans", { memberId: mc.member._id, subject: args.subject, testDay: args.testDay, createdAt: Date.now() });
    return { ok: true as const };
  },
});

export const removePlan = mutation({
  args: { subject: v.string() },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await student(ctx);
    const found = await ctx.db.query("studyPlans").withIndex("by_memberId_and_subject", (q) => q.eq("memberId", mc.member._id).eq("subject", args.subject)).first();
    if (found) await ctx.db.delete(found._id);
    return { ok: true as const };
  },
});

// The student's plan for one subject, worked out now from their own topics (open Fix first, then due recall, then the lowest mastery), or null.
export const plan = query({
  args: { subject: v.string(), now: v.number() },
  returns: v.union(v.null(), v.object({ testDay: v.string(), days: v.array(planDayView) })),
  handler: async (ctx, args) => {
    const mc = await student(ctx);
    const found = await ctx.db.query("studyPlans").withIndex("by_memberId_and_subject", (q) => q.eq("memberId", mc.member._id).eq("subject", args.subject)).first();
    if (!found) return null;
    const today = dayOf(args.now);
    const days: string[] = [];
    for (let d = shiftDay(today, 1); d <= found.testDay && days.length <= PLAN_MAX_DAYS; d = shiftDay(d, 1)) days.push(d);
    const topics = (await classTopicsOf(ctx, mc.member)).filter((t) => t.subject === args.subject).slice(0, 60);
    const names = new Map(topics.map((t) => [t._id as string, t.name]));
    const rows = [];
    for (const t of topics) {
      const view = await topicViewOf(ctx, mc.member._id, t, args.now);
      const s = await stateOf(ctx, mc.member._id, t._id);
      rows.push({ topicId: t._id as string, mastery: s?.mastery ?? MASTERY_START, due: view.due, openFix: view.openFix });
    }
    const built = planOf(rows, days);
    return { testDay: found.testDay, days: built.map((d) => ({ day: d.day, topics: d.topics.map((x) => ({ topicId: x.topicId, name: names.get(x.topicId) ?? "", step: x.step })) })) };
  },
});

