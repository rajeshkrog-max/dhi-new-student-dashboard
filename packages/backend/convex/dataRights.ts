// A person's rights over their house data (spec house/0005, AC-12, AC-13): download it, and erase it. Both stay open to a student who is locked,
// removed, or in a paused institute (they are data rights), through the lock tolerant entry check. The export is built in pages, never one read.
// The erase is invisible at once and complete eventually: `beginErase` (eraseCore.ts) is the atomic first step, and `eraseStep` below deletes the
// rest in self scheduled pages and writes one receipt of counts only. The team's two commands run from a terminal and print counts only.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { env, internalMutation, mutation } from "./_generated/server";
import { EXPORT_SCHEMA } from "./dataMap";
import { countEvents, eraseEventsPage, exportEventsPage } from "./eventData";
import { beginErase } from "./eraseCore";
import { fail } from "./helpers";
import { requireMemberAllowLocked } from "./houseAuth";
import { rateLimiter } from "./limits";
import { ERASE_PAGE, EXPORT_PAGE, ROOM_ENTRIES } from "./roomRegistry";

const refusal = v.object({ ok: v.literal(false), code: v.string() });

// The pages of the download, in order: the header (profile, consent, sharing), the events, then each registered room. `cursor` is opaque to the
// caller: pass back `next` until it is null, and join the sections into one file.
type Cursor = { s: number; c: string | null };
const encode = (c: Cursor): string => JSON.stringify(c);
function decode(raw: string | null | undefined): Cursor | null {
  if (raw === null || raw === undefined) return { s: -1, c: null };
  try {
    const c = JSON.parse(raw) as Cursor;
    return Number.isInteger(c.s) && c.s >= 0 && c.s <= ROOM_ENTRIES.length && (c.c === null || typeof c.c === "string") ? c : null;
  } catch {
    return null;
  }
}

export const exportMine = mutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.union(
    v.object({
      ok: v.literal(true),
      schema: v.string(),
      exportedAt: v.number(),
      section: v.string(),
      rows: v.array(v.any()),
      next: v.union(v.string(), v.null()),
    }),
    refusal,
  ),
  handler: async (ctx, args) => {
    const mc = await requireMemberAllowLocked(ctx, { inactive: true });
    if (mc.role !== "student") fail("forbidden");
    const memberId = mc.member._id;
    const cur = decode(args.cursor);
    if (!cur) return { ok: false as const, code: "bad_cursor" };
    const exportedAt = Date.now();
    if (cur.s !== -1) {
      const pages = await rateLimiter.limit(ctx, "dataExportPage", { key: memberId });
      if (!pages.ok) return { ok: false as const, code: "rate_limited" };
    }

    // Starting an export uses one of the 5 an hour; the pages of one export are free.
    if (cur.s === -1) {
      const limit = await rateLimiter.limit(ctx, "dataExport", { key: memberId });
      if (!limit.ok) return { ok: false as const, code: "rate_limited" };
      const cls = mc.member.classId ? await ctx.db.get(mc.member.classId) : null;
      const consent = await ctx.db.query("consentRecords").withIndex("by_memberId_and_kind", (q) => q.eq("memberId", memberId)).take(200);
      const sharing = await ctx.db.query("sharingSettings").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).first();
      const header = {
        profile: {
          name: mc.member.name,
          email: mc.member.email,
          role: mc.member.role,
          institute: mc.institute?.name ?? null,
          class: cls ? `${cls.grade} ${cls.section}` : null,
          under18: mc.member.under18 ?? null,
          joinedAt: mc.member.joinedAt,
        },
        consent: consent.map((r) => ({ kind: r.kind, by: r.by, textVersion: r.textVersion, at: r._creationTime })),
        sharing: { parentLevel: sharing?.parentLevel ?? "none" },
      };
      return { ok: true as const, schema: EXPORT_SCHEMA, exportedAt, section: "header", rows: [header], next: encode({ s: 0, c: null }) };
    }

    if (cur.s === 0) {
      const page = await exportEventsPage(ctx, memberId, cur.c, EXPORT_PAGE);
      const next = page.next !== null ? encode({ s: 0, c: page.next }) : ROOM_ENTRIES.length > 0 ? encode({ s: 1, c: null }) : null;
      return { ok: true as const, schema: EXPORT_SCHEMA, exportedAt, section: "events", rows: page.rows, next };
    }

    const entry = ROOM_ENTRIES[cur.s - 1];
    const page = await entry.exporter(ctx, memberId, cur.c, EXPORT_PAGE);
    const next = page.next !== null ? encode({ s: cur.s, c: page.next }) : cur.s < ROOM_ENTRIES.length ? encode({ s: cur.s + 1, c: null }) : null;
    return { ok: true as const, schema: EXPORT_SCHEMA, exportedAt, section: entry.room, rows: page.rows, next };
  },
});

