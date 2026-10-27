// The live proof of the mood room's one row a day (spec house/0006, AC-2). The in memory test tool runs one call at a time, so it cannot show a
// write race; this does, on the development deployment. `race` makes a fresh made up student and fires many first saves at once for today: the
// answer must be one row and one current event. Internal only, and it refuses to run where the test sign in is off (production). Run:
//   npx convex run moodProof:race '{"attempts":8}'
// It leaves its made up student on the development deployment. Nothing here is part of the app.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { HOUSE_NOTICE_VERSION } from "./consentText";
import { dayOf } from "./dayRules";
import { fail } from "./helpers";
import { saveFor } from "./moods";

export const makeStudent = internalMutation({
  args: { tag: v.string() },
  returns: v.id("members"),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const institute = await ctx.db.query("institutes").withIndex("by_nameKey", (q) => q.eq("nameKey", "event proof institute")).first();
    if (!institute) fail("run_event_proof_seed_first");
    const memberId = await ctx.db.insert("members", {
      authUserId: `proof:mood-${args.tag}`,
      role: "student",
      instituteId: institute._id,
      name: "Mood Proof Student",
      email: `mood-proof-${args.tag}@example.test`,
      under18: false,
      status: "active",
      joinedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    });
    await ctx.db.insert("consentRecords", { memberId, instituteId: institute._id, kind: "self", by: "self", byMemberId: memberId, textVersion: HOUSE_NOTICE_VERSION, under18AtTime: false });
    return memberId;
  },
});

export const saveAs = internalMutation({
  args: { memberId: v.id("members"), mood: v.string(), note: v.string() },
  returns: v.object({ ok: v.boolean(), changed: v.optional(v.boolean()), code: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const member = (await ctx.db.get(args.memberId)) as Doc<"members">;
    const r = await saveFor(ctx, { member, role: member.role, classIds: [] }, { mood: args.mood, note: args.note });
    return r.ok ? { ok: true, changed: r.changed } : { ok: false, code: r.code };
  },
});

export const counts = internalQuery({
  args: { memberId: v.id("members") },
  returns: v.object({ rows: v.number(), events: v.number(), currentEvents: v.number() }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const day = dayOf(Date.now());
    const rows = await ctx.db.query("moodDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", args.memberId)).take(50);
    const events = await ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", args.memberId).eq("loggedFor", day)).take(600);
    const latest = new Map<string, Id<"events">>();
    for (const e of events) if (e.about) latest.set(e.about, e._id);
    return { rows: rows.length, events: events.length, currentEvents: latest.size };
  },
});

export const race = internalAction({
  args: { attempts: v.optional(v.number()) },
  returns: v.object({ attempts: v.number(), ok: v.number(), refused: v.number(), rows: v.number(), events: v.number(), currentEvents: v.number() }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const n = Math.min(Math.max(args.attempts ?? 8, 2), 20);
    const memberId: Id<"members"> = await ctx.runMutation(internal.moodProof.makeStudent, { tag: Date.now().toString(36) });
    const moods = ["happy", "sad", "content", "tired"];
    const results: { ok: boolean; changed?: boolean; code?: string }[] = await Promise.all(Array.from({ length: n }, (_, i) => ctx.runMutation(internal.moodProof.saveAs, { memberId, mood: moods[i % moods.length], note: `try ${i}` })));
    const c: { rows: number; events: number; currentEvents: number } = await ctx.runQuery(internal.moodProof.counts, { memberId });
    return { attempts: n, ok: results.filter((r) => r.ok).length, refused: results.filter((r) => !r.ok).length, ...c };
  },
});
