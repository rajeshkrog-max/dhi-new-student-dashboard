// Counseling's hooks into export and erase (spec house/0024; spec house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This file registers no
// Convex function. The export is the student's bookings: the time, the counselor's first name, the status, their own note and the counselor's
// summary (the recording stays on Stream). The erase deletes the shares and the bookings, opens a future slot again, and schedules the deletion of
// the sessions' recordings and transcripts on Stream (counselCall.forget).
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { firstName } from "./counselRules";
import type { RoomEntry } from "./roomRegistry";

export const counselRoom: RoomEntry = {
  room: "counsel",
  table: "counselBookings", // and "counselShares": both are in the data map, and the eraser clears both
  kinds: ["counsel"],
  // The cursor is the start time of the last booking sent, read with `gt` on the index, oldest first.
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    const after = cursor === null ? null : Number(cursor);
    if (after !== null && Number.isNaN(after)) return { rows: [], next: null };
    const rows = await ctx.db
      .query("counselBookings")
      .withIndex("by_memberId_and_startsAt", (q) => (after === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("startsAt", after)))
      .take(limit + 1);
    const page = rows.slice(0, limit);
    const out = [];
    for (const b of page) {
      const counselor = firstName((await ctx.db.get(b.counselorMemberId))?.name ?? "");
      out.push({ startsAt: b.startsAt, counselor, status: b.status, note: b.note ?? "", summary: b.summary ?? "", recordedOnStream: true });
    }
    return { rows: out, next: rows.length > limit ? String(page[page.length - 1].startsAt) : null };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const bookings = await ctx.db.query("counselBookings").withIndex("by_memberId_and_startsAt", (q) => q.eq("memberId", memberId)).take(limit);
    const now = Date.now();
    for (const b of bookings) {
      for (const s of await ctx.db.query("counselShares").withIndex("by_bookingId", (q) => q.eq("bookingId", b._id)).take(50)) await ctx.db.delete(s._id);
      if (b.status === "booked" && b.startsAt > now) await ctx.db.patch(b.slotId, { status: "open" });
      await ctx.db.delete(b._id);
    }
    if (bookings.length > 0) await ctx.scheduler.runAfter(0, internal.counselCall.forget, { bookingIds: bookings.map((b) => b._id as string) });
    return { deleted: bookings.length, done: bookings.length < limit };
  },
};