// The student erases their own house data after a two step confirm on the screen (`confirm: true` is the second step). Invisible at once; the
// rest finishes in the background. The same email is blocked for 30 days. Needs ERASURE_HASH_SECRET, or it refuses before doing anything.
export const eraseMine = mutation({
  args: { confirm: v.literal(true) },
  returns: v.union(v.object({ ok: v.literal(true) }), refusal),
  handler: async (ctx) => {
    const mc = await requireMemberAllowLocked(ctx, { inactive: true });
    if (mc.role !== "student") fail("forbidden");
    if (!env.ERASURE_HASH_SECRET) return { ok: false as const, code: "erase_not_configured" };
    const began = await beginErase(ctx, mc.member, { by: "self", blockEmail: true });
    return began ? { ok: true as const } : { ok: false as const, code: "erase_failed" };
  },
});

// Step two: delete the events, then each registered room's rows, a page at a time, and write one receipt of counts. Idempotent: running a stage
// again finds nothing left. Only the schedule calls it.
export const eraseStep = internalMutation({
  args: { memberId: v.id("members"), by: v.union(v.literal("self"), v.literal("team"), v.literal("retention")), stage: v.number(), counts: v.record(v.string(), v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const counts = { ...args.counts };
    let stage = args.stage;
    if (stage === 0) {
      const r = await eraseEventsPage(ctx, args.memberId, ERASE_PAGE);
      counts.events = (counts.events ?? 0) + r.deleted;
      if (r.done) stage = 1;
    } else if (stage <= ROOM_ENTRIES.length) {
      const entry = ROOM_ENTRIES[stage - 1];
      const r = await entry.eraser(ctx, args.memberId, ERASE_PAGE);
      counts[entry.room] = (counts[entry.room] ?? 0) + r.deleted;
      if (r.done) stage += 1;
    }
    if (stage > ROOM_ENTRIES.length) {
      await ctx.db.insert("houseErasures", { at: Date.now(), by: args.by, counts });
      return null;
    }
    await ctx.scheduler.runAfter(0, internal.dataRights.eraseStep, { memberId: args.memberId, by: args.by, stage, counts });
    return null;
  },
});

// ---- The team's commands (from a terminal; counts only) ----
// An erase on a parent's request for a student under 18. Needs three facts to match: the student's Google email, the school's name and the class
// as "grade section". Anything wrong answers the same `no_match`, so nothing is learned about who exists. An adult is `no_match` too.
const matchArgs = { email: v.string(), school: v.string(), class: v.string(), note: v.optional(v.string()) };

async function findMatch(ctx: Parameters<typeof beginErase>[0], args: { email: string; school: string; class: string }) {
  const email = args.email.trim().toLowerCase();
  const member = email ? await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", email)).first() : null;
  if (!member || member.role !== "student" || member.erasedAt !== undefined || member.under18 !== true) return null;
  const institute = member.instituteId ? await ctx.db.get(member.instituteId) : null;
  const cls = member.classId ? await ctx.db.get(member.classId) : null;
  if (!institute || !cls) return null;
  if (institute.nameKey !== args.school.trim().toLowerCase().replace(/\s+/g, " ")) return null;
  const label = `${cls.grade} ${cls.section}`.toLowerCase();
  if (label !== args.class.trim().toLowerCase().replace(/\s+/g, " ")) return null;
  return member;
}

export const adminErase = internalMutation({
  args: matchArgs,
  returns: v.union(v.object({ ok: v.literal(true) }), refusal),
  handler: async (ctx, args) => {
    if (!env.ERASURE_HASH_SECRET) return { ok: false as const, code: "erase_not_configured" };
    const member = await findMatch(ctx, args);
    if (!member) return { ok: false as const, code: "no_match" };
    await beginErase(ctx, member, { by: "team", blockEmail: false });
    return { ok: true as const };
  },
});

// Counts of what a student has, so the team can answer a parent without reading any of it.
export const adminExport = internalMutation({
  args: matchArgs,
  returns: v.union(v.object({ ok: v.literal(true), counts: v.record(v.string(), v.number()) }), refusal),
  handler: async (ctx, args) => {
    const member = await findMatch(ctx, args);
    if (!member) return { ok: false as const, code: "no_match" };
    const id: Id<"members"> = member._id;
    const events = await countEvents(ctx, id, 1000); // counts up to 1000, to stay inside one read
    const consent = (await ctx.db.query("consentRecords").withIndex("by_memberId_and_kind", (q) => q.eq("memberId", id)).take(1000)).length;
    return { ok: true as const, counts: { events, consent } };
  },
});
