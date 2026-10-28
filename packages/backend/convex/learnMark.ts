// Written practice answers (Desk Design, checking answers; D5; house spec 0031). A student answers a long bank question of their class in their own words;
// the model marks it against the teacher's key points (the question's rubric, one point a line) through the desk's one gateway, and returns only a fixed
// JSON form. The mark is shown with the points hit and missed. When the model is unsure (under 0.7), fails, is switched off, or the student asks, the
// answer goes to the teachers of the student's class, who see the question, the key points and the answer, never the student's name, and whose mark
// replaces the model's. Marking costs 2 coins from the desk wallet on its way to the model, and counts against the daily cap; nothing is stored for others.
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, env, internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { deskReady, reserveModelCall, walletFor } from "./desk";
import { DEFAULT_MODEL, callModel } from "./deskAsk";
import { cleanQuestion, looksDistressed } from "./deskRules";
import { hasOpenSitting } from "./examLock";
import { fail } from "./helpers";
import { requireMember, teacherClassIds } from "./houseAuth";
import { rateLimiter } from "./limits";
import { CONFIDENCE_TO_TEACHER, MARK_COINS, MARK_SYSTEM_PROMPT, WRITTEN_MAX, keyPointsOf, marksOf, markUserText, parseMarking } from "./learnRules";

const refused = v.object({ ok: v.literal(false), code: v.string() });
const MARK_TOKENS = 200;
const SHOWN = 20;
const QUEUE = 50;

type Reader = QueryCtx | MutationCtx;

// A long question of the student's class topics that may be served: from a bank paper, or a sent paper whose every window has closed, with key points.
async function longQuestionFor(ctx: Reader, member: Doc<"members">, questionId: Id<"paperQuestions">, now: number): Promise<Doc<"paperQuestions"> | null> {
  const q = await ctx.db.get(questionId);
  if (!q || q.kind !== "long" || q.topicId === undefined || keyPointsOf(q.rubric).length === 0) return null;
  const paper = await ctx.db.get(q.paperId);
  if (!paper || paper.instituteId !== member.instituteId) return null;
  if (paper.status !== "bank") {
    if (paper.status !== "sent") return null;
    const sends = await ctx.db.query("paperSends").withIndex("by_paperId", (x) => x.eq("paperId", paper._id)).take(50);
    if (sends.length === 0 || sends.some((s) => s.dueAt > now)) return null;
  }
  if (member.classId === undefined) return null;
  const link = await ctx.db.query("classTopics").withIndex("by_classId_and_topicId", (x) => x.eq("classId", member.classId!).eq("topicId", q.topicId!)).first();
  return link ? q : null;
}

