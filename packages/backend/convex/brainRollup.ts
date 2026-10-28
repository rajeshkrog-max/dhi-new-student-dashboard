// The Brain's rollup (spec house/0019, scope row 17). It reads the room event log and keeps `brainDays`: one row for each student and house day with
// that day's values (metricRules.ts), so opening a report is a read of stored values and not a calculation. Every job is idempotent: a day is always
// recomputed from its events, never added to, so running a job twice changes nothing and a late event is picked up by the next pass.
//   run           every minute: reads the events written since the last pass and recomputes the (student, day) pairs they touch
//   closeYesterday, closeDay   each morning after the house day turns: gives every student's finished day its real zeros (a habit that was open and
//                 not ticked, a study hour that was open and not sat), which have no event to touch them. It closes the last two days, so one
//                 missed morning heals itself.
//   rebuildStale  rebuilds the days stored under an older catalog version after a formula changes
//   reconcile     each morning: recomputes recent days and counts any that differ from what is stored (counts only, never a name)
// This file reads the event table by creation time (the log's allowlist in eventLog.test.ts names it) and is the only writer of `brainDays`
// (brainRollup.test.ts scans for that). The reading of one day is in brainDay.ts, which the reports share.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { dayFor, eligible, sameValues } from "./brainDay";
import { shiftDay, todayOf } from "./dayRules";
import { METRIC_VERSION, type DayValues } from "./metricRules";

// Each pass starts a minute before where the last complete one stopped, because rows written together can land out of order by a moment.
const LOOKBACK_MS = 60 * 1000;
const EVENT_BATCH = 400;
// Events written in the last few seconds are left for the next pass. A read that stops short of "now" is not disturbed by every room's inserts, which
// would otherwise conflict with this job all day; the minute's look back and the live reading of today make up for the wait.
const QUIET_MS = 10 * 1000;
// How many (student, day) pairs one pass recomputes, how many students one closing step closes, how many stale days one rebuild step rebuilds.
const PAIR_CAP = 20;
const CLOSE_PAGE = 20;
const REBUILD_BATCH = 40;
const RECONCILE_ROWS = 100;
// A row computed in the last five minutes is still settling, so the check leaves it out.
const SETTLE_MS = 5 * 60 * 1000;

async function stateOf(ctx: MutationCtx, key: string): Promise<Doc<"brainState">> {
  const found = await ctx.db.query("brainState").withIndex("by_key", (q) => q.eq("key", key)).first();
  if (found) return found;
  const id = await ctx.db.insert("brainState", { key, cursor: 0 });
  return (await ctx.db.get(id))!;
}

export type DayResult = "written" | "removed" | "unchanged" | "skipped";

// One student's values for one house day, worked out from the day's current events and stored. A day with nothing to measure has no row.
export async function computeDay(ctx: MutationCtx, member: Doc<"members">, day: string, now: number): Promise<DayResult> {
  if (!(await eligible(ctx, member, day, now))) return "skipped";
  const { values, tags } = await dayFor(ctx, member, day, now);
  const existing = await ctx.db.query("brainDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", member._id).eq("day", day)).first();
  if (Object.keys(values).length === 0) {
    if (!existing) return "unchanged";
    await ctx.db.delete(existing._id);
    return "removed";
  }
  const hasTags = Object.keys(tags).length > 0;
  if (existing && existing.version === METRIC_VERSION && sameValues(existing.values as DayValues, values) && sameValues(existing.tags ?? {}, tags)) return "unchanged";
  // The tagged values (house spec 0028) go with the day; a day that lost them drops the field.
  const row = { values: values as Record<string, { num: number; den: number }>, tags: hasTags ? tags : undefined, version: METRIC_VERSION, computedAt: now };
  if (existing) await ctx.db.patch(existing._id, row);
  else await ctx.db.insert("brainDays", { memberId: member._id, instituteId: member.instituteId!, day, ...row });
  return "written";
}

