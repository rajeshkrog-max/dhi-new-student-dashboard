// The mood room's hooks into export and erase (spec house/0006, AC-9; spec house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This
// file registers no Convex function. A page of the student's rows for their download, and a page of their rows deleted for the erase.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { RoomEntry } from "./roomRegistry";

export const MOOD_TABLE = "moodDays";

export const moodRoom: RoomEntry = {
  room: "mood",
  table: MOOD_TABLE,
  kinds: ["mood"],
  // The cursor is the last day key sent, read with `gt` on the index, so no paginate call is needed (a function may paginate only once).
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    const rows = await ctx.db
      .query("moodDays")
      .withIndex("by_memberId_and_day", (q) => (cursor === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("day", cursor)))
      .take(limit + 1);
    const page = rows.slice(0, limit);
    return { rows: page.map((r) => ({ day: r.day, mood: r.mood, note: r.note ?? "" })), next: rows.length > limit ? page[page.length - 1].day : null };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const rows = await ctx.db.query("moodDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId)).take(limit);
    for (const row of rows) await ctx.db.delete("moodDays", row._id);
    return { deleted: rows.length, done: rows.length < limit };
  },
};
