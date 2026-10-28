// The habits room's hooks into export and erase (spec house/0007, AC-10; spec house/0005, AC-12 and AC-13). Registered in roomRegistry.ts. This file
// registers no Convex function. The export is a page of the student's habits (25), each with the days ticked; the erase deletes the checks first and
// then the habits, a page at a time.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { EXPORT_HABITS_PAGE, MAX_WINDOW_DAYS } from "./habitRules";
import type { RoomEntry } from "./roomRegistry";

// The days with a lit check inside the habit's window, oldest first. A window is at most 90 days, so 91 rows is exact. A tick can never land after the
// day a habit was removed (a removed habit takes none), so the end of the window is simply `endOn`.
export async function ticksOf(ctx: QueryCtx | MutationCtx, plan: Doc<"habitPlans">): Promise<string[]> {
  const rows = await ctx.db
    .query("habitChecks")
    .withIndex("by_planId_and_day", (q) => q.eq("planId", plan._id).gte("day", plan.startOn).lte("day", plan.endOn))
    .take(MAX_WINDOW_DAYS + 1);
  return rows.filter((r) => r.lit).map((r) => r.day);
}

export const habitRoom: RoomEntry = {
  room: "habits",
  table: "habitPlans", // and "habitChecks": both are in the data map, and the eraser clears both
  kinds: ["habits"],
  exporter: async (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => {
    const size = Math.min(limit, EXPORT_HABITS_PAGE);
    const after = cursor === null ? null : Number(cursor);
    if (after !== null && Number.isNaN(after)) return { rows: [], next: null };
    const plans = await ctx.db
      .query("habitPlans")
      .withIndex("by_memberId", (q) => (after === null ? q.eq("memberId", memberId) : q.eq("memberId", memberId).gt("_creationTime", after)))
      .take(size + 1);
    const page = plans.slice(0, size);
    const rows = [];
    for (const p of page) {
      // The weekly feels answers of the habit (house spec 0030), each week with its four answers.
      const ratings = await ctx.db.query("habitRatings").withIndex("by_planId_and_week", (q) => q.eq("planId", p._id)).take(60);
      rows.push({
        title: p.title,
        kind: p.kind,
        color: p.color,
        startOn: p.startOn,
        endOn: p.endOn,
        removedOn: p.removedOn ?? null,
        ticks: await ticksOf(ctx, p),
        feels: ratings.map((r) => ({ week: r.week, answers: r.items })),
      });
    }
    return { rows, next: plans.length > size ? String(page[page.length - 1]._creationTime) : null };
  },
  eraser: async (ctx: MutationCtx, memberId: Id<"members">, limit: number) => {
    const ratings = await ctx.db.query("habitRatings").withIndex("by_memberId_and_week", (q) => q.eq("memberId", memberId)).take(limit);
    for (const r of ratings) await ctx.db.delete("habitRatings", r._id);
    if (ratings.length >= limit) return { deleted: ratings.length, done: false };
    const checks = await ctx.db.query("habitChecks").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const c of checks) await ctx.db.delete("habitChecks", c._id);
    if (checks.length >= limit) return { deleted: checks.length, done: false };
    const plans = await ctx.db.query("habitPlans").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(limit);
    for (const p of plans) await ctx.db.delete("habitPlans", p._id);
    return { deleted: checks.length + plans.length, done: plans.length < limit };
  },
};
