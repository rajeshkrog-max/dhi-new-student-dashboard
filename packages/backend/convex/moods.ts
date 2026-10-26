// The mood room (spec house/0006). A signed in student colours today and may add a few private words, and can change both until the day ends.
// One `moodDays` row a day, and a `mood.logged` event written beside it through the event log (only the mood code, never the words). Every
// function starts with `requireMember`, so the consent gate applies, and then checks the person is a student. No other function reads the table.
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { dayOf } from "./dayRules";
import { currentFor, recordEvent } from "./eventLog";
import { fail } from "./helpers";
import { requireMember, type MemberContext } from "./houseAuth";
import { rateLimiter } from "./limits";
import { isMood, lineIxOf, MAX_MOOD_CHANGES, MAX_NOTE, MONTH_RE, noteLength, noteWords, YEAR_RE } from "./moodRules";

const entry = v.object({ day: v.string(), mood: v.string(), note: v.string(), lineIx: v.number() });
const saved = v.object({ ok: v.literal(true), day: v.string(), mood: v.string(), note: v.string(), lineIx: v.number(), changed: v.boolean() });
const refused = v.object({ ok: v.literal(false), code: v.string() });

// Save today's mood and note. The order is: the entry check and the role, the rate limit (every attempt counts), the validation, the no op
// check, then the write. The browser sends no day: the server reads its clock once and uses it for the day and for the event time.
export const save = mutation({
  args: { mood: v.string(), note: v.string() },
  returns: v.union(saved, refused),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    return await saveFor(ctx, mc, args);
  },
});

// The save itself, for the signed in student (and for the development proof, which calls it as a made up student). The rate limit comes first.
export async function saveFor(
  ctx: MutationCtx,
  mc: Pick<MemberContext, "member" | "role" | "classIds">,
  args: { mood: string; note: string },
): Promise<{ ok: true; day: string; mood: string; note: string; lineIx: number; changed: boolean } | { ok: false; code: string }> {
    const limit = await rateLimiter.limit(ctx, "moodSave", { key: mc.member._id });
    if (!limit.ok) return { ok: false as const, code: "rate_limited" };
    if (!isMood(args.mood)) return { ok: false as const, code: "bad_mood" };
    const note = args.note.trim();
    if (noteLength(note) > MAX_NOTE) return { ok: false as const, code: "note_too_long" };

    const now = Date.now();
    const day = dayOf(now);
    const memberId = mc.member._id;
    const row = await ctx.db.query("moodDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId).eq("day", day)).first();

    if (!row) {
      const id = await ctx.db.insert("moodDays", {
        memberId,
        instituteId: mc.member.instituteId as NonNullable<typeof mc.member.instituteId>,
        day,
        mood: args.mood,
        ...(note ? { note } : {}),
        lineIx: lineIxOf(day),
        changes: 0,
      });
      await recordEvent(ctx, { by: mc, memberId, room: "mood", type: "mood.logged", payload: { mood: args.mood, noteWords: noteWords(note) }, occurredAt: now, eventKey: `mood:${id}-0`, about: `mood:${id}` });
      return { ok: true as const, day, mood: args.mood, note, lineIx: lineIxOf(day), changed: true };
    }

    const moodChanged = row.mood !== args.mood;
    const noteChanged = (row.note ?? "") !== note;
    if (!moodChanged && !noteChanged) return { ok: true as const, day, mood: row.mood, note: row.note ?? "", lineIx: row.lineIx, changed: false };
    if (moodChanged && row.changes >= MAX_MOOD_CHANGES) return { ok: false as const, code: "too_many_changes" };

    if (moodChanged) {
      // A new mood is a new event that replaces the earlier one. A change of the note alone writes no event: the event would be identical.
      const about = `mood:${row._id}`;
      const previous = await currentFor(ctx, { memberId, about, day });
      await recordEvent(ctx, {
        by: mc,
        memberId,
        room: "mood",
        type: "mood.logged",
        payload: { mood: args.mood, noteWords: noteWords(note) },
        occurredAt: now,
        eventKey: `${about}-${row.changes + 1}`,
        about,
        ...(previous ? { replaces: previous._id } : {}),
      });
    }
    await ctx.db.patch(row._id, { mood: args.mood, note: note || undefined, changes: moodChanged ? row.changes + 1 : row.changes });
    return { ok: true as const, day, mood: args.mood, note, lineIx: row.lineIx, changed: true };
}

// One month of the student's own days, oldest first, at most 31. A month with nothing, or a future month, is empty.
export const month = query({
  args: { month: v.string() },
  returns: v.array(entry),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!MONTH_RE.test(args.month)) fail("bad_month");
    const memberId = mc.member._id;
    const from = `${args.month}-01`;
    const to = `${args.month}-31`;
    const rows = await ctx.db
      .query("moodDays")
      .withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId).gte("day", from).lte("day", to))
      .take(31);
    return rows.map((r) => ({ day: r.day, mood: r.mood, note: r.note ?? "", lineIx: r.lineIx }));
  },
});

// A whole year of colours: the day and the mood only, never the words. At most 366.
export const year = query({
  args: { year: v.string() },
  returns: v.array(v.object({ day: v.string(), mood: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    if (!YEAR_RE.test(args.year)) fail("bad_year");
    const memberId = mc.member._id;
    const rows = await ctx.db
      .query("moodDays")
      .withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId).gte("day", `${args.year}-01-01`).lte("day", `${args.year}-12-31`))
      .take(366);
    return rows.map((r) => ({ day: r.day, mood: r.mood }));
  },
});
