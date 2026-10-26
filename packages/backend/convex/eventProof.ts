// The live proof of the event log's retry rule (spec house/0004, AC-4). The in memory test tool runs one call at a time, so it cannot show a
// write race; this does, on the development deployment. `race` fires many mutations at once for one student and one key, and the answer must
// be one stored event. Internal only, and it refuses to run where the test sign in is off (production). Run:
//   npx convex run eventProof:seed
//   npx convex run eventProof:race '{"memberId":"<id from seed>"}'
// It leaves its few synthetic events on the development deployment (no app code deletes an event). Nothing here is a room.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { HOUSE_ACCEPTED_VERSIONS, HOUSE_NOTICE_VERSION } from "./consentText";
import { dayOf } from "./dayRules";
import { eventsForDay, recordSystemEvent } from "./eventLog";
import { fail } from "./helpers";

const PROOF_INSTITUTE = "Event Proof Institute";

// Annotated by hand: an action that calls functions of its own file would otherwise make the generated api type circular.
type Recorded = { eventId: Id<"events">; loggedFor: string; late: boolean; duplicate: boolean };
type RaceResult = {
  sameKey: { attempts: number; freshWrites: number; duplicates: number; stored: number };
  manyKeys: { attempts: number; freshWrites: number; stored: number };
};

export const seed = internalMutation({
  args: {},
  returns: v.object({ memberId: v.id("members") }),
  handler: async (ctx) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const nameKey = PROOF_INSTITUTE.toLowerCase();
    const institute = await ctx.db.query("institutes").withIndex("by_nameKey", (q) => q.eq("nameKey", nameKey)).first();
    const instituteId = institute?._id ?? (await ctx.db.insert("institutes", { name: PROOF_INSTITUTE, nameKey, status: "active", plan: "proof" }));
    const cls = await ctx.db.query("classes").withIndex("by_instituteId", (q) => q.eq("instituteId", instituteId)).first();
    const classId = cls?._id ?? (await ctx.db.insert("classes", { instituteId, grade: "Class 10", section: "P" }));
    const authUserId = "proof:event-log-student";
    const existing = await ctx.db.query("members").withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId)).unique();
    // The event log refuses a student who is not through consent, so the proof student agrees (an adult, so no parent record).
    const give = async (memberId: Id<"members">) => {
      const agreed = await ctx.db.query("consentRecords").withIndex("by_memberId_and_kind", (q) => q.eq("memberId", memberId).eq("kind", "self")).take(10);
      if (!agreed.some((r) => HOUSE_ACCEPTED_VERSIONS.includes(r.textVersion))) await ctx.db.insert("consentRecords", { memberId, instituteId, kind: "self", by: "self", byMemberId: memberId, textVersion: HOUSE_NOTICE_VERSION, under18AtTime: false });
    };
    if (existing) {
      await give(existing._id);
      return { memberId: existing._id };
    }
    const memberId = await ctx.db.insert("members", {
      authUserId,
      role: "student",
      instituteId,
      classId,
      name: "Event Proof Student",
      email: "event-proof@example.test",
      under18: false,
      status: "active",
      joinedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    });
    await give(memberId);
    return { memberId };
  },
});

export const record = internalMutation({
  args: { memberId: v.id("members"), eventKey: v.string(), count: v.number(), occurredAt: v.number() },
  returns: v.object({ eventId: v.id("events"), loggedFor: v.string(), late: v.boolean(), duplicate: v.boolean() }),
  handler: async (ctx, args) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    return await recordSystemEvent(ctx, {
      memberId: args.memberId,
      room: "test",
      type: "test.pong",
      payload: { count: args.count },
      occurredAt: args.occurredAt, // fixed by the caller: a retry has the same time, and "same content" includes it
      eventKey: args.eventKey,
    });
  },
});

export const storedWithKey = internalQuery({
  args: { memberId: v.id("members"), keyPrefix: v.string(), day: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const rows = await eventsForDay(ctx, { memberId: args.memberId, day: args.day, includeVoided: true });
    return rows.filter((r) => r.eventKey.startsWith(args.keyPrefix)).length;
  },
});

// `attempts` calls at once with one key (one event must be stored, the rest answer duplicate), then `attempts` calls at once with different
// keys for the same student and day (all stored, the conflicts retried by Convex).
export const race = internalAction({
  args: { memberId: v.id("members"), attempts: v.optional(v.number()) },
  returns: v.object({
    sameKey: v.object({ attempts: v.number(), freshWrites: v.number(), duplicates: v.number(), stored: v.number() }),
    manyKeys: v.object({ attempts: v.number(), freshWrites: v.number(), stored: v.number() }),
  }),
  handler: async (ctx, args): Promise<RaceResult> => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const n = Math.min(Math.max(args.attempts ?? 12, 2), 40);
    const run = `proof:r${Date.now().toString(36)}`;
    const occurredAt = Date.now();
    const day = dayOf(occurredAt);
    const same: Recorded[] = await Promise.all(Array.from({ length: n }, () => ctx.runMutation(internal.eventProof.record, { memberId: args.memberId, eventKey: `${run}-same`, count: 1, occurredAt })));
    const many: Recorded[] = await Promise.all(Array.from({ length: n }, (_, i) => ctx.runMutation(internal.eventProof.record, { memberId: args.memberId, eventKey: `${run}-m${i}`, count: i, occurredAt })));
    const storedSame: number = await ctx.runQuery(internal.eventProof.storedWithKey, { memberId: args.memberId, keyPrefix: `${run}-same`, day });
    const storedMany: number = await ctx.runQuery(internal.eventProof.storedWithKey, { memberId: args.memberId, keyPrefix: `${run}-m`, day });
    return {
      sameKey: { attempts: n, freshWrites: same.filter((r) => !r.duplicate).length, duplicates: same.filter((r) => r.duplicate).length, stored: storedSame },
      manyKeys: { attempts: n, freshWrites: many.filter((r) => !r.duplicate).length, stored: storedMany },
    };
  },
});
