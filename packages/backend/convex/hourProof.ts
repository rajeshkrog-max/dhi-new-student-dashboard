// A development only helper for the browser proof of the study hour (spec house/0015). A DHI admin cannot sign in with the test form, so this
// opens an hour right now for a number of minutes (default 30), and removes any other hours first so they cannot overlap. It refuses to run where
// the test sign in is off (production). Run after `demo:seed` and a sign in of the demo institute admin:
//   npx convex run hourProof:openNow '{"minutes":30}'
import { v } from "convex/values";
import { env, internalMutation } from "./_generated/server";
import { fail } from "./helpers";

export const openNow = internalMutation({
  args: { minutes: v.optional(v.number()) },
  returns: v.id("studyHours"),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const admin = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", "demo-admin@example.test")).first();
    if (!admin) fail("run_demo_seed_and_sign_in_first");
    const now = Date.now();
    const minutes = Math.min(Math.max(args.minutes ?? 30, 6), 480);
    for (const h of await ctx.db.query("studyHours").take(200)) {
      for (const s of await ctx.db.query("seats").withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", h._id)).take(500)) await ctx.db.delete(s._id);
      for (const m of await ctx.db.query("chatMessages").withIndex("by_hourId_and_instituteId", (q) => q.eq("hourId", h._id)).take(500)) await ctx.db.delete(m._id);
      await ctx.db.delete(h._id);
    }
    return await ctx.db.insert("studyHours", { opensAt: now - 60 * 1000, closesAt: now + minutes * 60 * 1000, setBy: admin._id, createdAt: now });
  },
});

// Records a finished stay of a made up student (found by email), as if they had sat 25 minutes and left a minute ago, so the after session card can be
// seen without waiting. Development only, like the helper above:
//   npx convex run hourProof:addFinishedStay '{"email":"someone@example.test","minutes":25}'
export const addFinishedStay = internalMutation({
  args: { email: v.string(), minutes: v.optional(v.number()) },
  returns: v.id("seats"),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const member = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase())).first();
    if (!member || member.role !== "student" || !member.instituteId) fail("not_found");
    const hour = (await ctx.db.query("studyHours").withIndex("by_opensAt").order("desc").take(1))[0];
    if (!hour) fail("open_an_hour_first");
    const minutes = Math.min(Math.max(args.minutes ?? 25, 1), 400);
    const now = Date.now();
    return await ctx.db.insert("seats", {
      hourId: hour._id,
      memberId: member._id,
      instituteId: member.instituteId,
      mode: "live",
      enteredAt: now - (minutes + 1) * 60 * 1000,
      lastBeatAt: now - 60 * 1000,
      leftAt: now - 60 * 1000,
      feedbackStatus: minutes >= 20 ? "pending" : undefined,
    });
  },
});
