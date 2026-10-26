// The after session feeling card (spec house/0018). When a study hour stay of 20 minutes or more ends, the seat is marked pending and the student
// is offered one card: how they felt (energised, okay, drained) and their focus from 1 to 5. It can be skipped; a skip is stored as skipped, changes
// no value and writes no event. An answer writes one `hour.felt` event (fixed codes and one small number, with the time and length bands of the
// stay). A card is offered for 24 hours, and a seat of another student is never found. Every function starts with `requireMember`.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { recordEvent } from "./eventLog";
import { fail } from "./helpers";
import { requireMember } from "./houseAuth";
import { minutesPresent } from "./hourRules";
import { OFFER_WINDOW_MS, isFeel, isFocus, lengthBandOf, timeBandOf } from "./sessionRules";

const refused = v.object({ ok: v.literal(false), code: v.string() });

// The card to offer: the newest pending seat of the student that ended in the last 24 hours, or null.
export const pending = query({
  args: {},
  returns: v.union(v.object({ seatId: v.id("seats"), source: v.string(), minutes: v.number() }), v.null()),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const now = Date.now();
    const seats = await ctx.db.query("seats").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).order("desc").take(10);
    const seat = seats.find((s) => s.feedbackStatus === "pending" && s.leftAt !== undefined && now - s.leftAt < OFFER_WINDOW_MS);
    return seat && seat.leftAt !== undefined ? { seatId: seat._id, source: "hour", minutes: minutesPresent(seat.enteredAt, seat.leftAt) } : null;
  },
});

// Answers the card. Once only; the feeling and the focus must be real values.
export const answer = mutation({
  args: { seatId: v.id("seats"), feel: v.string(), focus: v.number() },
  returns: v.union(v.object({ ok: v.literal(true) }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const seat = await ctx.db.get(args.seatId);
    if (!seat || seat.memberId !== mc.member._id) fail("not_found");
    if (seat.feedbackStatus !== "pending" || seat.leftAt === undefined) return { ok: false as const, code: "not_pending" };
    if (Date.now() - seat.leftAt >= OFFER_WINDOW_MS) return { ok: false as const, code: "expired" };
    if (!isFeel(args.feel)) return { ok: false as const, code: "bad_feel" };
    if (!isFocus(args.focus)) return { ok: false as const, code: "bad_focus" };
    const minutes = minutesPresent(seat.enteredAt, seat.leftAt);
    await recordEvent(ctx, {
      by: mc,
      memberId: mc.member._id,
      room: "hour",
      type: "hour.felt",
      payload: { feel: args.feel, focus: args.focus, time: timeBandOf(seat.enteredAt), length: lengthBandOf(minutes) },
      occurredAt: seat.leftAt,
      eventKey: `felt:${seat._id}-0`,
      about: `felt:${seat._id}`,
    });
    await ctx.db.patch(seat._id, { feedbackStatus: "answered", feel: args.feel, focus: args.focus });
    return { ok: true as const };
  },
});

// Skips the card. It is stored as skipped and changes no value; no event is written.
export const skip = mutation({
  args: { seatId: v.id("seats") },
  returns: v.union(v.object({ ok: v.literal(true) }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const seat = await ctx.db.get(args.seatId);
    if (!seat || seat.memberId !== mc.member._id) fail("not_found");
    if (seat.feedbackStatus !== "pending") return { ok: false as const, code: "not_pending" };
    await ctx.db.patch(seat._id, { feedbackStatus: "skipped" });
    return { ok: true as const };
  },
});