// The long questions of one topic the student may answer (text and marks only, never the key points before the answer).
export const questions = query({
  args: { topicId: v.id("paperTopics"), now: v.number() },
  returns: v.array(v.object({ questionId: v.id("paperQuestions"), text: v.string(), maxMarks: v.number() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const rows = await ctx.db.query("paperQuestions").withIndex("by_topicId", (x) => x.eq("topicId", args.topicId)).take(60);
    const out = [];
    for (const q of rows) {
      if (q.kind !== "long") continue;
      if (await longQuestionFor(ctx, mc.member, q._id, args.now)) out.push({ questionId: q._id, text: q.text, maxMarks: q.maxMarks ?? 0 });
      if (out.length >= 10) break;
    }
    return out;
  },
});

type Begin =
  | { ok: false; code: string }
  | { ok: true; mode: "care" }
  | { ok: true; mode: "teacher"; answerId: Id<"writtenAnswers"> }
  | { ok: true; mode: "model"; answerId: Id<"writtenAnswers">; question: string; points: string[]; text: string };

// Step one: the checks, then the coins and the cap when the model will mark, or straight to the teachers when the desk's model is off.
export const begin = internalMutation({
  args: { questionId: v.id("paperQuestions"), text: v.string() },
  returns: v.union(
    refused,
    v.object({ ok: v.literal(true), mode: v.literal("care") }),
    v.object({ ok: v.literal(true), mode: v.literal("teacher"), answerId: v.id("writtenAnswers") }),
    v.object({ ok: v.literal(true), mode: v.literal("model"), answerId: v.id("writtenAnswers"), question: v.string(), points: v.array(v.string()), text: v.string() }),
  ),
  handler: async (ctx, args): Promise<Begin> => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student" || mc.member.instituteId === undefined) fail("forbidden");
    const member = mc.member;
    if (!(await rateLimiter.limit(ctx, "learnMark", { key: member._id })).ok) return { ok: false, code: "rate_limited" };
    const text = cleanQuestion(args.text, "write");
    if (!text || [...text].length > WRITTEN_MAX) return { ok: false, code: "bad_answer" };
    if (looksDistressed(text)) return { ok: true, mode: "care" };
    if (await hasOpenSitting(ctx, member._id)) return { ok: false, code: "exam_open" };
    const now = Date.now();
    const q = await longQuestionFor(ctx, member, args.questionId, now);
    if (!q) return { ok: false, code: "not_found" };
    const base = {
      memberId: member._id,
      instituteId: member.instituteId!,
      ...(member.classId !== undefined ? { classId: member.classId } : {}),
      questionId: q._id,
      topicId: q.topicId!,
      text,
      maxMarks: q.maxMarks ?? 0,
      createdAt: now,
    };
    if (!deskReady(env)) {
      const answerId = await ctx.db.insert("writtenAnswers", { ...base, status: "teacher", coinsSpent: 0 });
      return { ok: true, mode: "teacher", answerId };
    }
    const wallet = await walletFor(ctx, member, now);
    if (wallet.balance < MARK_COINS) return { ok: false, code: "not_enough_coins" };
    const capped = await reserveModelCall(ctx, member, now);
    if (capped) return { ok: false, code: capped };
    await ctx.db.patch(wallet._id, { balance: wallet.balance - MARK_COINS });
    const answerId = await ctx.db.insert("writtenAnswers", { ...base, status: "marking", coinsSpent: MARK_COINS });
    return { ok: true, mode: "model", answerId, question: q.text, points: keyPointsOf(q.rubric), text };
  },
});

// Step two: the model's marking, or the teachers when it is unsure or its reply is not the fixed form (the coins stay spent: the call was made).
export const finish = internalMutation({
  args: { answerId: v.id("writtenAnswers"), reply: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.answerId);
    if (!row || row.status !== "marking") return null;
    const q = await ctx.db.get(row.questionId);
    const points = keyPointsOf(q?.rubric);
    const marked = parseMarking(args.reply, points.length);
    if (!marked || marked.confidence < CONFIDENCE_TO_TEACHER) {
      await ctx.db.patch(row._id, { status: "teacher", ...(marked ? { points: marked.points, confidence: marked.confidence } : {}) });
      return null;
    }
    await ctx.db.patch(row._id, { status: "marked", points: marked.points, confidence: marked.confidence, marks: marksOf(marked.points, row.maxMarks), markedAt: Date.now() });
    return null;
  },
});

// The model failed: the coins go back and the answer goes to the teachers.
export const failed = internalMutation({
  args: { answerId: v.id("writtenAnswers") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.answerId);
    if (!row || row.status !== "marking") return null;
    const w = await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", row.memberId)).first();
    if (w && row.coinsSpent > 0) await ctx.db.patch(w._id, { balance: w.balance + row.coinsSpent });
    await ctx.db.patch(row._id, { status: "teacher", coinsSpent: 0 });
    return null;
  },
});

// The student sends a written answer for marking.
export const submit = action({
  args: { questionId: v.id("paperQuestions"), text: v.string() },
  returns: v.union(refused, v.object({ ok: v.literal(true), care: v.boolean(), status: v.string() })),
  handler: async (ctx, args): Promise<{ ok: false; code: string } | { ok: true; care: boolean; status: string }> => {
    let start: Begin;
    try {
      start = await ctx.runMutation(internal.learnMark.begin, args);
    } catch (error) {
      if (error instanceof ConvexError) throw error;
      return { ok: false, code: "busy" };
    }
    if (!start.ok) return start;
    if (start.mode === "care") return { ok: true, care: true, status: "care" };
    if (start.mode === "teacher") return { ok: true, care: false, status: "teacher" };
    const model = (env.DESK_MODEL ?? "").trim() || DEFAULT_MODEL;
    const reply = await callModel(model, [{ role: "system", content: MARK_SYSTEM_PROMPT }, { role: "user", content: markUserText(start.question, start.points, start.text) }], MARK_TOKENS);
    if (!reply) {
      await ctx.runMutation(internal.learnMark.failed, { answerId: start.answerId });
      return { ok: true, care: false, status: "teacher" };
    }
    await ctx.runMutation(internal.learnMark.finish, { answerId: start.answerId, reply: reply.answer });
    return { ok: true, care: false, status: "done" };
  },
});

