// The weekly parent page (spec house/0022): the only function a parent reaches, with no sign in. They hold the student's private link, which carries a
// secret code; the code finds the student, and everything below runs for that student alone. A parent sees something only when `canView` says
// `summary` for the Brain, which needs the student's sharing setting to be on, the link to be live and the student to be in good standing. Every refusal
// reads the same (`gone`), so a wrong, expired, removed or switched off link tells a stranger nothing. A look is written to the student's own record
// (viewLog, role `parent`) at most once an hour. This is a mutation because a query cannot write the look or spend the call limit.
//
// The page is built by `weekOf` (parentRules.ts) from the student's days; it never holds a mood value, a note, a pattern or the support offer.
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { canView } from "./accessRules";
import { windowRows } from "./brainDay";
import { LAMP_WINDOW } from "./brainRules";
import { todayOf } from "./dayRules";
import { rateLimiter } from "./limits";
import { CODE_RE, LOOK_LOG_GAP_MS, hashCode } from "./parentLinkCore";
import { weekOf } from "./parentRules";
import { standingOf } from "./staffRead";

const refusal = v.object({ ok: v.literal(false), code: v.string() });
const week = v.object({
  from: v.string(),
  to: v.string(),
  enough: v.boolean(),
  rooms: v.array(v.object({ room: v.string(), days: v.number() })),
  lamps: v.array(v.object({ lamp: v.string(), value: v.union(v.number(), v.null()) })),
});

export const open = mutation({
  args: { code: v.string() },
  returns: v.union(v.object({ ok: v.literal(true), firstName: v.string(), expiresAt: v.number(), week }), refusal),
  handler: async (ctx, args) => {
    // One shared bucket for every wrong code, so a flood of made up ones is cheap to refuse and creates no key per code.
    const gone = async () => ((await rateLimiter.limit(ctx, "parentBad", { key: "bad", throws: false })).ok ? { ok: false as const, code: "gone" } : { ok: false as const, code: "slow_down" });
    if (!CODE_RE.test(args.code)) return await gone();
    const codeHash = await hashCode(args.code);
    const link = await ctx.db.query("parentLinks").withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash)).unique();
    const now = Date.now();
    if (!link || link.expiresAt <= now) return await gone();
    if (!(await rateLimiter.limit(ctx, "parentOpen", { key: link._id, throws: false })).ok) return { ok: false as const, code: "slow_down" };

    const member = await ctx.db.get(link.memberId);
    if (!member || member.role !== "student") return await gone();
    const setting = await ctx.db.query("sharingSettings").withIndex("by_memberId", (q) => q.eq("memberId", member._id)).first();
    // While the student's class is paused the page reads as gone, and it opens again by itself on resume (owner, 2026-10-26). Staff views carry
    // on through a pause (house spec 0021), so this is the parent page's own rule and `standingOf` is unchanged.
    const cls = member.classId ? await ctx.db.get(member.classId) : null;
    // Answered plainly, not through `gone`, so the refreshes of a paused class's parents never use the allowance kept for wrong codes.
    if (cls?.pausedAt !== undefined && cls !== null) return { ok: false as const, code: "gone" };
    const standing = await standingOf(ctx, member);
    if (canView("parent", "none", "brain", { standing, parentLevel: setting?.parentLevel ?? "none" }) !== "summary") return await gone();

    if (link.lastLoggedAt === undefined || now - link.lastLoggedAt >= LOOK_LOG_GAP_MS) {
      await ctx.db.insert("viewLog", { viewerRole: "parent", targetMemberId: member._id, instituteId: member.instituteId, kind: "brain", at: now });
      await ctx.db.patch(link._id, { lastLoggedAt: now });
    }
    const rows = await windowRows(ctx, member, now, LAMP_WINDOW);
    // The first word of the name only, so a parent with two children can tell the pages apart.
    return { ok: true as const, firstName: member.name.trim().split(/\s+/)[0] ?? "", expiresAt: link.expiresAt, week: weekOf(rows, todayOf(now)) };
  },
});
