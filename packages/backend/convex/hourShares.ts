// The study hour call's access, recordings list and shares (house spec 0027; the owner's answers of 2026-10-28). Camera and voice, recorded on
// Stream. A student joins only from a Live seat in the hour open now, and only their own institute's call. A teacher of the institute, or a DHI
// admin naming an institute, joins to moderate. Every recording may be watched by that institute's teachers and by a DHI admin at any time, and
// either may share one with a student of that institute who asks; each watch by staff is written in the "Who has looked" of every student seated in
// that hour. The talking to Stream is in hourCall.ts. Every function starts with `requireMember`.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { firstName } from "./counselRules";
import { fail } from "./helpers";
import { RECORDING_KEEP_DAYS, SHARES_MAX } from "./hourCallRules";
import { seatIsCurrent } from "./hourRules";
import { requireMember, type MemberContext } from "./houseAuth";
import { rateLimiter } from "./limits";
import { recordGroupLook } from "./staffRead";

const DAY_MS = 24 * 60 * 60 * 1000;
const refused = v.object({ ok: v.literal(false), code: v.string() });
const ok = v.object({ ok: v.literal(true) });

async function openHour(ctx: QueryCtx, now: number): Promise<Doc<"studyHours"> | null> {
  const recent = await ctx.db.query("studyHours").withIndex("by_opensAt", (q) => q.lte("opensAt", now)).order("desc").take(3);
  return recent.find((h) => now < h.closesAt) ?? null;
}

// The institute a staff member acts for: a teacher's own, or the one a DHI admin names. Anyone else, or a teacher naming another institute, is refused.
function staffInstitute(mc: MemberContext, named: Id<"institutes"> | undefined): Id<"institutes"> | null {
  if (mc.role === "teacher" && mc.member.instituteId !== undefined && (named === undefined || named === mc.member.instituteId)) return mc.member.instituteId;
  if (mc.role === "dhi_admin" && named !== undefined) return named;
  return null;
}

const person = v.object({ id: v.string(), name: v.string() });

