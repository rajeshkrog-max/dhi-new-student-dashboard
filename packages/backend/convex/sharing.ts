// What a student's parent may see (spec house/0005, AC-9). Only the student changes it, and the default is `none`: no row means none. Each change
// writes one access log row. A parent has no account: the weekly page (spec house/0022) is read through the student's own private link
// (parentLink.ts, parentReport.ts), and turning the setting to `none` deletes that link.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fail } from "./helpers";
import { logAccess, requireMemberAllowLocked } from "./houseAuth";
import { dropLinks } from "./parentLinkCore";
import { rateLimiter } from "./limits";

const level = v.union(v.literal("none"), v.literal("summary"));

// A locked student can still read and change this (AC-6): it is their own choice about their own data.
export const get = query({
  args: {},
  returns: v.object({ parentLevel: level }),
  handler: async (ctx) => {
    const mc = await requireMemberAllowLocked(ctx);
    if (mc.role !== "student") fail("forbidden");
    const row = await ctx.db.query("sharingSettings").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).first();
    return { parentLevel: row?.parentLevel ?? ("none" as const) };
  },
});

export const set = mutation({
  args: { parentLevel: level },
  returns: v.object({ parentLevel: level }),
  handler: async (ctx, args) => {
    const mc = await requireMemberAllowLocked(ctx);
    if (mc.role !== "student") fail("forbidden");
    const row = await ctx.db.query("sharingSettings").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).first();
    // Setting the value it already has changes nothing and writes no record.
    if ((row?.parentLevel ?? "none") !== args.parentLevel) {
      const limit = await rateLimiter.limit(ctx, "sharingChange", { key: mc.member._id, throws: false });
      if (!limit.ok) fail("rate_limited");
      if (row) await ctx.db.patch(row._id, { parentLevel: args.parentLevel, at: Date.now() });
      else await ctx.db.insert("sharingSettings", { memberId: mc.member._id, parentLevel: args.parentLevel, at: Date.now() });
      await logAccess(ctx, { actor: mc.member._id, action: "sharing.set", instituteId: mc.member.instituteId, targetMemberId: mc.member._id });
      // Turning sharing off ends the parent's link at once (spec house/0022).
      if (args.parentLevel === "none") await dropLinks(ctx, mc.member);
    }
    return { parentLevel: args.parentLevel };
  },
});
