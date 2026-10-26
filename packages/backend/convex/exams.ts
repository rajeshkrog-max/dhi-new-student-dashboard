// The exams room, the student's sitting (spec house/0012). A student opens a paper that was sent to them inside its window, answers it, and
// submits it. Answers are saved as the student goes, so they can leave and come back until the window closes. When the window closes, whatever
// is written is submitted for them: at once by the minute sweep (`sweep`), or on the student's next call if that comes first. A window that closes
// with nothing answered is one miss (the owner's rule), and the empty attempt is kept. Each finished attempt writes one event for the Brain: a
// submission as small counts, or a miss.
// The right answers and the wrong option tags never leave the server: the questions returned during a sitting hold only the text and the options,
// and a hint is shown only after the student asks for it. Every function starts with `requireMember`, so the consent gate applies, and every
// write takes a token from `examWrite` first (a refusal is returned, not thrown, so the count stays). The screen's menu lock is client side only.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { recordEvent, recordSystemEvent, type EventActor } from "./eventLog";
import { fail } from "./helpers";
import { requireMember } from "./houseAuth";
import { hasOpenSitting } from "./examLock";
import { rateLimiter } from "./limits";
import { isOpenAt } from "./papersRules";
import { pausedWithin } from "./pauseHistory";

const MAX_LONG_ANSWER = 2000;
// Attempts closed in one run for each status. Closing writes the attempt and an event (about 30 documents read), so a run stays well inside a
// transaction; when either batch is full the sweep schedules itself again at once.
const SWEEP_BATCH = 25;

// The questions of a paper, read once for a run that closes many attempts of the same paper.
type Questions = Map<string, Doc<"paperQuestions">[]>;
async function questionsOf(ctx: QueryCtx | MutationCtx, paperId: Id<"papers">, cache?: Questions): Promise<Doc<"paperQuestions">[]> {
  const known = cache?.get(paperId);
  if (known) return known;
  const rows = await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", paperId)).take(50);
  cache?.set(paperId, rows);
  return rows;
}

type Closer = EventActor | "system";
const slowDown = { ok: false as const, code: "slow_down" };

// The student's own attempt, or refuse. Returns the attempt after the window has been closed for it, when it has.
async function ownAttempt(ctx: MutationCtx, mc: EventActor, attemptId: Id<"paperAttempts">): Promise<Doc<"paperAttempts">> {
  const attempt = await ctx.db.get(attemptId);
  if (!attempt || attempt.memberId !== mc.member._id) fail("not_found");
  return await closeIfDue(ctx, attempt, mc);
}

// What a set of answers holds against the paper's questions: the multiple choice questions tried and right (one mark each), and the long answers
// with writing in them. A question with no answer scores nothing.
async function tally(ctx: QueryCtx | MutationCtx, paperId: Id<"papers">, answers: readonly { question: number; choice?: number | undefined; text?: string | undefined }[], cache?: Questions) {
  const questions = await questionsOf(ctx, paperId, cache);
  let tried = 0;
  let right = 0;
  let longDone = 0;
  for (const a of answers) {
    const q = questions.find((x) => x.order === a.question);
    if (!q) continue;
    if (q.kind === "mcq") {
      if (a.choice === undefined) continue;
      tried += 1;
      if (a.choice === q.rightOption) right += 1;
    } else if (a.text !== undefined && a.text.trim() !== "") {
      longDone += 1;
    }
  }
  return { tried, right, longDone };
}

// Ends an attempt: the status, the multiple choice score (fixed here, the moment the attempt is submitted) and the Brain's event. `at` is when the
// sitting ended: the student's press, or the due time of a closed window. A sitting with nothing answered is a miss. `strict` lets the log's refusal
// stop the call (the student's own Submit); a closing done for a window that ended carries on without the event, because the room's own row is the
// record and a stuck close would stay open for ever. The log checks everything before it writes, so a refused event leaves nothing half written.
async function finishAttempt(ctx: MutationCtx, attempt: Doc<"paperAttempts">, by: Closer, at: number, auto: boolean, strict: boolean, cache?: Questions): Promise<void> {
  const { tried, right, longDone } = await tally(ctx, attempt.paperId, attempt.answers ?? [], cache);
  const missed = tried + longDone === 0;
  await ctx.db.patch(attempt._id, { status: "submitted", submittedAt: at, autoSubmitted: auto, missed, mcqCorrect: right });
  const about = `exam:${attempt._id}`;
  const input = {
    memberId: attempt.memberId,
    room: "exams",
    type: missed ? "exams.missed" : "exams.submitted",
    payload: missed ? {} : { auto, mcqTried: tried, mcqRight: right, longDone, hints: (attempt.hintsOpened ?? []).length },
    occurredAt: at,
    eventKey: `${about}-0`,
    about,
  };
  try {
    if (by === "system") await recordSystemEvent(ctx, input);
    else await recordEvent(ctx, { ...input, by });
  } catch (error) {
    if (strict) throw error;
  }
}

