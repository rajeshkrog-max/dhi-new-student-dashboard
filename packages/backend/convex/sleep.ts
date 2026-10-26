// The sleep room (spec house/0008). A signed in student records last night's sleep: a bed time and a length, for the house day on which it is
// saved. One `sleepNights` row a night, and a `sleep.logged` event written beside it through the event log (only the two numbers). Every function
// starts with `requireMember`, so the consent gate applies, and then checks the person is a student. No other function reads the table.
import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { dayOf } from "./dayRules";
import { currentFor, recordEvent } from "./eventLog";
import { fail } from "./helpers";
import { requireMember, type MemberContext } from "./houseAuth";
import { rateLimiter } from "./limits";
import { isBedMin, isLengthMin, MAX_SLEEP_CHANGES, RECENT_NIGHTS } from "./sleepRules";

const night = v.object({ day: v.string(), bedMin: v.number(), lengthMin: v.number() });
const saved = v.object({ ok: v.literal(true), day: v.string(), bedMin: v.number(), lengthMin: v.number(), changed: v.boolean() });
const refused = v.object({ ok: v.literal(false), code: v.string() });

type SaveResult = { ok: true; day: string; bedMin: number; lengthMin: number; changed: boolean } | { ok: false; code: string };

// Save last night, for the house day on which it is saved. The order is: the entry check and the role, the rate limit (every attempt counts),
// the validation, the no op check, the change cap, then the write. The browser sends no day: the server reads its clock once for the day and the
// event time. The values are stored as `x + 0`, so a `-0` never reaches the row or the event.
export const save = mutation({
  args: { bedMin: v.number(), lengthMin: v.number() },
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
  args: { bedMin: number; lengthMin: number },
): Promise<SaveResult> {
  const limit = await rateLimiter.limit(ctx, "sleepSave", { key: mc.member._id });
  if (!limit.ok) return { ok: false as const, code: "rate_limited" };
  if (!isBedMin(args.bedMin)) return { ok: false as const, code: "bad_time" };
  if (!isLengthMin(args.lengthMin)) return { ok: false as const, code: "bad_length" };
  const bedMin = args.bedMin + 0;
  const lengthMin = args.lengthMin + 0;

  const now = Date.now();
  const day = dayOf(now);
  const memberId = mc.member._id;
  const row = await ctx.db.query("sleepNights").withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId).eq("day", day)).first();

  if (!row) {
    const id = await ctx.db.insert("sleepNights", {
      memberId,
      instituteId: mc.member.instituteId as NonNullable<typeof mc.member.instituteId>,
      day,
      bedMin,
      lengthMin,
      changes: 0,
    });
    await recordEvent(ctx, { by: mc, memberId, room: "sleep", type: "sleep.logged", payload: { bedMin, lengthMin }, occurredAt: now, eventKey: `sleep:${id}-0`, about: `sleep:${id}` });
    return { ok: true as const, day, bedMin, lengthMin, changed: true };
  }

  if (row.bedMin === bedMin && row.lengthMin === lengthMin) return { ok: true as const, day, bedMin, lengthMin, changed: false };
  if (row.changes >= MAX_SLEEP_CHANGES) return { ok: false as const, code: "too_many_changes" };

  // A changed night is a new event that replaces the earlier one, so the night still reads as logged once.
  const about = `sleep:${row._id}`;
  const previous = await currentFor(ctx, { memberId, about, day });
  await recordEvent(ctx, {
    by: mc,
    memberId,
    room: "sleep",
    type: "sleep.logged",
    payload: { bedMin, lengthMin },
    occurredAt: now,
    eventKey: `${about}-${row.changes + 1}`,
    about,
    ...(previous ? { replaces: previous._id } : {}),
  });
  await ctx.db.patch(row._id, { bedMin, lengthMin, changes: row.changes + 1 });
  return { ok: true as const, day, bedMin, lengthMin, changed: true };
}

// The student's newest nights, newest first, at most 30. A night with no row is simply not in the list ("not logged" on the screen).
export const recent = query({
  args: {},
  returns: v.array(night),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const rows = await ctx.db
      .query("sleepNights")
      .withIndex("by_memberId_and_day", (q) => q.eq("memberId", mc.member._id))
      .order("desc")
      .take(RECENT_NIGHTS);
    return rows.map((r) => ({ day: r.day, bedMin: r.bedMin, lengthMin: r.lengthMin }));
  },
});
