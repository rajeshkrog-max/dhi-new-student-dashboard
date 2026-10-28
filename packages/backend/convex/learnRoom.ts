// The desk's learning loop's hooks into export and erase (house spec 0031; spec house/0005, AC-12 and AC-13). Registered in roomRegistry.ts beside the
// desk's own entry, with the desk's kind: the topic states, the answers, the Fix items, the rounds, the written answers and the plans are all the
// student's own. This file registers no Convex function. The export is one page of each table in turn (the cursor names the table and the last time);
// the erase deletes a page of each in turn until all are empty. `questionStats` holds no student and stays.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { RoomEntry } from "./roomRegistry";

const PAGE = 100;
const STEPS = ["topics", "answers", "fix", "written", "plans"] as const;
type Step = (typeof STEPS)[number];

async function pageOf(ctx: QueryCtx | MutationCtx, memberId: Id<"members">, step: Step, after: number, size: number): Promise<{ rows: unknown[]; last: number | null }> {
  if (step === "topics") {
    const rows = (await ctx.db.query("learnTopics").withIndex("by_memberId_and_topicId", (q) => q.eq("memberId", memberId)).take(500)).filter((r) => r._creationTime > after).slice(0, size);
    return { rows: rows.map((r) => ({ learnTopic: { topicId: r.topicId, subject: r.subject, mastery: r.mastery, attempts: r.attempts, right: r.right, nextReviewAt: r.nextReviewAt, heldAt: r.heldAt ?? null } })), last: rows.length === size ? rows[rows.length - 1]._creationTime : null };
  }
  if (step === "answers") {
    const rows = await ctx.db.query("learnAnswers").withIndex("by_memberId_and_at", (q) => q.eq("memberId", memberId).gt("at", after)).take(size);
    return { rows: rows.map((r) => ({ learnAnswer: { questionId: r.questionId, topicId: r.topicId, source: r.source, chosen: r.chosen, right: r.right, seconds: r.sec ?? null, at: r.at } })), last: rows.length === size ? rows[rows.length - 1].at : null };
  }
  if (step === "fix") {
    const rows = (await ctx.db.query("fixItems").withIndex("by_memberId_and_questionId", (q) => q.eq("memberId", memberId)).take(1000)).filter((r) => r._creationTime > after).slice(0, size);
    return { rows: rows.map((r) => ({ fixItem: { questionId: r.questionId, status: r.status, openedAt: r.openedAt, fixedAt: r.fixedAt ?? null } })), last: rows.length === size ? rows[rows.length - 1]._creationTime : null };
  }
  if (step === "written") {
    const rows = await ctx.db.query("writtenAnswers").withIndex("by_memberId_and_createdAt", (q) => q.eq("memberId", memberId).gt("createdAt", after)).take(size);
    return {
      rows: rows.map((r) => ({ writtenAnswer: { questionId: r.questionId, text: r.text, status: r.status, points: r.points ?? null, marks: r.marks ?? null, teacherMarks: r.teacherMarks ?? null, maxMarks: r.maxMarks, at: r.createdAt } })),
      last: rows.length === size ? rows[rows.length - 1].createdAt : null,
    };
  }
  const rows = await ctx.db.query("studyPlans").withIndex("by_memberId_and_subject", (q) => q.eq("memberId", memberId)).take(20);
  return { rows: rows.map((r) => ({ studyPlan: { subject: r.subject, testDay: r.testDay } })), last: null };
}

export const learnRoom: RoomEntry = {
  room: "desk",
  table: "learnTopics", // and "learnStats", "learnAnswers", "fixItems", "learnRounds", "writtenAnswers" and "studyPlans": all in the data map, all erased here
  kinds: ["desk"],
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    const [name, at] = (cursor ?? "topics:0").split(":");
    const step = (STEPS as readonly string[]).includes(name) ? (name as Step) : null;
    const after = Number(at);
    if (step === null || Number.isNaN(after)) return { rows: [], next: null };
    // An empty table is passed over in the same call, so a student who never used the loop gets one empty page and not five.
    for (let i = STEPS.indexOf(step), from = after; i < STEPS.length; i += 1, from = 0) {
      const page = await pageOf(ctx, memberId, STEPS[i], from, Math.min(limit, PAGE));
      if (page.last !== null) return { rows: page.rows, next: `${STEPS[i]}:${page.last}` };
      if (page.rows.length > 0 || i + 1 === STEPS.length) return { rows: page.rows, next: i + 1 < STEPS.length ? `${STEPS[i + 1]}:0` : null };
    }
    return { rows: [], next: null };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    let deleted = 0;
    const tables = [
      () => ctx.db.query("learnAnswers").withIndex("by_memberId_and_at", (q) => q.eq("memberId", memberId)).take(limit),
      () => ctx.db.query("fixItems").withIndex("by_memberId_and_questionId", (q) => q.eq("memberId", memberId)).take(limit),
      () => ctx.db.query("learnRounds").withIndex("by_memberId_and_startedAt", (q) => q.eq("memberId", memberId)).take(limit),
      () => ctx.db.query("writtenAnswers").withIndex("by_memberId_and_createdAt", (q) => q.eq("memberId", memberId)).take(limit),
      () => ctx.db.query("studyPlans").withIndex("by_memberId_and_subject", (q) => q.eq("memberId", memberId)).take(limit),
      () => ctx.db.query("learnStats").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit),
      () => ctx.db.query("learnTopics").withIndex("by_memberId_and_topicId", (q) => q.eq("memberId", memberId)).take(limit),
    ];
    for (const read of tables) {
      const rows = await read();
      for (const r of rows) await ctx.db.delete(r._id);
      deleted += rows.length;
      if (rows.length >= limit) return { deleted, done: false };
    }
    return { deleted, done: true };
  },
};