// Closes a window that has ended. An open attempt is submitted with what it holds; an attempt with no answers, or one never started, is a miss, except
// that a window which ends while the student's class has its logins paused is not a miss (spec house/0021): the student could not sit it, so the attempt
// is closed as excused, with no event, and the teacher and the student are told so. An attempt that already holds answers is submitted as usual.
export async function closeIfDue(ctx: MutationCtx, attempt: Doc<"paperAttempts">, by: Closer, cache?: Questions): Promise<Doc<"paperAttempts">> {
  if (Date.now() < attempt.dueAt) return attempt;
  if (attempt.status !== "assigned" && attempt.status !== "open") return attempt;
  // "No answers" is what the miss rule says it is (nothing chosen and no text in a long answer), so a blank box that was saved still counts as none.
  const held = await tally(ctx, attempt.paperId, attempt.answers ?? [], cache);
  if (held.tried + held.longDone === 0) {
    const student = await ctx.db.get(attempt.memberId);
    // Judged at the moment the window ended, so a sweep that runs after the class was resumed still excuses it.
    if (await pausedWithin(ctx, student?.classId, attempt.dueAt, attempt.dueAt + 1)) {
      await ctx.db.patch(attempt._id, { status: "submitted", submittedAt: attempt.dueAt, autoSubmitted: true, missed: false, excused: true, mcqCorrect: 0 });
      return (await ctx.db.get(attempt._id))!;
    }
  }
  await finishAttempt(ctx, attempt, by, attempt.dueAt, true, false, cache);
  return (await ctx.db.get(attempt._id))!;
}

// Every minute: close the sittings whose window has ended, so a paper nobody opens again still becomes a miss and the teacher sees the real state.
export const sweep = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const cache: Questions = new Map();
    let closed = 0;
    let more = false;
    for (const status of ["assigned", "open"] as const) {
      const due = await ctx.db
        .query("paperAttempts")
        .withIndex("by_status_and_dueAt", (q) => q.eq("status", status).lte("dueAt", now))
        .take(SWEEP_BATCH);
      for (const attempt of due) {
        const after = await closeIfDue(ctx, attempt, "system", cache);
        if (after.status === "submitted") closed += 1;
      }
      if (due.length === SWEEP_BATCH) more = true;
    }
    if (more) await ctx.scheduler.runAfter(0, internal.exams.sweep, {});
    return closed;
  },
});

// Whether the student has a sitting open (the exam lock, owner 2026-10-26): the house frame locks every other room while it is true, also after a
// reload, and the rooms refuse on the server (examLock.ts).
export const sitting = query({
  args: {},
  returns: v.object({ open: v.boolean() }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    return { open: await hasOpenSitting(ctx, mc.member._id) };
  },
});

// The student opens an attempt. It must be inside the window and not yet submitted.
export const start = mutation({
  args: { attemptId: v.id("paperAttempts") },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "examWrite", { key: mc.member._id })).ok) return slowDown;
    const attempt = await ownAttempt(ctx, mc, args.attemptId);
    // A refusal is returned, not thrown, so a window closed just now keeps its write (a thrown error rolls the whole call back).
    if (attempt.status === "open") return { ok: true as const };
    if (attempt.status !== "assigned") return { ok: false as const, code: "closed" };
    if (!isOpenAt(Date.now(), attempt.opensAt, attempt.dueAt)) return { ok: false as const, code: Date.now() < attempt.opensAt ? "not_open" : "closed" };
    await ctx.db.patch(attempt._id, { status: "open", startedAt: Date.now(), answers: [] });
    return { ok: true as const };
  },
});