// Every minute: the days touched by the events written since the last pass.
export const run = internalMutation({
  args: {},
  returns: v.object({ events: v.number(), days: v.number(), more: v.boolean() }),
  handler: async (ctx) => {
    const now = Date.now();
    const state = await stateOf(ctx, "events");
    // After a pass that stopped early the next one reads strictly after where it stopped; after a complete one it reads a minute back.
    // (Greater or equal after an early stop, so an event written at the very same instant as the last one covered is not skipped; recomputing a day is harmless.)
    const from = state.capped === true ? state.cursor : Math.max(0, state.cursor - LOOKBACK_MS);
    const to = now - QUIET_MS;
    const batch = await ctx.db
      .query("events")
      .withIndex("by_creation_time", (q) => (state.capped === true ? q.gte("_creationTime", from).lt("_creationTime", to) : q.gt("_creationTime", from).lt("_creationTime", to)))
      .take(EVENT_BATCH);
    const pairs = new Map<string, { memberId: Doc<"events">["memberId"]; day: string }>();
    let covered = 0;
    let last = state.cursor;
    let cut = false;
    for (const e of batch) {
      const key = `${e.memberId}|${e.loggedFor}`;
      if (!pairs.has(key)) {
        if (pairs.size >= PAIR_CAP) {
          cut = true;
          break;
        }
        pairs.set(key, { memberId: e.memberId, day: e.loggedFor });
      }
      covered += 1;
      last = Math.max(last, e._creationTime);
    }
    for (const { memberId, day } of pairs.values()) {
      const member = await ctx.db.get(memberId);
      if (member) await computeDay(ctx, member, day, now);
    }
    const more = cut || batch.length === EVENT_BATCH;
    await ctx.db.patch(state._id, { cursor: last, capped: more });
    if (more) await ctx.scheduler.runAfter(0, internal.brainRollup.run, {});
    return { events: covered, days: pairs.size, more };
  },
});

// Each morning after the house day turns: start closing the last two days for every student.
export const closeYesterday = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const today = todayOf(Date.now());
    for (const back of [1, 2]) await ctx.scheduler.runAfter(0, internal.brainRollup.closeDay, { day: shiftDay(today, -back), cursor: null });
    return null;
  },
});

// Computes one finished day for a page of students, then asks for the next page. Also how a day is filled in by hand (`npx convex run`).
export const closeDay = internalMutation({
  args: { day: v.string(), cursor: v.union(v.string(), v.null()) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const page = await ctx.db.query("members").order("asc").paginate({ numItems: CLOSE_PAGE, cursor: args.cursor });
    let done = 0;
    for (const member of page.page) {
      if (member.role !== "student") continue;
      if ((await computeDay(ctx, member, args.day, now)) !== "skipped") done += 1;
    }
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.brainRollup.closeDay, { day: args.day, cursor: page.continueCursor });
    return done;
  },
});

// After a formula changes (METRIC_VERSION goes up): rebuild the stored days of an older version from the events, a page at a time. Where a pass stopped is
// kept (`brainState`, key "rebuild"), so rows that cannot be rebuilt now (a student who withdrew, one whose class is paused) never hold up the rest: the
// next pass starts after them, and once every stale row has been looked at the next one starts again from the first, so they are rebuilt when they can be.
export const rebuildStale = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    const state = await stateOf(ctx, "rebuild");
    const page = await ctx.db.query("brainDays").withIndex("by_version", (q) => q.lt("version", METRIC_VERSION)).paginate({ numItems: REBUILD_BATCH, cursor: state.token ?? null });
    let rebuilt = 0;
    for (const row of page.page) {
      const member = await ctx.db.get(row.memberId);
      if (!member) continue;
      if ((await computeDay(ctx, member, row.day, now)) !== "skipped") rebuilt += 1;
    }
    await ctx.db.patch(state._id, { token: page.isDone ? undefined : page.continueCursor });
    if (!page.isDone) await ctx.scheduler.runAfter(0, internal.brainRollup.rebuildStale, {});
    return rebuilt;
  },
});

// Each morning: recompute the newest stored days and count the ones that differ. Counts only are kept and logged, so no name or value is ever
// written to a log, and the team sees a mismatch by the number going above zero.
export const reconcile = internalMutation({
  args: {},
  returns: v.object({ checked: v.number(), mismatches: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const rows = await ctx.db.query("brainDays").order("desc").take(RECONCILE_ROWS);
    let checked = 0;
    let mismatches = 0;
    for (const row of rows) {
      if (row.computedAt > now - SETTLE_MS) continue;
      const member = await ctx.db.get(row.memberId);
      if (!member || !(await eligible(ctx, member, row.day, now))) continue;
      checked += 1;
      const fresh = await dayFor(ctx, member, row.day, now);
      if (!sameValues(row.values as DayValues, fresh.values) || !sameValues(row.tags ?? {}, fresh.tags)) mismatches += 1;
    }
    const state = await stateOf(ctx, "reconcile");
    await ctx.db.patch(state._id, { checked, mismatches, at: now });
    if (mismatches > 0) console.error(`brain.reconcile: ${mismatches} of ${checked} stored days differ from the events`);
    return { checked, mismatches };
  },
});
