// Development only helpers for `pnpm counsel:check` (spec house/0024). A test inbox can never claim a counselor invite (houseCore.mayClaimUnverified),
// so on development `makeCounselor` turns a made up `@example.test` account, already signed in once with the test form, into a counselor directly.
// `startNow` moves a made up student's booked session to a minute ago, so the call is open and the session can be finished in the same run. Internal only, and each
// refuses to run where the test sign in is off (production):
//   npx convex run counselProof:makeCounselor '{"email":"demo-counselor@example.test","name":"Demo Counselor"}'
import { v } from "convex/values";
import { components } from "./_generated/api";
import { env, internalMutation } from "./_generated/server";
import { SLOT_MS } from "./counselRules";
import { fail } from "./helpers";
import { isTestInbox } from "./houseCore";

export const makeCounselor = internalMutation({
  args: { email: v.string(), name: v.string() },
  returns: v.id("members"),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const email = args.email.trim().toLowerCase();
    if (!isTestInbox(email)) fail("not_a_test_inbox");
    const found = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: "user",
      where: [{ field: "email", operator: "eq", value: email }],
      paginationOpts: { numItems: 1, cursor: null },
    });
    const user = (found.page as unknown as { _id: string }[])[0];
    if (!user) fail("not_signed_in_yet");
    const member = await ctx.db.query("members").withIndex("by_authUserId", (q) => q.eq("authUserId", user._id)).first();
    if (member) {
      if (member.role !== "counselor") fail("not_a_counselor");
      return member._id;
    }
    return await ctx.db.insert("members", { authUserId: user._id, role: "counselor", name: args.name, email, status: "active", joinedAt: Date.now() });
  },
});

// For the responsive sweep: the demo counselor has a free time tomorrow at 16:30 India and a booking by the demo student at 16:00, with a note, so
// both screens are looked at with something on them. Kept as it is when already there.
export const seedDemo = internalMutation({
  args: { counselorEmail: v.string(), studentEmail: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    if (!isTestInbox(args.counselorEmail) || !isTestInbox(args.studentEmail)) fail("not_a_test_inbox");
    const counselor = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.counselorEmail)).first();
    const student = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", args.studentEmail)).first();
    if (!counselor || counselor.role !== "counselor" || !student || student.role !== "student" || !student.instituteId) fail("not_found");
    const now = Date.now();
    const tomorrowIndia = new Date(now + 5.5 * 3600_000 + 24 * 3600_000).toISOString().slice(0, 10);
    const booked = Date.parse(`${tomorrowIndia}T16:00:00+05:30`);
    const free = booked + SLOT_MS;
    const mine = await ctx.db
      .query("counselSlots")
      .withIndex("by_counselorMemberId_and_startsAt", (q) => q.eq("counselorMemberId", counselor._id).gte("startsAt", now))
      .take(50);
    if (!mine.some((s) => s.startsAt === free && s.status === "open")) {
      await ctx.db.insert("counselSlots", { counselorMemberId: counselor._id, startsAt: free, endsAt: free + SLOT_MS, status: "open", createdAt: now });
    }
    const open = await ctx.db.query("counselBookings").withIndex("by_memberId_and_startsAt", (q) => q.eq("memberId", student._id).gte("startsAt", now)).take(20);
    if (!open.some((b) => b.status === "booked")) {
      const slotId = await ctx.db.insert("counselSlots", { counselorMemberId: counselor._id, startsAt: booked, endsAt: booked + SLOT_MS, status: "booked", createdAt: now });
      await ctx.db.insert("counselBookings", {
        slotId,
        counselorMemberId: counselor._id,
        memberId: student._id,
        instituteId: student.instituteId,
        startsAt: booked,
        note: "A made up note for the sweep.",
        status: "booked",
        createdAt: now,
      });
    }
    return null;
  },
});

export const startNow = internalMutation({
  args: { studentEmail: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const email = args.studentEmail.trim().toLowerCase();
    if (!isTestInbox(email)) fail("not_a_test_inbox");
    const student = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", email)).first();
    if (!student) fail("not_found");
    const b = (await ctx.db.query("counselBookings").withIndex("by_memberId_and_startsAt", (q) => q.eq("memberId", student._id)).order("desc").take(20)).find((x) => x.status === "booked");
    if (!b) fail("not_found");
    const startsAt = Date.now() - 60 * 1000;
    await ctx.db.patch(b._id, { startsAt });
    await ctx.db.patch(b.slotId, { startsAt, endsAt: startsAt + SLOT_MS });
    return null;
  },
});
