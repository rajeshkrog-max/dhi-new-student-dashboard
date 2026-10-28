// A development only helper for the browser proof of the topic and subject taps (house spec 0028). A real desk card needs a sitting of 10 minutes, so
// `openDeskCard` sends two made up maths topics ("Fractions", then "Decimals") to the student's class, as a teacher's paper would, and leaves one desk
// card pending for them. It refuses to run where the test sign in is off (production). It returns the topic ids, so the proof can check the tap.
//   npx convex run topicsProof:openDeskCard '{"email":"someone@example.test"}'
//   npx convex run topicsProof:lastDeskCard '{"email":"someone@example.test"}'
import { v } from "convex/values";
import { env, internalMutation, internalQuery } from "./_generated/server";
import { fail } from "./helpers";
import { ensureTopic, noteSent } from "./topics";

export const openDeskCard = internalMutation({
  args: { email: v.string() },
  returns: v.object({ fractions: v.id("paperTopics"), decimals: v.id("paperTopics") }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const member = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase())).first();
    if (!member || member.role !== "student" || !member.instituteId || !member.classId) fail("not_found");
    const now = Date.now();
    const fractions = await ensureTopic(ctx, member.instituteId, "maths", "Fractions");
    const decimals = await ensureTopic(ctx, member.instituteId, "maths", "Decimals");
    await noteSent(ctx, member.classId, [{ topicId: fractions, subject: "maths" }], now - 1000);
    await noteSent(ctx, member.classId, [{ topicId: decimals, subject: "maths" }], now);
    await ctx.db.insert("deskSittings", { memberId: member._id, instituteId: member.instituteId, startedAt: now - 30 * 60 * 1000, lastAt: now - 16 * 60 * 1000, feedbackStatus: "pending" });
    return { fractions, decimals };
  },
});

// What the student's newest answered desk card kept: the subject code and the topic id, or null. Read from the room's own row (only the event log
// reads events; topics.test.ts checks the event itself).
export const lastDeskCard = internalQuery({
  args: { email: v.string() },
  returns: v.union(v.object({ subject: v.union(v.string(), v.null()), topicId: v.union(v.id("paperTopics"), v.null()) }), v.null()),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const member = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase())).first();
    if (!member) fail("not_found");
    const rows = await ctx.db.query("deskSittings").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", member._id)).order("desc").take(20);
    const s = rows.find((r) => r.feedbackStatus === "answered");
    return s ? { subject: s.subject ?? null, topicId: s.topicId ?? null } : null;
  },
});