const answerView = v.object({
  answerId: v.id("writtenAnswers"),
  question: v.string(),
  text: v.string(),
  status: v.string(),
  points: v.array(v.object({ point: v.string(), state: v.union(v.string(), v.null()) })),
  marks: v.union(v.number(), v.null()),
  maxMarks: v.number(),
  byTeacher: v.boolean(),
  createdAt: v.number(),
});

// The student's own written answers, newest first: the key points with what was found (after marking), and the mark (the teacher's when there is one).
export const mine = query({
  args: {},
  returns: v.array(answerView),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const rows = await ctx.db.query("writtenAnswers").withIndex("by_memberId_and_createdAt", (q) => q.eq("memberId", mc.member._id)).order("desc").take(SHOWN);
    const out = [];
    for (const r of rows) {
      const q = await ctx.db.get(r.questionId);
      const keys = keyPointsOf(q?.rubric);
      const done = r.status === "marked" || r.status === "teacher_marked";
      out.push({
        answerId: r._id,
        question: q?.text ?? "",
        text: r.text,
        status: r.status,
        points: done ? keys.map((p, i) => ({ point: p, state: r.status === "marked" ? (r.points?.[i] ?? null) : null })) : [],
        marks: r.teacherMarks ?? r.marks ?? null,
        maxMarks: r.maxMarks,
        byTeacher: r.teacherMarks !== undefined,
        createdAt: r.createdAt,
      });
    }
    return out;
  },
});

// The student asks a teacher to look at the model's mark. The model's mark stays shown until a teacher marks it.
export const dispute = mutation({
  args: { answerId: v.id("writtenAnswers") },
  returns: v.union(refused, v.object({ ok: v.literal(true) })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const r = await ctx.db.get(args.answerId);
    if (!r || r.memberId !== mc.member._id) return { ok: false as const, code: "not_found" };
    if (r.status !== "marked") return { ok: false as const, code: "not_marked" };
    await ctx.db.patch(r._id, { status: "teacher", disputed: true });
    return { ok: true as const };
  },
});

// ---- The teachers' queue ----

// The written answers waiting for a teacher of the student's class: the question, the key points, the answer and the model's points when it gave any.
// Never the student's name or id: the teacher marks the answer, not the person.
export const queue = query({
  args: {},
  returns: v.array(
    v.object({
      answerId: v.id("writtenAnswers"),
      question: v.string(),
      points: v.array(v.string()),
      modelPoints: v.union(v.null(), v.array(v.string())),
      text: v.string(),
      maxMarks: v.number(),
      disputed: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    const out = [];
    for (const classId of await teacherClassIds(ctx, mc.member._id)) {
      const rows = await ctx.db.query("writtenAnswers").withIndex("by_classId_and_status", (q) => q.eq("classId", classId).eq("status", "teacher")).take(QUEUE);
      for (const r of rows) {
        if (r.instituteId !== mc.member.instituteId) continue;
        const q = await ctx.db.get(r.questionId);
        out.push({
          answerId: r._id,
          question: q?.text ?? "",
          points: keyPointsOf(q?.rubric),
          modelPoints: r.points ?? null,
          text: r.text,
          maxMarks: r.maxMarks,
          disputed: r.disputed === true,
          createdAt: r.createdAt,
        });
      }
    }
    return out.sort((a, b) => a.createdAt - b.createdAt).slice(0, QUEUE);
  },
});

// A teacher of the student's class gives the mark. It replaces the model's.
export const teacherMark = mutation({
  args: { answerId: v.id("writtenAnswers"), marks: v.number() },
  returns: v.union(refused, v.object({ ok: v.literal(true) })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "examWrite", { key: mc.member._id })).ok) return { ok: false as const, code: "slow_down" };
    const r = await ctx.db.get(args.answerId);
    if (!r || r.instituteId !== mc.member.instituteId || r.classId === undefined) return { ok: false as const, code: "not_found" };
    if (!(await teacherClassIds(ctx, mc.member._id)).includes(r.classId)) return { ok: false as const, code: "not_found" };
    if (r.status !== "teacher") return { ok: false as const, code: "not_waiting" };
    if (!Number.isInteger(args.marks) || args.marks < 0 || args.marks > r.maxMarks) return { ok: false as const, code: "bad_mark" };
    await ctx.db.patch(r._id, { status: "teacher_marked", teacherMarks: args.marks, teacherId: mc.member._id, markedAt: Date.now() });
    return { ok: true as const };
  },
});