// The questions of an open sitting: the text and the options only, never a right answer or a tag, and whether a hint can be asked for.
export const questions = query({
  args: { attemptId: v.id("paperAttempts") },
  returns: v.object({
    open: v.boolean(),
    dueAt: v.number(),
    items: v.array(
      v.object({
        order: v.number(),
        kind: v.string(),
        subject: v.string(),
        topic: v.string(),
        text: v.string(),
        options: v.array(v.string()),
        maxMarks: v.number(),
        hasHint: v.boolean(),
      }),
    ),
    answers: v.array(v.object({ question: v.number(), choice: v.optional(v.number()), text: v.optional(v.string()) })),
  }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.memberId !== mc.member._id) fail("not_found");
    // Not open (not started, or the window has closed) is a flag, not an error, so the screen can say so without failing.
    if (attempt.status !== "open" || !isOpenAt(Date.now(), attempt.opensAt, attempt.dueAt)) return { open: false, dueAt: attempt.dueAt, items: [], answers: [] };
    const rows = await ctx.db.query("paperQuestions").withIndex("by_paperId", (q) => q.eq("paperId", attempt.paperId)).take(50);
    return {
      open: true,
      dueAt: attempt.dueAt,
      items: rows
        .sort((a, b) => a.order - b.order)
        .map((q) => ({
          order: q.order,
          kind: q.kind,
          subject: q.subject,
          topic: q.topic,
          text: q.text,
          options: q.options ?? [],
          maxMarks: q.maxMarks ?? 0,
          hasHint: q.hint !== undefined,
        })),
      answers: attempt.answers ?? [],
    };
  },
});

// Saves one answer as the student goes. A choice must be a real option index; a long answer is text up to 2000 characters.
export const answer = mutation({
  args: { attemptId: v.id("paperAttempts"), question: v.number(), choice: v.optional(v.number()), text: v.optional(v.string()) },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "examWrite", { key: mc.member._id })).ok) return slowDown;
    const attempt = await ownAttempt(ctx, mc, args.attemptId);
    if (attempt.status !== "open") return { ok: false as const, code: attempt.status === "assigned" ? "not_open" : "closed" };
    const q = (await ctx.db.query("paperQuestions").withIndex("by_paperId", (x) => x.eq("paperId", attempt.paperId)).take(50)).find((x) => x.order === args.question);
    if (!q) fail("bad_question");
    let next: { question: number; choice?: number; text?: string };
    if (q.kind === "mcq") {
      if (!Number.isInteger(args.choice) || (args.choice as number) < 0 || (args.choice as number) >= (q.options?.length ?? 0)) fail("bad_choice");
      next = { question: args.question, choice: args.choice };
    } else {
      if (typeof args.text !== "string" || [...args.text].length > MAX_LONG_ANSWER) fail("bad_answer");
      next = { question: args.question, text: args.text };
    }
    const others = (attempt.answers ?? []).filter((a) => a.question !== args.question);
    await ctx.db.patch(attempt._id, { answers: [...others, next] });
    return { ok: true as const };
  },
});

// The student asks for a question's hint. It is the teacher's own words (papers.create refuses a hint that gives the answer away), and opening it is
// remembered on the attempt, once for each question, so the Brain can count how many hints a sitting used. Only an open sitting gives a hint.
export const hint = mutation({
  args: { attemptId: v.id("paperAttempts"), question: v.number() },
  returns: v.union(v.object({ ok: v.literal(true), text: v.string() }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "examWrite", { key: mc.member._id })).ok) return slowDown;
    const attempt = await ownAttempt(ctx, mc, args.attemptId);
    if (attempt.status !== "open") return { ok: false as const, code: attempt.status === "assigned" ? "not_open" : "closed" };
    const q = (await ctx.db.query("paperQuestions").withIndex("by_paperId", (x) => x.eq("paperId", attempt.paperId)).take(50)).find((x) => x.order === args.question);
    if (!q) fail("bad_question");
    if (q.hint === undefined) return { ok: false as const, code: "no_hint" };
    const opened = attempt.hintsOpened ?? [];
    if (!opened.includes(args.question)) await ctx.db.patch(attempt._id, { hintsOpened: [...opened, args.question] });
    return { ok: true as const, text: q.hint };
  },
});

// The student submits. Nothing can change after it.
export const submit = mutation({
  args: { attemptId: v.id("paperAttempts") },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "examWrite", { key: mc.member._id })).ok) return slowDown;
    const attempt = await ownAttempt(ctx, mc, args.attemptId);
    if (attempt.status !== "open") return { ok: false as const, code: attempt.status === "assigned" ? "not_open" : "closed" };
    await finishAttempt(ctx, attempt, mc, Date.now(), false, true);
    return { ok: true as const };
  },
});

// The student accepts the teacher's feedback on a confirmed mark. The time is recorded once: pressing it again changes nothing.
export const acceptFeedback = mutation({
  args: { attemptId: v.id("paperAttempts") },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "examWrite", { key: mc.member._id })).ok) return slowDown;
    const attempt = await ctx.db.get(args.attemptId);
    if (!attempt || attempt.memberId !== mc.member._id) fail("not_found");
    if (attempt.status !== "confirmed") return { ok: false as const, code: "not_confirmed" };
    if (attempt.acceptedAt === undefined) await ctx.db.patch(attempt._id, { acceptedAt: Date.now() });
    return { ok: true as const };
  },
});
