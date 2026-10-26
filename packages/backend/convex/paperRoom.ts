// The exams room's hooks into export and erase (spec house/0011 and house/0012; house/0005, AC-12 and AC-13). Registered in roomRegistry.ts.
// This file registers no Convex function. A page of a student's attempt rows for their download (the paper title, the window, the status and
// the confirmed marks, with no answers), and a page of their attempt rows deleted for the erase.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { RoomEntry } from "./roomRegistry";
import { totalOf } from "./papersRules";

export const PAPER_ATTEMPT_TABLE = "paperAttempts";

export const examRoom: RoomEntry = {
  room: "exams",
  table: PAPER_ATTEMPT_TABLE,
  kinds: ["academic"],
  // The cursor is the creation time of the last row sent, read with `gt` on the index, oldest first.
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    const rows = await ctx.db
      .query("paperAttempts")
      .withIndex("by_memberId", (q) => (cursor === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("_creationTime", Number(cursor))))
      .take(limit + 1);
    const page = rows.slice(0, limit);
    const papers = await Promise.all(page.map((r) => ctx.db.get(r.paperId)));
    return {
      rows: page.map((r, i) => ({
        paper: papers[i]?.title ?? "",
        opensAt: r.opensAt,
        dueAt: r.dueAt,
        status: r.status,
        total: (r.mcqCorrect ?? 0) + totalOf(r.marks ?? []),
        remarks: r.remarks ?? "",
        // The student's own answers, the long written ones included (review of 2026-10-26): the choice they picked and the text they wrote.
        answers: (r.answers ?? []).map((a) => ({ question: a.question, choice: a.choice ?? null, text: a.text ?? "" })),
      })),
      next: rows.length > limit ? String(page[page.length - 1]._creationTime) : null,
    };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const rows = await ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const row of rows) await ctx.db.delete(row._id);
    return { deleted: rows.length, done: rows.length < limit };
  },
};
