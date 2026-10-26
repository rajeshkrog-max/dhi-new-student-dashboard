// The Brain's reading of one student's house day (spec house/0019). Shared by the rollup, which stores a finished day, and by the screens' reads
// (the home score and the Brain report), which add today, still in progress, worked out live from today's events: the Master Spec's "the current
// period is computed live". These are server helpers, not Convex functions. They read the room event log through its read helpers, so this file is
// on the allowlist in eventLog.test.ts, and the plan windows of the habits and the study hours, so it is on the habits allowlist too.
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { gateOf } from "./consentState";
import { dayBounds, dayOf, shiftDay, todayOf } from "./dayRules";
import { eventsForDay } from "./eventLog";
import { pausedWithin } from "./pauseHistory";
import { sittingWithin } from "./examLock";
import { MOOD_LIGHTNESS, valuesOfDay, type DayRow, type DayValues } from "./metricRules";

type Reader = QueryCtx | MutationCtx;

// How many habits were open on a day. A habit is open from its start day to its end day, and until the day it was removed.
export async function openHabitsOn(ctx: Reader, member: Doc<"members">, day: string): Promise<number> {
  const plans = await ctx.db.query("habitPlans").withIndex("by_memberId", (q) => q.eq("memberId", member._id)).take(200);
  return plans.filter((p) => p.startOn <= day && day <= p.endOn && (p.removedOn === undefined || day < p.removedOn)).length;
}

// Whether a study hour was open at any moment of the house day.
export async function hourOpenOn(ctx: Reader, day: string): Promise<boolean> {
  const { start, end } = dayBounds(day);
  const hours = await ctx.db.query("studyHours").withIndex("by_opensAt", (q) => q.lt("opensAt", end)).order("desc").take(20);
  return hours.some((h) => h.closesAt > start);
}

// A student has values only if they are a student of an institute who has agreed and not withdrawn, and the day is one they were in the house.
export async function eligible(ctx: Reader, member: Doc<"members">, day: string, now: number): Promise<boolean> {
  if (member.role !== "student" || member.status !== "active" || member.erasedAt !== undefined || member.instituteId === undefined) return false;
  if (day < dayOf(member.joinedAt) || day > todayOf(now)) return false;
  return (await gateOf(ctx, member)).state === "ok";
}

// The lightness of the mood on the student's previous logged day, looking back at most a week (the mood swing, E05). It is read from the events, so a late
// edit of that earlier day does not move a day already stored; a rebuild brings it right.
async function previousLightness(ctx: Reader, member: Doc<"members">, day: string): Promise<number | undefined> {
  for (let back = 1; back <= 7; back += 1) {
    const moods = (await eventsForDay(ctx, { memberId: member._id, day: shiftDay(day, -back) })).filter((e) => e.type === "mood.logged");
    if (moods.length > 0) return MOOD_LIGHTNESS[String((moods[moods.length - 1].payload as Record<string, unknown>).mood)];
  }
  return undefined;
}

// One student's values for one house day, worked out from the day's current events and the two facts the events cannot say.
export async function valuesFor(ctx: Reader, member: Doc<"members">, day: string, now: number): Promise<DayValues> {
  const events = (await eventsForDay(ctx, { memberId: member._id, day })).map((e) => ({ type: e.type, payload: e.payload as Record<string, unknown>, occurredAt: e.occurredAt }));
  // A class whose logins were paused (spec house/0021) is not expected to do anything on a day the pause touched: what the student did that day still
  // counts, but no real zero is written for a habit not ticked or an hour not sat. The day is then the same before and after the resume.
  const { start, end } = dayBounds(day);
  const paused = await pausedWithin(ctx, member.classId, start, end);
  // A day an open paper touched: the exam lock closed the study hour, so it is not expected that day (an hour the student did sit still counts).
  const sitting = await sittingWithin(ctx, member._id, start, end);
  return valuesOfDay(events, {
    openHabits: await openHabitsOn(ctx, member, day),
    hourOpen: (await hourOpenOn(ctx, day)) && !sitting,
    finished: day < todayOf(now) && !paused,
    prevLightness: events.some((e) => e.type === "mood.logged") ? await previousLightness(ctx, member, day) : undefined,
  });
}

export const sameValues = (a: DayValues, b: DayValues): boolean => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length || ka.some((k, i) => k !== kb[i])) return false;
  return ka.every((k) => {
    const x = a[k as keyof DayValues]!;
    const y = b[k as keyof DayValues]!;
    return x.num === y.num && x.den === y.den;
  });
};

// The student's last `days` house days, oldest first, up to and including today: the stored days, and today worked out live. A day with no value is
// not in the list (it is not logged, and never a zero). Only the student's own rows are read.
export async function windowRows(ctx: Reader, member: Doc<"members">, now: number, days: number): Promise<DayRow[]> {
  const today = todayOf(now);
  const from = shiftDay(today, -(days - 1));
  const yesterday = shiftDay(today, -1);
  const stored = await ctx.db
    .query("brainDays")
    .withIndex("by_memberId_and_day", (q) => q.eq("memberId", member._id).gte("day", from).lte("day", yesterday))
    .take(days + 5);
  const rows: DayRow[] = stored.map((r) => ({ day: r.day, v: r.values as DayValues }));
  if (await eligible(ctx, member, today, now)) {
    const live = await valuesFor(ctx, member, today, now);
    if (Object.keys(live).length > 0) rows.push({ day: today, v: live });
  }
  return rows.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}