// Who the signed in person is to the call of the hour open now: a student in a Live seat joins their institute's call as a member; a teacher or a
// DHI admin joins as a moderator. Read with the caller's own identity, by hourCall.joinHourCall.
export const joinAccess = internalQuery({
  args: { now: v.number(), instituteId: v.optional(v.id("institutes")) },
  returns: v.union(refused, v.object({ ok: v.literal(true), me: person, role: v.union(v.literal("call_member"), v.literal("moderator")), hourId: v.id("studyHours"), instituteId: v.id("institutes"), closesAt: v.number() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    const hour = await openHour(ctx, args.now);
    if (!hour) return { ok: false as const, code: "not_open" };
    const me = { id: mc.member._id as string, name: firstName(mc.member.name) };
    if (mc.role === "student") {
      const seat = await ctx.db.query("seats").withIndex("by_memberId_and_hourId", (q) => q.eq("memberId", mc.member._id).eq("hourId", hour._id)).order("desc").first();
      if (!seat || seat.leftAt !== undefined || !seatIsCurrent(seat, hour, args.now) || seat.mode !== "live") return { ok: false as const, code: "not_live" };
      return { ok: true as const, me, role: "call_member" as const, hourId: hour._id, instituteId: seat.instituteId, closesAt: hour.closesAt };
    }
    const instituteId = staffInstitute(mc, args.instituteId);
    if (!instituteId) return { ok: false as const, code: "forbidden" };
    return { ok: true as const, me: { id: me.id, name: mc.member.name }, role: "moderator" as const, hourId: hour._id, instituteId, closesAt: hour.closesAt };
  },
});

// Whether the signed in person may open the recordings of one hour and institute: that institute's teacher, a DHI admin, or a student it was shared
// with. `staff` tells hourCall.recordings to write the look for the students seated in that hour.
export const watchAccess = internalQuery({
  args: { hourId: v.id("studyHours"), instituteId: v.id("institutes") },
  returns: v.union(refused, v.object({ ok: v.literal(true), viewerId: v.id("members"), viewerRole: v.string(), staff: v.boolean() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (staffInstitute(mc, args.instituteId) === args.instituteId) return { ok: true as const, viewerId: mc.member._id, viewerRole: mc.role, staff: true };
    if (mc.role === "student") {
      const shares = await ctx.db.query("hourShares").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).take(200);
      if (shares.some((s) => s.hourId === args.hourId && s.instituteId === args.instituteId)) return { ok: true as const, viewerId: mc.member._id, viewerRole: mc.role, staff: false };
    }
    return { ok: false as const, code: "not_found" };
  },
});

// A staff look at an hour's recording, written in the "Who has looked" of each student seated in that hour (kind `hour`).
export const recordWatch = internalMutation({
  args: { hourId: v.id("studyHours"), instituteId: v.id("institutes"), viewerId: v.id("members"), viewerRole: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const role = args.viewerRole === "teacher" || args.viewerRole === "dhi_admin" ? args.viewerRole : null;
    if (!role) return 0;
    const seats = await ctx.db.query("seats").withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", args.hourId).eq("instituteId", args.instituteId)).take(1000);
    return await recordGroupLook(ctx, { viewerId: args.viewerId, viewerRole: role, instituteId: args.instituteId, kind: "hour", targetMemberIds: seats.map((s) => s.memberId) });
  },
});

async function staffFor(ctx: MutationCtx | QueryCtx, instituteId: Id<"institutes"> | undefined): Promise<{ mc: MemberContext; instituteId: Id<"institutes"> }> {
  const mc = await requireMember(ctx);
  const id = staffInstitute(mc, instituteId);
  if (!id) fail("forbidden");
  return { mc, instituteId: id };
}

// The hours of the last 30 days in which this institute had anyone seated, newest first, each with the students its recording is shared with. For
// a teacher of the institute or a DHI admin naming it.
export const recordedHours = query({
  args: { instituteId: v.optional(v.id("institutes")), now: v.number() },
  returns: v.array(
    v.object({
      hourId: v.id("studyHours"),
      instituteId: v.id("institutes"),
      opensAt: v.number(),
      closesAt: v.number(),
      seated: v.number(),
      shares: v.array(v.object({ name: v.string(), email: v.string() })),
    }),
  ),
  handler: async (ctx, args) => {
    const { instituteId } = await staffFor(ctx, args.instituteId);
    const hours = await ctx.db
      .query("studyHours")
      .withIndex("by_opensAt", (q) => q.gte("opensAt", args.now - RECORDING_KEEP_DAYS * DAY_MS).lte("opensAt", args.now))
      .order("desc")
      .take(100);
    const out = [];
    for (const h of hours) {
      const seats = await ctx.db.query("seats").withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", h._id).eq("instituteId", instituteId)).take(1000);
      if (seats.length === 0) continue;
      const shares = [];
      for (const s of await ctx.db.query("hourShares").withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", h._id).eq("instituteId", instituteId)).take(SHARES_MAX)) {
        const m = await ctx.db.get(s.memberId);
        if (m && m.erasedAt === undefined) shares.push({ name: m.name, email: m.email });
      }
      out.push({ hourId: h._id, instituteId, opensAt: h.opensAt, closesAt: h.closesAt, seated: new Set(seats.map((s) => s.memberId)).size, shares });
    }
    return out;
  },
});

// Shares one hour's recording with a student of that institute who asked, by their email. Only that institute's teacher or a DHI admin.
export const share = mutation({
  args: { hourId: v.id("studyHours"), instituteId: v.id("institutes"), email: v.string() },
  returns: v.union(ok, refused),
  handler: async (ctx, args) => {
    const { mc, instituteId } = await staffFor(ctx, args.instituteId);
    if (!(await rateLimiter.limit(ctx, "staffOpen", { key: mc.member._id })).ok) return { ok: false as const, code: "rate_limited" };
    if (!(await ctx.db.get(args.hourId))) return { ok: false as const, code: "not_found" };
    const email = args.email.trim().toLowerCase();
    const who = email ? await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", email)).first() : null;
    if (!who || who.role !== "student" || who.instituteId !== instituteId || who.status !== "active" || who.erasedAt !== undefined) return { ok: false as const, code: "no_such_student" };
    const existing = await ctx.db.query("hourShares").withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", args.hourId).eq("instituteId", instituteId)).take(SHARES_MAX + 1);
    if (existing.some((s) => s.memberId === who._id)) return { ok: true as const };
    if (existing.length >= SHARES_MAX) return { ok: false as const, code: "too_many_shares" };
    await ctx.db.insert("hourShares", { hourId: args.hourId, instituteId, memberId: who._id, sharedBy: mc.member._id, at: Date.now() });
    return { ok: true as const };
  },
});

// Takes a share back.
export const unshare = mutation({
  args: { hourId: v.id("studyHours"), instituteId: v.id("institutes"), email: v.string() },
  returns: ok,
  handler: async (ctx, args) => {
    const { instituteId } = await staffFor(ctx, args.instituteId);
    const who = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.email.trim().toLowerCase())).first();
    for (const s of await ctx.db.query("hourShares").withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", args.hourId).eq("instituteId", instituteId)).take(SHARES_MAX + 1)) {
      if (who && s.memberId === who._id) await ctx.db.delete(s._id);
    }
    return { ok: true as const };
  },
});

// The hour recordings shared with the signed in student, newest first.
export const sharedWithMe = query({
  args: {},
  returns: v.array(v.object({ hourId: v.id("studyHours"), instituteId: v.id("institutes"), opensAt: v.number() })),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") return [];
    const out = [];
    for (const s of await ctx.db.query("hourShares").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).take(50)) {
      const h = await ctx.db.get(s.hourId);
      if (h) out.push({ hourId: s.hourId, instituteId: s.instituteId, opensAt: h.opensAt });
    }
    return out.sort((a, b) => b.opensAt - a.opensAt);
  },
});

// For the daily sweep in hourCall.ts: the call ids of hours that closed between RECORDING_KEEP_DAYS and a week more ago, one per institute seated.
export const oldCalls = internalQuery({
  args: { now: v.number() },
  returns: v.array(v.object({ hourId: v.id("studyHours"), instituteId: v.id("institutes") })),
  handler: async (ctx, args) => {
    const to = args.now - RECORDING_KEEP_DAYS * DAY_MS;
    const hours = await ctx.db.query("studyHours").withIndex("by_opensAt", (q) => q.gte("opensAt", to - 8 * DAY_MS).lte("opensAt", to)).take(100);
    const out = [];
    for (const h of hours) {
      if (h.closesAt > to) continue;
      const institutes = new Set<Id<"institutes">>();
      for (const s of await ctx.db.query("seats").withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", h._id)).take(2000)) institutes.add(s.instituteId);
      for (const instituteId of institutes) out.push({ hourId: h._id, instituteId });
    }
    return out;
  },
});

// The hour open now, for the staff screen's "Join to moderate". Any teacher or DHI admin; times only.
export const openNow = query({
  args: { now: v.number() },
  returns: v.union(v.null(), v.object({ hourId: v.id("studyHours"), opensAt: v.number(), closesAt: v.number() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "teacher" && mc.role !== "dhi_admin") fail("forbidden");
    const h = await openHour(ctx, args.now);
    return h ? { hourId: h._id, opensAt: h.opensAt, closesAt: h.closesAt } : null;
  },
});
