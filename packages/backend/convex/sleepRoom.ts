// The sleep room's hooks into export and erase (spec house/0008, AC-9; spec house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This file
// registers no Convex function. A page of the student's nights for their download (oldest first, with clock times), and a page of their nights
// deleted for the erase.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { RoomEntry } from "./roomRegistry";
import { bedMinToClock, clockText, wakeClockOf } from "./sleepRules";

export const SLEEP_TABLE = "sleepNights";

export const sleepRoom: RoomEntry = {
  room: "sleep",
  table: SLEEP_TABLE,
  kinds: ["sleep"],
  // The cursor is the last day key sent, read with `gt` on the index, oldest first (a function may paginate only once).
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    const rows = await ctx.db
      .query("sleepNights")
      .withIndex("by_memberId_and_day", (q) => (cursor === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("day", cursor)))
      .take(limit + 1);
    const page = rows.slice(0, limit);
    return {
      rows: page.map((r) => ({
        day: r.day,
        bed: clockText(bedMinToClock(r.bedMin)),
        wake: clockText(wakeClockOf(r.bedMin, r.lengthMin)),
        lengthMin: r.lengthMin,
      })),
      next: rows.length > limit ? page[page.length - 1].day : null,
    };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const rows = await ctx.db.query("sleepNights").withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId)).take(limit);
    for (const row of rows) await ctx.db.delete("sleepNights", row._id);
    return { deleted: rows.length, done: rows.length < limit };
  },
};
