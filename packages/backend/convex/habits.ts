// The habits room (spec house/0007). A signed in student keeps up to five habits and ticks each one for today. Two tables (`habitPlans`,
// `habitChecks`), and a `habits.ticked` event written beside every tick or undo through the event log (only the kind of habit, never the title).
// Every function starts with `requireMember`, so the consent gate applies, and then checks the person is a student. Nothing else reads the tables.
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { dayOf } from "./dayRules";
import { currentFor, recordEvent } from "./eventLog";
import { fail } from "./helpers";
import { requireMember, type MemberContext } from "./houseAuth";
import {
  FINISHED_SHOWN,
  MAX_FLIPS,
  MAX_OPEN_HABITS,
  cleanHabitTitle,
  isHabitColor,
  isHabitKind,
  windowProblem,
} from "./habitRules";
import { ticksOf } from "./habitRoom";
import { rateLimiter } from "./limits";

const refused = v.object({ ok: v.literal(false), code: v.string() });
const habit = v.object({ id: v.string(), kind: v.string(), title: v.string(), color: v.string(), startOn: v.string(), endOn: v.string(), ticks: v.array(v.string()) });

// The student's own habits: the open ones, then the newest finished ones (a removed habit is left out). Open habits have the latest end days, so the
// newest 30 by end day hold all five open habits and the 25 newest finished ones, and the query needs no clock.
export const list = query({
  args: {},
  returns: v.array(habit),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const memberId = mc.member._id;
    const plans = await ctx.db
      .query("habitPlans")
      .withIndex("by_memberId_and_removedOn_and_endOn", (q) => q.eq("memberId", memberId).eq("removedOn", undefined))
      .order("desc")
      .take(MAX_OPEN_HABITS + FINISHED_SHOWN);
    const out = [];
    for (const p of plans) {
      out.push({ id: p._id as string, kind: p.kind, title: p.title, color: p.color, startOn: p.startOn, endOn: p.endOn, ticks: await ticksOf(ctx, p) });
    }
    return out;
  },
});

