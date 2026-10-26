// The Brain's hooks into export and erase (spec house/0019; house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This file registers no
// Convex function. A page of a student's daily values for their download, one row for each day (holding that day's measures, a top and a bottom
// each), so a page is never more than the 100 rows an export page may hold, and a page of them deleted for the erase, with the patterns they hid.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { RoomEntry } from "./roomRegistry";

export const BRAIN_TABLE = "brainDays";

export const brainRoom: RoomEntry = {
  room: "brain",
  table: BRAIN_TABLE,
  kinds: ["brain"],
  // The cursor is the last day sent, read with `gt` on the day index, oldest first.
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    const rows = await ctx.db
      .query("brainDays")
      .withIndex("by_memberId_and_day", (q) => (cursor === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("day", cursor)))
      .take(limit + 1);
    const page = rows.slice(0, limit);
    return {
      rows: page.map((r) => ({ day: r.day, values: r.values })),
      next: rows.length > limit ? page[page.length - 1].day : null,
    };
  },
  // The hidden patterns go with the first page of days: there are only a few of them.
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const hides = await ctx.db.query("brainHides").withIndex("by_memberId_and_patternId", (q) => q.eq("memberId", memberId)).take(50);
    for (const row of hides) await ctx.db.delete(row._id);
    const days = await ctx.db.query("brainDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId)).take(limit);
    for (const row of days) await ctx.db.delete(row._id);
    return { deleted: hides.length + days.length, done: days.length < limit };
  },
};
