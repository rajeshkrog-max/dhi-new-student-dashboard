// The live proof of the habits room's one row for each habit and day (spec house/0007, AC-5). The in memory test tool runs one call at a time, so it
// cannot show a write race; this does, on the development deployment. `race` makes a fresh made up student and one habit, then fires many first
// ticks at once for today: the answer must be one row and one current event. Internal only, and it refuses to run where the test sign in is off
// (production). Run (after `npx convex run eventProof:seed`, which makes the proof institute):
//   npx convex run habitProof:race '{"attempts":8}'
// It leaves its made up student on the development deployment. Nothing here is part of the app.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { dayOf } from "./dayRules";
import { fail } from "./helpers";
import { HABIT_COLORS } from "./habitRules";
import { tickFor } from "./habits";

export const makePlan = internalMutation({
  args: { memberId: v.id("members") },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const member = (await ctx.db.get(args.memberId)) as Doc<"members">;
    const day = dayOf(Date.now());
    return await ctx.db.insert("habitPlans", { memberId: member._id, instituteId: member.instituteId as Id<"institutes">, kind: "water", title: "Proof habit", color: HABIT_COLORS[0], startOn: day, endOn: day });
  },
});

export const tickAs = internalMutation({
  args: { memberId: v.id("members"), planId: v.string(), lit: v.boolean() },
  returns: v.object({ ok: v.boolean(), changed: v.optional(v.boolean()), code: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const member = (await ctx.db.get(args.memberId)) as Doc<"members">;
    const r = await tickFor(ctx, { member, role: member.role, classIds: [] }, { planId: args.planId, lit: args.lit });
    return r.ok ? { ok: true, changed: r.changed } : { ok: false, code: r.code };
  },
});

export const counts = internalQuery({
  args: { memberId: v.id("members") },
  returns: v.object({ checks: v.number(), events: v.number(), currentEvents: v.number() }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const day = dayOf(Date.now());
    const checks = await ctx.db.query("habitChecks").withIndex("by_memberId", (q) => q.eq("memberId", args.memberId)).take(50);
    const events = await ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", args.memberId).eq("loggedFor", day)).take(600);
    const latest = new Map<string, Id<"events">>();
    for (const e of events) if (e.about) latest.set(e.about, e._id);
    return { checks: checks.length, events: events.length, currentEvents: latest.size };
  },
});

export const race = internalAction({
  args: { attempts: v.optional(v.number()) },
  returns: v.object({ attempts: v.number(), ok: v.number(), refused: v.number(), checks: v.number(), events: v.number(), currentEvents: v.number() }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const n = Math.min(Math.max(args.attempts ?? 8, 2), 20);
    const memberId: Id<"members"> = await ctx.runMutation(internal.moodProof.makeStudent, { tag: `h${Date.now().toString(36)}` });
    const planId: string = await ctx.runMutation(internal.habitProof.makePlan, { memberId });
    const results: { ok: boolean; changed?: boolean; code?: string }[] = await Promise.all(
      Array.from({ length: n }, () => ctx.runMutation(internal.habitProof.tickAs, { memberId, planId, lit: true })),
    );
    const c: { checks: number; events: number; currentEvents: number } = await ctx.runQuery(internal.habitProof.counts, { memberId });
    return { attempts: n, ok: results.filter((r) => r.ok).length, refused: results.filter((r) => !r.ok).length, ...c };
  },
});