// Add a habit. The order is: the entry check and the role, the write limit (every attempt counts), the validation, the cap of five open habits, the
// daily add limit (only a habit that would really be made counts), then the write. The browser sends no clock: the server reads it once.
export const add = mutation({
  args: { kind: v.string(), title: v.string(), color: v.string(), startOn: v.string(), endOn: v.string() },
  returns: v.union(v.object({ ok: v.literal(true), id: v.string() }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const memberId = mc.member._id;
    const write = await rateLimiter.limit(ctx, "habitWrite", { key: memberId });
    if (!write.ok) return { ok: false as const, code: "rate_limited" };

    const title = cleanHabitTitle(args.title);
    if (!title) return { ok: false as const, code: "bad_title" };
    if (!isHabitKind(args.kind)) return { ok: false as const, code: "bad_habit" };
    if (!isHabitColor(args.color)) return { ok: false as const, code: "bad_color" };
    const day = dayOf(Date.now());
    const problem = windowProblem(day, args.startOn, args.endOn);
    if (problem) return { ok: false as const, code: problem };

    // The cap: habits that are not removed and whose end day has not passed. A habit that starts in the future is open.
    const open = await ctx.db
      .query("habitPlans")
      .withIndex("by_memberId_and_removedOn_and_endOn", (q) => q.eq("memberId", memberId).eq("removedOn", undefined).gte("endOn", day))
      .take(MAX_OPEN_HABITS + 1);
    if (open.length >= MAX_OPEN_HABITS) return { ok: false as const, code: "too_many_habits" };
    // The daily limit counts habits that would really be made, so a typing mistake never uses it up.
    const adds = await rateLimiter.limit(ctx, "habitAddDay", { key: memberId });
    if (!adds.ok) return { ok: false as const, code: "too_many_adds" };

    const id = await ctx.db.insert("habitPlans", {
      memberId,
      instituteId: mc.member.instituteId as NonNullable<typeof mc.member.instituteId>,
      kind: args.kind,
      title,
      color: args.color,
      startOn: args.startOn,
      endOn: args.endOn,
    });
    return { ok: true as const, id: id as string };
  },
});

// One of the student's own habits, or null. A malformed id, a missing row and another student's habit all read the same.
async function ownPlan(ctx: MutationCtx, memberId: Id<"members">, planId: string): Promise<Doc<"habitPlans"> | null> {
  const id = ctx.db.normalizeId("habitPlans", planId);
  const plan = id ? await ctx.db.get(id) : null;
  return plan && plan.memberId === memberId ? plan : null;
}

// Tick (`lit: true`) or undo (`lit: false`) a habit for today. The order is: the entry check and the role, the write limit, the habit lookup
// (`not_found`), the window and removal check (`not_open`), the no op check, the flips check, then the write and the event. A tick is a target
// state, not a toggle, so a stale tab that resends it changes nothing.
export const setToday = mutation({
  args: { planId: v.string(), lit: v.boolean() },
  returns: v.union(v.object({ ok: v.literal(true), day: v.string(), lit: v.boolean(), changed: v.boolean() }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    return await tickFor(ctx, mc, args);
  },
});

type Tick = { ok: true; day: string; lit: boolean; changed: boolean } | { ok: false; code: string };

// The tick itself, for the signed in student (and for the development proof, which calls it as a made up student).
export async function tickFor(ctx: MutationCtx, mc: Pick<MemberContext, "member" | "role" | "classIds">, args: { planId: string; lit: boolean }): Promise<Tick> {
    const memberId = mc.member._id;
    const write = await rateLimiter.limit(ctx, "habitWrite", { key: memberId });
    if (!write.ok) return { ok: false as const, code: "rate_limited" };
    const plan = await ownPlan(ctx, memberId, args.planId);
    if (!plan) return { ok: false as const, code: "not_found" };

    const now = Date.now();
    const day = dayOf(now);
    if (plan.removedOn !== undefined || day < plan.startOn || day > plan.endOn) return { ok: false as const, code: "not_open" };

    const row = await ctx.db.query("habitChecks").withIndex("by_planId_and_day", (q) => q.eq("planId", plan._id).eq("day", day)).first();
    if ((row?.lit ?? false) === args.lit) return { ok: true as const, day, lit: args.lit, changed: false };
    if (row && row.flips >= MAX_FLIPS) return { ok: false as const, code: "too_many_flips" };

    if (!row) {
      const checkId = await ctx.db.insert("habitChecks", { planId: plan._id, memberId, instituteId: plan.instituteId, day, lit: true, flips: 0 });
      await recordEvent(ctx, {
        by: mc,
        memberId,
        room: "habits",
        type: "habits.ticked",
        payload: { habit: plan.kind },
        occurredAt: now,
        eventKey: `habit:${checkId}-0`,
        about: `habit:${checkId}`,
      });
      return { ok: true as const, day, lit: true, changed: true };
    }

    const about = `habit:${row._id}`;
    const previous = await currentFor(ctx, { memberId, about, day });
    await recordEvent(ctx, {
      by: mc,
      memberId,
      room: "habits",
      type: "habits.ticked",
      ...(args.lit ? { payload: { habit: plan.kind } } : { void: true }),
      occurredAt: now,
      eventKey: `${about}-${row.flips + 1}`,
      about,
      ...(previous ? { replaces: previous._id } : {}),
    });
    await ctx.db.patch(row._id, { lit: args.lit, flips: row.flips + 1 });
    return { ok: true as const, day, lit: args.lit, changed: true };
}

// Remove a habit: it ends today and its history stays. A second remove of the same habit answers ok and changes nothing. No event is written.
export const remove = mutation({
  args: { planId: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const memberId = mc.member._id;
    const write = await rateLimiter.limit(ctx, "habitWrite", { key: memberId });
    if (!write.ok) return { ok: false as const, code: "rate_limited" };
    const plan = await ownPlan(ctx, memberId, args.planId);
    if (!plan) return { ok: false as const, code: "not_found" };
    if (plan.removedOn === undefined) await ctx.db.patch(plan._id, { removedOn: dayOf(Date.now()) });
    return { ok: true as const };
  },
});

// ---- The weekly habit feels check (the Master Spec's H10; house spec 0030) ----

// The Monday of the India week a house day falls in, so a week turns with the house day at 04:00 on Monday.
export function weekOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
export const FEEL_ITEMS = 4;
export const FEEL_MIN = 1;
export const FEEL_MAX = 7;

// The open habits the student has already rated this week. `now` comes from the screen (a query does not read the clock), and only picks the week.
export const ratedThisWeek = query({
  args: { now: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const week = weekOf(dayOf(args.now));
    const rows = await ctx.db.query("habitRatings").withIndex("by_memberId_and_week", (q) => q.eq("memberId", mc.member._id).eq("week", week)).take(MAX_OPEN_HABITS + 5);
    return rows.map((r) => r.planId as string);
  },
});

// The student rates how automatic one open habit feels: four answers, each 1 to 7, once a week. One `habits.rated` event holds the kind and the sum.
export const rate = mutation({
  args: { planId: v.string(), items: v.array(v.number()) },
  returns: v.union(v.object({ ok: v.literal(true) }), refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const memberId = mc.member._id;
    if (!(await rateLimiter.limit(ctx, "measureWrite", { key: memberId })).ok) return { ok: false as const, code: "rate_limited" };
    if (args.items.length !== FEEL_ITEMS || !args.items.every((x) => Number.isInteger(x) && x >= FEEL_MIN && x <= FEEL_MAX)) return { ok: false as const, code: "bad_items" };
    const plan = await ownPlan(ctx, memberId, args.planId);
    if (!plan) return { ok: false as const, code: "not_found" };
    const now = Date.now();
    const day = dayOf(now);
    if (plan.removedOn !== undefined || day < plan.startOn || day > plan.endOn) return { ok: false as const, code: "not_open" };
    const week = weekOf(day);
    if (await ctx.db.query("habitRatings").withIndex("by_planId_and_week", (q) => q.eq("planId", plan._id).eq("week", week)).first()) return { ok: false as const, code: "already_rated" };
    const id = await ctx.db.insert("habitRatings", { memberId, instituteId: plan.instituteId, planId: plan._id, week, items: args.items, createdAt: now });
    await recordEvent(ctx, {
      by: mc,
      memberId,
      room: "habits",
      type: "habits.rated",
      payload: { habit: plan.kind, score: args.items.reduce((s, x) => s + x, 0) },
      occurredAt: now,
      eventKey: `habitfeel:${id}-0`,
      about: `habitfeel:${id}`,
    });
    return { ok: true as const };
  },
});
