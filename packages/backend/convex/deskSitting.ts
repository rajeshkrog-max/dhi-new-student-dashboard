// The desk's after session card (spec house/0018, desk part). A sitting is a run of the student's questions with no gap over 15 minutes. `touchSitting`
// (called by `desk.begin` whenever a question is stored) starts or extends it; the minute job `closeSittings` ends the ones idle for 15 minutes and marks
// each `pending` (10 minutes or more from the first question to the last) or `none`. The student is offered one card for 24 hours: how they felt, their
// focus from 1 to 5, and optionally a subject. An answer writes one `desk.felt` event of fixed codes; a skip is stored as skipped, changes no value and
// writes no event. Every public function starts with `requireMember`, and another student's sitting is never found.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx } from "./_generated/server";
import { recordEvent, recordSystemEvent } from "./eventLog";
import { fail } from "./helpers";
import { requireMember } from "./houseAuth";
import { isActiveKind } from "./deskRules";
import { DESK_GAP_MS, OFFER_WINDOW_MS, asksForCard, isFeel, isFocus, isSubject, lengthBandOf, timeBandOf } from "./sessionRules";
import { isClassTopic } from "./topics";

const refused = v.object({ ok: v.literal(false), code: v.string() });
const minutesOf = (s: Pick<Doc<"deskSittings">, "startedAt" | "lastAt">) => Math.floor((s.lastAt - s.startedAt) / 60000);

// Starts a sitting, or extends the open one when the gap since the last question is 15 minutes or less.
export async function touchSitting(ctx: MutationCtx, member: Doc<"members">, now: number, kind: string): Promise<void> {
  const active = isActiveKind(kind) ? 1 : 0;
  const last = await ctx.db.query("deskSittings").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", member._id)).order("desc").first();
  if (last && last.feedbackStatus === undefined && now - last.lastAt <= DESK_GAP_MS) {
    await ctx.db.patch(last._id, { lastAt: now, turns: (last.turns ?? 0) + 1, activeTurns: (last.activeTurns ?? 0) + active });
    return;
  }
  await ctx.db.insert("deskSittings", {
    memberId: member._id,
    instituteId: member.instituteId as NonNullable<typeof member.instituteId>,
    startedAt: now,
    lastAt: now,
    turns: 1,
    activeTurns: active,
  });
}

// The minute job: a sitting idle for more than 15 minutes has ended.
// Whether `closeSittings` has a sitting to end (the minute tick, minuteTick.ts).
export async function closeSittingsHasWork(ctx: MutationCtx, now: number): Promise<boolean> {
  return (await ctx.db.query("deskSittings").withIndex("by_feedbackStatus_and_lastAt", (q) => q.eq("feedbackStatus", undefined).lt("lastAt", now - DESK_GAP_MS)).first()) !== null;
}

export const closeSittings = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - DESK_GAP_MS;
    const idle = await ctx.db
      .query("deskSittings")
      .withIndex("by_feedbackStatus_and_lastAt", (q) => q.eq("feedbackStatus", undefined).lt("lastAt", cutoff))
      .take(100);
    for (const s of idle) {
      const minutes = minutesOf(s);
      await ctx.db.patch(s._id, { feedbackStatus: asksForCard("desk", minutes) ? "pending" : "none" });
      // What the sitting was reaches the Brain as system events, plain measures that feed no lamp: how many questions and how many of them were an active
      // learning kind (A10, A12), and the whole minutes (X02, none for a sitting under a minute).
      try {
        const turns = s.turns ?? 0;
        if (turns >= 1) {
          await recordSystemEvent(ctx, { memberId: s.memberId, room: "desk", type: "desk.mode", payload: { turns: Math.min(turns, 100), active: Math.min(s.activeTurns ?? 0, 100) }, occurredAt: s.lastAt, eventKey: `desk:${s._id}-1`, about: `desk:${s._id}` });
        }
        if (minutes >= 1) {
          await recordSystemEvent(ctx, { memberId: s.memberId, room: "desk", type: "desk.present", payload: { minutes: Math.min(minutes, 480) }, occurredAt: s.lastAt, eventKey: `desk:${s._id}-0`, about: `desk:${s._id}` });
        }
      } catch {
        // The sitting has ended whatever the log says; the events of a student who withdrew are not recorded.
      }
    }
    return idle.length;
  },
});

// The card to offer: the newest pending sitting that ended in the last 24 hours, or null.
export const pending = query({
  args: {},
  returns: v.union(v.object({ sittingId: v.id("deskSittings"), minutes: v.number() }), v.null()),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const now = Date.now();
    const rows = await ctx.db.query("deskSittings").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", mc.member._id)).order("desc").take(10);
    const s = rows.find((x) => x.feedbackStatus === "pending" && now - x.lastAt < OFFER_WINDOW_MS);
    return s ? { sittingId: s._id, minutes: minutesOf(s) } : null;
  },
});

// Answers the card. Once only; the feeling and the focus must be real values, and the subject, if given, one of the fixed list. A topic (house spec
// 0028) needs the subject and must be one of that subject's topics sent to the student's own class.
export const answer = mutation({
  args: { sittingId: v.id("deskSittings"), feel: v.string(), focus: v.number(), subject: v.optional(v.string()), topicId: v.optional(v.id("paperTopics")) },
  returns: v.union(v.object({ ok: v.literal(true) }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const s = await ctx.db.get(args.sittingId);
    if (!s || s.memberId !== mc.member._id) fail("not_found");
    if (s.feedbackStatus !== "pending") return { ok: false as const, code: "not_pending" };
    if (Date.now() - s.lastAt >= OFFER_WINDOW_MS) return { ok: false as const, code: "expired" };
    if (!isFeel(args.feel)) return { ok: false as const, code: "bad_feel" };
    if (!isFocus(args.focus)) return { ok: false as const, code: "bad_focus" };
    if (args.subject !== undefined && !isSubject(args.subject)) return { ok: false as const, code: "bad_subject" };
    if (args.topicId !== undefined && (args.subject === undefined || !(await isClassTopic(ctx, mc.member.classId, args.topicId, args.subject)))) {
      return { ok: false as const, code: "bad_topic" };
    }
    await recordEvent(ctx, {
      by: mc,
      memberId: mc.member._id,
      room: "desk",
      type: "desk.felt",
      payload: {
        feel: args.feel,
        focus: args.focus,
        time: timeBandOf(s.startedAt),
        length: lengthBandOf(minutesOf(s)),
        ...(args.subject !== undefined ? { subject: args.subject } : {}),
        ...(args.topicId !== undefined ? { topic: args.topicId } : {}),
      },
      occurredAt: s.lastAt,
      eventKey: `deskfelt:${s._id}-0`,
      about: `deskfelt:${s._id}`,
    });
    await ctx.db.patch(s._id, {
      feedbackStatus: "answered",
      feel: args.feel,
      focus: args.focus,
      ...(args.subject !== undefined ? { subject: args.subject } : {}),
      ...(args.topicId !== undefined ? { topicId: args.topicId } : {}),
    });
    return { ok: true as const };
  },
});

// Skips the card. It is stored as skipped and changes no value; no event is written.
export const skip = mutation({
  args: { sittingId: v.id("deskSittings") },
  returns: v.union(v.object({ ok: v.literal(true) }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const s = await ctx.db.get(args.sittingId);
    if (!s || s.memberId !== mc.member._id) fail("not_found");
    if (s.feedbackStatus !== "pending") return { ok: false as const, code: "not_pending" };
    await ctx.db.patch(s._id, { feedbackStatus: "skipped" });
    return { ok: true as const };
  },
});
