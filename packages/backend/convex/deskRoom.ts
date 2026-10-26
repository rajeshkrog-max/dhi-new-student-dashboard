// The desk's hooks into export and erase (spec house/0016; spec house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This file registers no
// Convex function. The export is pages of the student's talks (10), each with its questions and answers and the coins taken, then, if there are any,
// pages of the desk sittings with the answer to the feeling card (cursor `s:`). The erase deletes the turns first, then the talks, then the sittings, then
// the wallet, a page at a time. The shared cache holds no student and stays.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { RoomEntry } from "./roomRegistry";

const EXPORT_TALKS_PAGE = 10;
const EXPORT_SITTINGS_PAGE = 50;
const TURNS_PER_TALK = 100;

async function sittingsPage(ctx: QueryCtx | MutationCtx, memberId: Id<"members">, after: number, size: number) {
  const rows = await ctx.db
    .query("deskSittings")
    .withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", memberId).gt("lastAt", after))
    .take(size + 1);
  const page = rows.slice(0, size);
  return {
    rows: page.map((s) => ({
      sitting: true,
      startedAt: s.startedAt,
      lastAt: s.lastAt,
      card: s.feedbackStatus ?? "open",
      feel: s.feel ?? null,
      focus: s.focus ?? null,
      subject: s.subject ?? null,
    })),
    next: rows.length > size ? `s:${page[page.length - 1].lastAt}` : null,
  };
}

export const deskRoom: RoomEntry = {
  room: "desk",
  table: "deskThreads", // and "deskTurns", "deskSittings" and "deskWallets": all are in the data map, and the eraser clears all four
  kinds: ["desk"],
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    if (cursor !== null && cursor.startsWith("s:")) {
      const after = Number(cursor.slice(2));
      if (Number.isNaN(after)) return { rows: [], next: null };
      return await sittingsPage(ctx, memberId, after, Math.min(limit, EXPORT_SITTINGS_PAGE));
    }
    const size = Math.min(limit, EXPORT_TALKS_PAGE);
    const after = cursor === null ? null : Number(cursor);
    if (after !== null && Number.isNaN(after)) return { rows: [], next: null };
    const talks = await ctx.db
      .query("deskThreads")
      .withIndex("by_memberId_and_lastAt", (q) => (after === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("lastAt", after)))
      .take(size + 1);
    const page = talks.slice(0, size);
    const rows = [];
    for (const t of page) {
      const turns = await ctx.db.query("deskTurns").withIndex("by_threadId", (q) => q.eq("threadId", t._id)).take(TURNS_PER_TALK);
      rows.push({
        title: t.title,
        lastAt: t.lastAt,
        turns: turns.map((x) => ({ kind: x.kind, question: x.question, answer: x.answer ?? null, status: x.status, coinsSpent: x.coinsSpent, cached: x.cached, at: x.createdAt })),
      });
    }
    if (talks.length > size) return { rows, next: String(page[page.length - 1].lastAt) };
    // The talks are done: the sittings follow, only when the student has any.
    const some = await ctx.db.query("deskSittings").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", memberId)).first();
    return { rows, next: some ? "s:0" : null };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const turns = await ctx.db.query("deskTurns").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const x of turns) await ctx.db.delete("deskTurns", x._id);
    if (turns.length >= limit) return { deleted: turns.length, done: false };
    const talks = await ctx.db.query("deskThreads").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", memberId)).take(limit);
    for (const t of talks) await ctx.db.delete("deskThreads", t._id);
    if (talks.length >= limit) return { deleted: turns.length + talks.length, done: false };
    const sittings = await ctx.db.query("deskSittings").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", memberId)).take(limit);
    for (const s of sittings) await ctx.db.delete("deskSittings", s._id);
    if (sittings.length >= limit) return { deleted: turns.length + talks.length + sittings.length, done: false };
    const wallets = await ctx.db.query("deskWallets").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const w of wallets) await ctx.db.delete("deskWallets", w._id);
    return { deleted: turns.length + talks.length + sittings.length + wallets.length, done: true };
  },
};
