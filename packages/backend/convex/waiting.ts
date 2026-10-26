// What is waiting for the signed in student, for the bell at the top of the house (spec house/0017, the home). It is read from the student's own
// rows when they look and is stored nowhere: a paper that is open now, a mark the teacher has confirmed and the student has not yet read, and a
// feeling card from a study hour that ended in the last day. Nothing here is a count of what other students do, and nothing is written or recorded.
// Every function starts with `requireMember`, so the consent gate applies.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { fail } from "./helpers";
import { requireMember } from "./houseAuth";
import { OFFER_WINDOW_MS } from "./sessionRules";

const MAX_ITEMS = 20;

export const mine = query({
  args: {},
  returns: v.array(v.object({ kind: v.string(), title: v.string(), room: v.string() })),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const now = Date.now();
    const items: { kind: string; title: string; room: string }[] = [];

    // Papers open now, and confirmed marks not yet read (the student presses "I have read this feedback" in Exams).
    const attempts = await ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).order("desc").take(300);
    for (const a of attempts) {
      const open = a.opensAt <= now && now < a.dueAt && (a.status === "assigned" || a.status === "open");
      const unread = a.status === "confirmed" && a.acceptedAt === undefined;
      if (!open && !unread) continue;
      const paper = await ctx.db.get(a.paperId);
      if (paper) items.push({ kind: open ? "exam_open" : "mark", title: paper.title, room: "papers" });
    }

    // A feeling card from a study hour stay that ended in the last 24 hours (spec house/0018).
    const seats = await ctx.db.query("seats").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).order("desc").take(10);
    if (seats.some((s) => s.feedbackStatus === "pending" && s.leftAt !== undefined && now - s.leftAt < OFFER_WINDOW_MS)) items.push({ kind: "feeling", title: "", room: "hour" });

    // The same card after a desk sitting of 10 minutes or more that ended in the last 24 hours.
    const sittings = await ctx.db.query("deskSittings").withIndex("by_memberId_and_lastAt", (q) => q.eq("memberId", mc.member._id)).order("desc").take(10);
    if (sittings.some((s) => s.feedbackStatus === "pending" && now - s.lastAt < OFFER_WINDOW_MS)) items.push({ kind: "feeling", title: "", room: "dhi" });

    return items.slice(0, MAX_ITEMS);
  },
});
