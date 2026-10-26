// The study hour's hooks into export and erase (spec house/0015 and house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This file
// registers no Convex function. A page of the student's seats for their download (the day, the mode and the whole minutes present), and a page of
// their seats and chat messages deleted for the erase. DHI's hours are its own clock and are never deleted.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { dayOf } from "./dayRules";
import { minutesPresent } from "./hourRules";
import type { RoomEntry } from "./roomRegistry";

export const hourRoom: RoomEntry = {
  room: "hour",
  table: "seats",
  kinds: ["hour"],
  // The cursor is the creation time of the last seat sent, read with `gt` on the index, oldest first.
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    const rows = await ctx.db
      .query("seats")
      .withIndex("by_memberId", (q) => (cursor === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("_creationTime", Number(cursor))))
      .take(limit + 1);
    const page = rows.slice(0, limit);
    return {
      rows: page.map((r) => ({
        day: dayOf(r.enteredAt),
        mode: r.mode,
        minutes: r.leftAt === undefined ? 0 : minutesPresent(r.enteredAt, r.leftAt),
        card: r.feedbackStatus ?? "none",
        feel: r.feel ?? "",
        focus: r.focus ?? 0,
      })),
      next: rows.length > limit ? String(page[page.length - 1]._creationTime) : null,
    };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const seats = await ctx.db.query("seats").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const s of seats) await ctx.db.delete(s._id);
    const messages = await ctx.db.query("chatMessages").withIndex("by_authorMemberId", (q) => q.eq("authorMemberId", memberId)).take(limit);
    for (const m of messages) await ctx.db.delete(m._id);
    return { deleted: seats.length + messages.length, done: seats.length < limit && messages.length < limit };
  },
};
