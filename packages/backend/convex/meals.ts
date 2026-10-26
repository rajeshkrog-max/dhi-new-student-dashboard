// The meals room (spec house/0010). A signed in student logs each plate: a food (from the catalog or their own custom dish), a count, the meal and
// the time it was eaten. The day of a plate is the house day of that time, so a meal at 01:00 counts for the day before. The room shows the food
// group counts of a day, never a calorie total. Each plate writes one `meals.logged` event (the meal and the group only). Removing a plate is a
// void of that event. Every function starts with `requireMember`, so the consent gate applies.
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { dayOf, shiftDay } from "./dayRules";
import { currentFor, recordEvent } from "./eventLog";
import { fail } from "./helpers";
import { requireMember, type MemberContext } from "./houseAuth";
import { rateLimiter } from "./limits";
import { MAX_COUNT, eatenAtProblem, groupCounts, isMeal } from "./foodRules";

type Actor = Pick<MemberContext, "member" | "role" | "classIds">;

// Logs one plate. The food must be in the catalog or be the student's own dish.
export async function logFor(ctx: MutationCtx, mc: Actor, args: { foodId: Id<"foods">; count: number; meal: string; eatenAt: number }) {
  const limit = await rateLimiter.limit(ctx, "mealLog", { key: mc.member._id });
  if (!limit.ok) return { ok: false as const, code: "rate_limited" };
  if (!isMeal(args.meal)) return { ok: false as const, code: "bad_meal" };
  if (!Number.isInteger(args.count) || args.count < 1 || args.count > MAX_COUNT) return { ok: false as const, code: "bad_count" };
  const now = Date.now();
  const timeProblem = eatenAtProblem(args.eatenAt, now);
  if (timeProblem) return { ok: false as const, code: timeProblem };
  const food = await ctx.db.get(args.foodId);
  const visible = food && (food.status === "catalog" || food.ownerMemberId === mc.member._id);
  if (!food || !visible) return { ok: false as const, code: "not_found" };

  const day = dayOf(args.eatenAt);
  const memberId = mc.member._id;
  const id = await ctx.db.insert("mealPlates", {
    memberId,
    instituteId: mc.member.instituteId as NonNullable<typeof mc.member.instituteId>,
    day,
    meal: args.meal,
    eatenAt: args.eatenAt,
    foodId: food._id,
    group: food.group,
    count: args.count,
  });
  await recordEvent(ctx, {
    by: mc,
    memberId,
    room: "meals",
    type: "meals.logged",
    payload: { meal: args.meal, group: food.group, processing: food.processing },
    occurredAt: args.eatenAt,
    eventKey: `meal:${id}-0`,
    about: `meal:${id}`,
  });
  return { ok: true as const, plateId: id, day };
}

export const log = mutation({
  args: { foodId: v.id("foods"), count: v.number(), meal: v.string(), eatenAt: v.number() },
  returns: v.union(v.object({ ok: v.literal(true), plateId: v.id("mealPlates"), day: v.string() }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    return await logFor(ctx, mc, args);
  },
});

type Plate = { plateId: Id<"mealPlates">; meal: string; group: string; count: number; foodName: string; eatenAt: number };

async function platesOf(ctx: QueryCtx | MutationCtx, memberId: Id<"members">, day: string): Promise<Plate[]> {
  const rows = await ctx.db.query("mealPlates").withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId).eq("day", day)).take(200);
  const out: Plate[] = [];
  for (const r of rows) {
    if (r.removedAt !== undefined) continue;
    const food: Doc<"foods"> | null = await ctx.db.get(r.foodId);
    out.push({ plateId: r._id, meal: r.meal, group: r.group, count: r.count, foodName: food?.nameEn ?? "", eatenAt: r.eatenAt });
  }
  return out.sort((a, b) => a.eatenAt - b.eatenAt);
}

// Today's plates (the house day now) and the food group counts for the day. No calorie or protein total is returned.
export const day = query({
  args: {},
  returns: v.object({
    day: v.string(),
    plates: v.array(v.object({ plateId: v.id("mealPlates"), meal: v.string(), group: v.string(), count: v.number(), foodName: v.string(), eatenAt: v.number() })),
    groups: v.object({ grain: v.number(), dal: v.number(), vegetable: v.number(), dairy: v.number(), fruit: v.number() }),
  }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const today = dayOf(Date.now());
    const plates = await platesOf(ctx, mc.member._id, today);
    return { day: today, plates, groups: groupCounts(plates) };
  },
});

// The food group counts of each of the last 7 house days, oldest first. The week does not reset when the day does.
export const week = query({
  args: {},
  returns: v.array(v.object({ day: v.string(), groups: v.object({ grain: v.number(), dal: v.number(), vegetable: v.number(), dairy: v.number(), fruit: v.number() }) })),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const today = dayOf(Date.now());
    const out = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = shiftDay(today, -i);
      out.push({ day: d, groups: groupCounts(await platesOf(ctx, mc.member._id, d)) });
    }
    return out;
  },
});

// Removes a plate the student logged. The event is voided, so the day counts it no more.
export const remove = mutation({
  args: { plateId: v.id("mealPlates") },
  returns: v.object({ ok: v.literal(true) }),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const plate = await ctx.db.get(args.plateId);
    if (!plate || plate.memberId !== mc.member._id) fail("not_found");
    if (plate.removedAt !== undefined) return { ok: true as const };
    const about = `meal:${plate._id}`;
    const previous = await currentFor(ctx, { memberId: mc.member._id, about, day: plate.day });
    await recordEvent(ctx, {
      by: mc,
      memberId: mc.member._id,
      room: "meals",
      type: "meals.logged",
      void: true,
      occurredAt: plate.eatenAt,
      eventKey: `${about}-1`,
      about,
      ...(previous ? { replaces: previous._id } : {}),
    });
    await ctx.db.patch(plate._id, { removedAt: Date.now() });
    return { ok: true as const };
  },
});

