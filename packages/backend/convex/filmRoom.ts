// The modules room's hooks into export and erase (spec house/0013 and house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This file
// registers no Convex function. A page of the student's film progress for their download (the film title, whether it was kept, and the score),
// and a page of their progress rows deleted for the erase. The films themselves are DHI's and are never deleted.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { RoomEntry } from "./roomRegistry";

export const filmRoom: RoomEntry = {
  room: "modules",
  table: "filmProgress",
  kinds: ["modules"],
  // The cursor is the creation time of the last row sent, read with `gt` on the index, oldest first.
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    const rows = await ctx.db
      .query("filmProgress")
      .withIndex("by_memberId", (q) => (cursor === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("_creationTime", Number(cursor))))
      .take(limit + 1);
    const page = rows.slice(0, limit);
    const films = await Promise.all(page.map((r) => ctx.db.get(r.filmId)));
    return {
      rows: page.map((r, i) => ({ film: films[i]?.title ?? "", kept: r.scored, score: r.scored ? (films[i]?.scoreValue ?? 0) : 0 })),
      next: rows.length > limit ? String(page[page.length - 1]._creationTime) : null,
    };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const rows = await ctx.db.query("filmProgress").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const row of rows) await ctx.db.delete(row._id);
    return { deleted: rows.length, done: rows.length < limit };
  },
};
