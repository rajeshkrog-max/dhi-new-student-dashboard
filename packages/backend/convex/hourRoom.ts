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
  // After the seats, pages of the student's own chat messages (cursor `m:` and the creation time of the last message sent), until the 30 day sweep
  // deletes them.
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    // Last, the study hour recordings a teacher or DHI shared with the student (house spec 0027): the day of the hour, never the recording itself.
    if (cursor === "s:") {
      const shares = await ctx.db.query("hourShares").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(200);
      const rows = [];
      for (const s of shares) {
        const hour = await ctx.db.get(s.hourId);
        rows.push({ sharedRecordingOfDay: hour ? dayOf(hour.opensAt) : "", sharedOn: dayOf(s.at) });
      }
      return { rows, next: null };
    }
    if (cursor !== null && cursor.startsWith("m:")) {
      const after = Number(cursor.slice(2));
      if (Number.isNaN(after)) return { rows: [], next: null };
      const messages = await ctx.db
        .query("chatMessages")
        .withIndex("by_authorMemberId", (q) => q.eq("authorMemberId", memberId).gt("_creationTime", after))
        .take(limit + 1);
      const page = messages.slice(0, limit);
      const shared = (await ctx.db.query("hourShares").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).first()) ? "s:" : null;
      return {
        rows: page.map((m) => ({ message: m.text, day: dayOf(m.createdAt), status: m.status })),
        next: messages.length > limit ? `m:${page[page.length - 1]._creationTime}` : shared,
      };
    }
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
      next:
        rows.length > limit
          ? String(page[page.length - 1]._creationTime)
          : (await ctx.db.query("chatMessages").withIndex("by_authorMemberId", (q) => q.eq("authorMemberId", memberId)).first())
            ? "m:0"
            : (await ctx.db.query("hourShares").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).first())
              ? "s:"
              : null,
    };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const seats = await ctx.db.query("seats").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const s of seats) await ctx.db.delete(s._id);
    const messages = await ctx.db.query("chatMessages").withIndex("by_authorMemberId", (q) => q.eq("authorMemberId", memberId)).take(limit);
    for (const m of messages) await ctx.db.delete(m._id);
    // The study hour recordings shared with this student (house spec 0027).
    const shares = await ctx.db.query("hourShares").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const s of shares) await ctx.db.delete(s._id);
    return { deleted: seats.length + messages.length + shares.length, done: seats.length < limit && messages.length < limit && shares.length < limit };
  },
};
