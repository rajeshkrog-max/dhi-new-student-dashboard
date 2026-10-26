// A development only helper for the browser proof of the Brain report (spec house/0020). The report reads a student's stored daily values, and a fresh
// made up student has none, so this writes the hand made days of brainFixtures.ts for them, as if the rollup had stored them. It refuses to run where
// the test sign in is off (production). Scenarios: `heavy` (a heavy fortnight: the first chain, the expression note and the support offer), `steady`
// (a steady month: the supporting pattern and rising lamps) and `packaged` (the meals chain, which shows only when that chain is switched on).
//   npx convex run brainProof:seed '{"email":"someone@example.test","scenario":"heavy"}'
import { v } from "convex/values";
import { env, internalMutation } from "./_generated/server";
import { isScenario, scenarioRows } from "./brainFixtures";
import { todayOf } from "./dayRules";
import { fail } from "./helpers";
import { METRIC_VERSION } from "./metricRules";

export const seed = internalMutation({
  args: { email: v.string(), scenario: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    if (!isScenario(args.scenario)) fail("bad_scenario");
    const member = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase())).first();
    if (!member || member.role !== "student" || !member.instituteId) fail("not_found");
    const now = Date.now();
    for (const old of await ctx.db.query("brainDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", member._id)).take(200)) await ctx.db.delete(old._id);
    for (const hide of await ctx.db.query("brainHides").withIndex("by_memberId_and_patternId", (q) => q.eq("memberId", member._id)).take(20)) await ctx.db.delete(hide._id);
    const rows = scenarioRows(args.scenario, todayOf(now));
    for (const row of rows) {
      await ctx.db.insert("brainDays", {
        memberId: member._id,
        instituteId: member.instituteId,
        day: row.day,
        values: row.v as Record<string, { num: number; den: number }>,
        version: METRIC_VERSION,
        computedAt: now,
      });
    }
    return rows.length;
  },
});
