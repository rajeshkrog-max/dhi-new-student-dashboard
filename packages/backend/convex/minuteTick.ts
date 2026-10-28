// The one minute job (2026-10-28, to stay inside the Convex free plan; house spec 0029). Every scheduled run counts as a function call, and six jobs
// each ran every minute on every deployment, whether there was work or not: about 259,000 calls a month a deployment with nobody in the house. The
// tick replaces them. It asks each job's own cheap check (one indexed row, kept beside the job) and schedules only the jobs that have work, so an idle
// deployment costs one call a minute. Each job is unchanged and still continues itself when its batch is full. Every tenth minute it also asks whether
// Brain days stored under an older formula wait for a rebuild.
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { rebuildHasWork, runHasWork } from "./brainRollup";
import { sweepPendingHasWork } from "./desk";
import { closeSittingsHasWork } from "./deskSitting";
import { sweepHasWork as examsHaveWork } from "./exams";
import { reportHasWork } from "./reportCopy";
import { sweepHasWork as seatsHaveWork } from "./studyHour";

export const REBUILD_EVERY_MINUTES = 10;

export const JOBS = ["reportCopies", "studySeats", "examSittings", "brainValues", "deskPending", "deskSittings", "brainRebuild"] as const;
export type Job = (typeof JOBS)[number];

export const tick = internalMutation({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const now = Date.now();
    const started: Job[] = [];
    if (await reportHasWork(ctx, now)) {
      await ctx.scheduler.runAfter(0, internal.reportMake.runDue, {});
      started.push("reportCopies");
    }
    if (await seatsHaveWork(ctx)) {
      await ctx.scheduler.runAfter(0, internal.studyHour.sweep, {});
      started.push("studySeats");
    }
    if (await examsHaveWork(ctx, now)) {
      await ctx.scheduler.runAfter(0, internal.exams.sweep, {});
      started.push("examSittings");
    }
    if (await runHasWork(ctx, now)) {
      await ctx.scheduler.runAfter(0, internal.brainRollup.run, {});
      started.push("brainValues");
    }
    if (await sweepPendingHasWork(ctx, now)) {
      await ctx.scheduler.runAfter(0, internal.desk.sweepPending, {});
      started.push("deskPending");
    }
    if (await closeSittingsHasWork(ctx, now)) {
      await ctx.scheduler.runAfter(0, internal.deskSitting.closeSittings, {});
      started.push("deskSittings");
    }
    if (Math.floor(now / 60_000) % REBUILD_EVERY_MINUTES === 0 && (await rebuildHasWork(ctx, now))) {
      await ctx.scheduler.runAfter(0, internal.brainRollup.rebuildStale, {});
      started.push("brainRebuild");
    }
    return started;
  },
});
