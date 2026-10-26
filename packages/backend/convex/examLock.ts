// The exam lock on the server (house spec 0012 AC-7; owner, 2026-10-26): from Start until the student hands in, or the window closes and the sweep
// closes the sitting, every other room refuses with `exam_open`. A server helper, not a Convex function, called right after a room function's student
// check. The house frame (the student's own state, the bell, home) and Your data (consent, sharing, export, erase) never call it, so a student can
// always reach their data. The desk keeps its own check in `desk.begin`. It reads no clock: an open sitting past its window is closed by
// `exams.sweep` within a minute, and a query that used this runs again then.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { fail } from "./helpers";

export async function hasOpenSitting(ctx: Pick<QueryCtx | MutationCtx, "db">, memberId: Id<"members">): Promise<boolean> {
  const open = await ctx.db.query("paperAttempts").withIndex("by_memberId_and_status", (q) => q.eq("memberId", memberId).eq("status", "open")).first();
  return open !== null;
}

export async function refuseWhileSitting(ctx: Pick<QueryCtx | MutationCtx, "db">, mc: { member: { _id: Id<"members"> } }): Promise<void> {
  if (await hasOpenSitting(ctx, mc.member._id)) fail("exam_open");
}

// Whether one of the student's sittings was open at some moment in [from, to): from Start until they handed in, or until the window's end when they
// did not. The Brain uses it so a day the lock touched gets no real zero for the study hour, which the lock closed (owner, 2026-10-26).
export async function sittingWithin(ctx: Pick<QueryCtx | MutationCtx, "db">, memberId: Id<"members">, from: number, to: number): Promise<boolean> {
  const recent = await ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).order("desc").take(200);
  return recent.some((a) => a.startedAt !== undefined && a.startedAt < to && (a.submittedAt ?? a.dueAt) > from);
}
