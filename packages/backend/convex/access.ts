// A student's own access record (spec house/0005, AC-11): who looked at their personal data. Each row shows the role and the India date, never a
// name and never a time of day. A view by the DHI team shows as "DHI team". 25 a page, newest first. Only the student reads their own record.
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "./_generated/server";
import { dayOf } from "./dayRules";
import { fail } from "./helpers";
import { requireMemberAllowLocked } from "./houseAuth";
import { PAGE_SIZE } from "./houseCore";

export const ROLE_SHOWN: Readonly<Record<string, string>> = {
  teacher: "Teacher",
  institute_admin: "Institute",
  counselor: "Counselor",
  dhi_admin: "DHI team",
  team: "DHI team",
  student: "You",
};

export const mine = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.object({ role: v.string(), day: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMemberAllowLocked(ctx);
    if (mc.role !== "student") fail("forbidden");
    const opts = { ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems, PAGE_SIZE) };
    const memberId = mc.member._id;
    const page = await ctx.db
      .query("viewLog")
      .withIndex("by_targetMemberId_and_at", (q) => q.eq("targetMemberId", memberId))
      .order("desc")
      .paginate(opts);
    return { ...page, page: page.page.map((r) => ({ role: ROLE_SHOWN[r.viewerRole] ?? "DHI team", day: dayOf(r.at) })) };
  },
});
