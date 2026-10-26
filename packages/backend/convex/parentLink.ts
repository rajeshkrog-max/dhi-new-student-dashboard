// The student's side of the weekly parent page (spec house/0022): make or renew the one private link, see whether it is live, remove it. A parent has no
// account and DHI sends nothing: the student copies the link and gives it to their parent themselves. Turning sharing off (sharing.set) also removes it.
// Every function starts with `requireMember`, so the consent gate applies; the code is returned once and only its hash is kept.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail } from "./helpers";
import { logAccess, requireMember } from "./houseAuth";
import { rateLimiter } from "./limits";
import { LINK_MS, deleteLinks, dropLinks, hashCode, newCode } from "./parentLinkCore";

const refusal = v.object({ ok: v.literal(false), code: v.string() });

export const mine = query({
  args: {},
  returns: v.union(v.object({ expiresAt: v.number() }), v.null()),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const link = await ctx.db.query("parentLinks").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).first();
    // An expired link is gone to the student too; the daily sweep deletes the row.
    return link && link.expiresAt > Date.now() ? { expiresAt: link.expiresAt } : null;
  },
});

// Makes the link, or replaces it with a new one (the old address stops working). Only while sharing is on. The code is in this answer and nowhere else.
export const make = mutation({
  args: {},
  returns: v.union(v.object({ ok: v.literal(true), code: v.string(), expiresAt: v.number() }), refusal),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "parentMake", { key: mc.member._id, throws: false })).ok) return { ok: false as const, code: "slow_down" };
    const setting = await ctx.db.query("sharingSettings").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).first();
    if (setting?.parentLevel !== "summary") return { ok: false as const, code: "sharing_off" };
    await deleteLinks(ctx, mc.member._id);
    const code = newCode();
    const now = Date.now();
    const expiresAt = now + LINK_MS;
    await ctx.db.insert("parentLinks", { memberId: mc.member._id, instituteId: mc.member.instituteId, codeHash: await hashCode(code), createdAt: now, expiresAt });
    await logAccess(ctx, { actor: mc.member._id, action: "sharing.link", instituteId: mc.member.instituteId, targetMemberId: mc.member._id });
    return { ok: true as const, code, expiresAt };
  },
});

export const remove = mutation({
  args: {},
  returns: v.object({ removed: v.boolean() }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    return { removed: await dropLinks(ctx, mc.member) };
  },
});
