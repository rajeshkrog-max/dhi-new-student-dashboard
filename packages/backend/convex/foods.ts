// The food table (spec house/0009). Students search the catalog and their own custom dishes by name, and add a custom dish with the numbers they
// give. A custom dish counts straight away for the student. DHI publishes a custom dish into the catalog with the source "DHI checked". The
// catalog starts empty until the licence checks are done. No student function returns another student's dish or its owner. Every function
// starts with `requireMember`, so the consent gate applies.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { fail } from "./helpers";
import { requireMember, requireDhiAdmin } from "./houseAuth";
import { FOOD_GROUPS, MAX_ALIASES, MAX_NAME, MAX_SERVING, cleanName, isFoodGroup, isProcessing, matches, nutritionProblem } from "./foodRules";
import { rateLimiter } from "./limits";

const foodView = (f: Doc<"foods">) => ({
  foodId: f._id,
  nameEn: f.nameEn,
  nameHi: f.nameHi ?? "",
  group: f.group,
  processing: f.processing,
  serving: f.serving,
  status: f.status,
});

// Search by name or alias, English or Hindi spelling. Students see the name, group, processing and serving only, never the numbers.
export const search = query({
  args: { text: v.string() },
  returns: v.array(
    v.object({ foodId: v.id("foods"), nameEn: v.string(), nameHi: v.string(), group: v.string(), processing: v.string(), serving: v.string(), status: v.string() }),
  ),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (args.text.length > 80) fail("bad_query");
    const catalog = await ctx.db.query("foods").withIndex("by_status", (q) => q.eq("status", "catalog")).take(500);
    // The student's newest 200 dishes; a dish DHI published is found as its catalog copy, so the student's own row of it is left out.
    const mine = (await ctx.db.query("foods").withIndex("by_ownerMemberId", (q) => q.eq("ownerMemberId", mc.member._id)).order("desc").take(200)).filter((f) => f.status === "custom");
    const hit = (f: Doc<"foods">) => matches(f.nameEn, args.text) || matches(f.nameHi ?? "", args.text) || (f.aliases ?? []).some((a) => matches(a, args.text));
    return [...catalog, ...mine].filter(hit).slice(0, 20).map(foodView);
  },
});

// A student adds a custom dish with the numbers they give (per serving). It counts for them at once.
export const addCustom = mutation({
  args: {
    nameEn: v.string(),
    nameHi: v.optional(v.string()),
    aliases: v.optional(v.array(v.string())),
    group: v.string(),
    processing: v.string(),
    energyKcal: v.number(),
    carbsG: v.number(),
    proteinG: v.number(),
    fatG: v.number(),
    serving: v.string(),
  },
  returns: v.id("foods"),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    // The checks come before the limit: a refusal throws, and a thrown mutation gives its limit token back, so a refused dish never counted anyway.
    // The limit (10 an hour) is on dishes actually added.
    const nameEn = cleanName(args.nameEn, MAX_NAME);
    if (!nameEn) fail("bad_name");
    const serving = cleanName(args.serving, MAX_SERVING);
    if (!serving) fail("bad_serving");
    if (!isFoodGroup(args.group) || !isProcessing(args.processing)) fail("bad_code");
    const numbers = nutritionProblem(args);
    if (numbers) fail(numbers);
    const aliases = (args.aliases ?? []).map((a) => cleanName(a, MAX_NAME)).filter((a): a is string => a !== null).slice(0, MAX_ALIASES);
    const limit = await rateLimiter.limit(ctx, "foodAdd", { key: mc.member._id });
    if (!limit.ok) fail("rate_limited");
    return await ctx.db.insert("foods", {
      status: "custom",
      nameEn,
      nameHi: cleanName(args.nameHi ?? "", MAX_NAME) ?? undefined,
      aliases,
      group: args.group,
      processing: args.processing,
      energyKcal: args.energyKcal + 0,
      carbsG: args.carbsG + 0,
      proteinG: args.proteinG + 0,
      fatG: args.fatG + 0,
      serving,
      source: "Student's own entry",
      licence: "Student's own entry",
      ownerMemberId: mc.member._id,
      createdAt: Date.now(),
    });
  },
});

// DHI admin: the custom dishes waiting to be published, with names only (no owner identity).
export const unpublished = query({
  args: {},
  returns: v.array(v.object({ foodId: v.id("foods"), nameEn: v.string(), group: v.string(), processing: v.string() })),
  handler: async (ctx) => {
    await requireDhiAdmin(ctx);
    const rows = await ctx.db.query("foods").withIndex("by_status", (q) => q.eq("status", "custom")).take(200);
    return rows.map((f) => ({ foodId: f._id, nameEn: f.nameEn, group: f.group, processing: f.processing }));
  },
});

// DHI admin publishes a custom dish: a copy goes into the catalog with the source "DHI checked", and the owner is dropped from the copy. The student's
// own row becomes "published", so it leaves the waiting list, cannot be published twice, and the student finds the dish once (as the catalog copy).
export const publish = mutation({
  args: { foodId: v.id("foods") },
  returns: v.id("foods"),
  handler: async (ctx, args) => {
    const mc = await requireDhiAdmin(ctx);
    const food = await ctx.db.get(args.foodId);
    if (!food || food.status !== "custom") fail("not_found");
    const copy = await ctx.db.insert("foods", {
      status: "catalog",
      nameEn: food.nameEn,
      nameHi: food.nameHi,
      aliases: food.aliases,
      group: food.group,
      processing: food.processing,
      energyKcal: food.energyKcal,
      carbsG: food.carbsG,
      proteinG: food.proteinG,
      fatG: food.fatG,
      serving: food.serving,
      source: "DHI checked",
      licence: "DHI own",
      publishedBy: mc.member._id,
      createdAt: Date.now(),
    });
    await ctx.db.patch(food._id, { status: "published" });
    return copy;
  },
});

export const groups = query({
  args: {},
  returns: v.array(v.string()),
  handler: async () => [...FOOD_GROUPS],
});
