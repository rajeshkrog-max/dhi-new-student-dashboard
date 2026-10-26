// The link between a student's house account and their DhiRise funnel check (house spec 0002 follow up; owner, 2026-10-24: link and download only). The
// two products already share one sign in, so the funnel's `students` row is found by `authUserId` and never by email. The student's own tap records the
// link (`funnelLinks`, a date and nothing from the check). While it exists, "Download my data" also holds the student's own answers to the check. The
// funnel's saved results and guardian consent records are never touched here: the house erase leaves the funnel profile alone, so a student asks for the
// funnel part to be erased separately. No flag, score or result is ever read by this file.
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { fail } from "./helpers";
import { requireMember } from "./houseAuth";
import { rateLimiter } from "./limits";

const refused = v.object({ ok: v.literal(false), code: v.string() });

const profileOf = (ctx: Pick<QueryCtx, "db">, authUserId: string) =>
  ctx.db.query("students").withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId)).first();
const linkOf = (ctx: Pick<QueryCtx, "db">, memberId: Doc<"members">["_id"]) =>
  ctx.db.query("funnelLinks").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).first();

// Whether this account took the funnel's check, and when the student linked it.
export const status = query({
  args: {},
  returns: v.object({ hasProfile: v.boolean(), linkedAt: v.union(v.number(), v.null()) }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const profile = await profileOf(ctx, mc.member.authUserId);
    const link = await linkOf(ctx, mc.member._id);
    return { hasProfile: profile !== null, linkedAt: link?.linkedAt ?? null };
  },
});

// The student's own tap. Linking twice is harmless. An under 18 student gets here only through `requireMember`, which already needs the school's parent
// record, so the guardian consent is in place before the link can be made.
export const link = mutation({
  args: {},
  returns: v.union(v.object({ ok: v.literal(true), linkedAt: v.number() }), refused),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const limit = await rateLimiter.limit(ctx, "funnelLink", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    const existing = await linkOf(ctx, mc.member._id);
    if (existing) return { ok: true as const, linkedAt: existing.linkedAt };
    if (!(await profileOf(ctx, mc.member.authUserId))) return { ok: false as const, code: "no_profile" };
    const linkedAt = Date.now();
    await ctx.db.insert("funnelLinks", { memberId: mc.member._id, instituteId: mc.member.instituteId, linkedAt });
    return { ok: true as const, linkedAt };
  },
});

// The student takes the link back. The funnel is untouched.
export const unlink = mutation({
  args: {},
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const existing = await linkOf(ctx, mc.member._id);
    if (existing) await ctx.db.delete("funnelLinks", existing._id);
    return { ok: true as const };
  },
});

// What "Download my data" adds for a linked student: the profile fields they gave the funnel and their own answers to the check (a question number, the
// option they picked and when). Never a result, a score or a flag. Null when the student has not linked. A server helper, not a Convex function.
export async function funnelExport(ctx: Pick<QueryCtx, "db">, member: Doc<"members">) {
  const existing = await linkOf(ctx, member._id);
  if (!existing) return null;
  const profile = await profileOf(ctx, member.authUserId);
  if (!profile) return { linkedAt: existing.linkedAt, profile: null, checks: [] };
  const checks = await ctx.db.query("checks").withIndex("by_studentId", (q) => q.eq("studentId", profile._id)).take(5);
  const out = [];
  for (const c of checks) {
    const answers = await ctx.db.query("answers").withIndex("by_checkId_and_q", (q) => q.eq("checkId", c._id)).take(40);
    out.push({ completedAt: c.completedAt ?? null, answers: answers.map((a) => ({ q: a.q, optionId: a.optionId, answeredAt: a.answeredAt })) });
  }
  return { linkedAt: existing.linkedAt, profile: { name: profile.name, age: profile.age, class: profile.class }, checks: out };
}
