// When a class's logins were paused (house spec 0021). `classes.pausedAt` says whether a class is paused now; the history says whether it was paused at a
// moment, so a day or a window that ended while the class was paused is never held against its students (no real zero in the Brain, no miss in the
// exams). Read-only helpers, not Convex functions: `classes.pause` and `classes.resume` are the only writers of `classPauses`.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Reader = QueryCtx | MutationCtx;

// How many pauses of one class are looked at, newest first. A class is paused a few times in a term, so this is far above any real count.
const PAUSES_READ = 200;

// Whether the class was paused at any moment of `from <= time < to`. A pause with no end is still going on. A class that holds `pausedAt` but has no
// open row (paused before the history existed) counts as paused from `pausedAt`.
export async function pausedWithin(ctx: Reader, classId: Id<"classes"> | undefined, from: number, to: number): Promise<boolean> {
  if (classId === undefined) return false;
  const rows = await ctx.db.query("classPauses").withIndex("by_classId_and_startedAt", (q) => q.eq("classId", classId)).order("desc").take(PAUSES_READ);
  if (rows.some((r) => r.startedAt < to && (r.endedAt === undefined || r.endedAt > from))) return true;
  if (rows.some((r) => r.endedAt === undefined)) return false;
  const cls = await ctx.db.get(classId);
  return cls?.pausedAt !== undefined && cls.pausedAt < to;
}
