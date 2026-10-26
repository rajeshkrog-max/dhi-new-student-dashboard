// The Brain report for the student (spec house/0020, scope rows 18 to 22). One query returns everything the Progress page shows, from the student's own
// stored daily values (brainDays) plus today worked out live: the patterns that fired with the days and measures behind them, the expression note,
// the support offer, the three growth lamps with their movement, and what the student has logged lately. It returns ids, counts and days, never a
// sentence: the words, in English and Hinglish, are the screen's. Everything is read for the signed in student and nobody else, and the report is
// shown to the student alone: nothing here is stored about the look, and no teacher, institute admin or DHI admin function reads any of it.
// Every function starts with `requireMember`, so the consent gate applies.
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { windowRows } from "./brainDay";
import { CONNECTION_WINDOW } from "./brainCodes";
import { connectionsOf } from "./connectionRules";
import {
  CHAIN_DAYS,
  EVIDENCE_ROOM,
  HIDE_DAYS,
  LAMP_WINDOW,
  MIN_LOGGED_DAYS,
  PAPER_DAYS,
  PATTERN_SOURCES_CONFIRMED,
  coverageOf,
  expressionNote,
  isHideable,
  lampsOf,
  loggedDaysIn,
  patternsOf,
  supportOffer,
  windowDays,
  dayMapOf,
} from "./brainRules";
import { DAY_MS, todayOf } from "./dayRules";
import { fail } from "./helpers";
import { requireMember } from "./houseAuth";
import { rateLimiter } from "./limits";

const inputView = v.object({ metric: v.string(), value: v.union(v.number(), v.null()), logged: v.number() });
const lampView = v.object({ lamp: v.string(), value: v.union(v.number(), v.null()), movement: v.union(v.string(), v.null()), loggedDays: v.number(), inputs: v.array(inputView) });
const evidenceView = v.array(v.object({ day: v.string(), items: v.array(v.object({ item: v.string(), room: v.string() })) }));
const connectionView = v.object({ id: v.string(), a: v.number(), b: v.number(), nA: v.number(), nB: v.number() });
const patternView = v.object({ id: v.string(), kind: v.string(), params: v.record(v.string(), v.union(v.number(), v.string())), evidence: evidenceView });

export const report = query({
  args: {},
  returns: v.object({
    today: v.string(),
    loggedDays: v.number(),
    needDays: v.number(),
    coverage: v.array(v.object({ room: v.string(), days: v.number() })),
    score: v.union(v.number(), v.null()),
    lamps: v.array(lampView),
    patterns: v.array(patternView),
    connections: v.array(connectionView),
    hidden: v.array(v.string()),
    expression: v.union(v.object({ runDays: v.array(v.string()), postDay: v.string() }), v.null()),
    support: v.union(v.object({ lowDays: v.number() }), v.null()),
    draft: v.object({ sources: v.boolean() }),
  }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const now = Date.now();
    const today = todayOf(now);
    // The 28 days of the lamps with today, and the 28 finished days the papers look reads: 29 days back from today.
    const rows = await windowRows(ctx, mc.member, now, Math.max(LAMP_WINDOW, PAPER_DAYS + 1));
    const hides = await ctx.db.query("brainHides").withIndex("by_memberId_and_patternId", (q) => q.eq("memberId", mc.member._id)).take(20);
    const hiddenNow = new Set(hides.filter((h) => h.until > now).map((h) => h.patternId));

    const fired = patternsOf(rows, today);
    const note = expressionNote(rows, today);
    // The connections read every finished day of the last four months, not only the chain window.
    // One more than the window, because today is in the rows and the connections drop it: 120 finished days (review of 2026-10-26).
    const connected = connectionsOf(await windowRows(ctx, mc.member, now, CONNECTION_WINDOW + 1), today);
    const hidden = [...fired.map((p) => p.id as string), ...connected.map((c) => c.id as string), ...(note ? ["expression"] : [])].filter((id) => hiddenNow.has(id));
    const support = supportOffer(rows, today);
    const { score, lamps } = lampsOf(rows, today);

    return {
      today,
      loggedDays: loggedDaysIn(dayMapOf(rows), windowDays(today, CHAIN_DAYS)),
      needDays: MIN_LOGGED_DAYS,
      coverage: coverageOf(rows, today),
      score,
      lamps,
      patterns: fired
        .filter((p) => !hiddenNow.has(p.id))
        .map((p) => ({ id: p.id, kind: p.kind, params: p.params, evidence: p.evidence.map((e) => ({ day: e.day, items: e.items.map((item) => ({ item, room: EVIDENCE_ROOM[item] })) })) })),
      connections: connected.filter((c) => !hiddenNow.has(c.id)),
      hidden,
      expression: note && !hiddenNow.has("expression") ? note : null,
      support: support ? { lowDays: support.lowDays } : null,
      draft: { sources: !PATTERN_SOURCES_CONFIRMED },
    };
  },
});

// "This does not feel true": hides a pattern, or the expression note, for 30 days. Hiding it again only moves the end date. A refusal is returned,
// not thrown, so a refused try still uses the allowance.
export const hide = mutation({
  args: { id: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "brainHide", { key: mc.member._id })).ok) return { ok: false as const, code: "slow_down" };
    if (!isHideable(args.id)) return { ok: false as const, code: "bad_id" };
    const until = Date.now() + HIDE_DAYS * DAY_MS;
    const existing = await ctx.db.query("brainHides").withIndex("by_memberId_and_patternId", (q) => q.eq("memberId", mc.member._id).eq("patternId", args.id)).first();
    if (existing) await ctx.db.patch(existing._id, { until });
    else await ctx.db.insert("brainHides", { memberId: mc.member._id, patternId: args.id, until });
    return { ok: true as const };
  },
});

// Brings a hidden pattern back at once.
export const show = mutation({
  args: { id: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), v.object({ ok: v.literal(false), code: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!(await rateLimiter.limit(ctx, "brainHide", { key: mc.member._id })).ok) return { ok: false as const, code: "slow_down" };
    if (!isHideable(args.id)) return { ok: false as const, code: "bad_id" };
    const existing = await ctx.db.query("brainHides").withIndex("by_memberId_and_patternId", (q) => q.eq("memberId", mc.member._id).eq("patternId", args.id)).first();
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true as const };
  },
});
