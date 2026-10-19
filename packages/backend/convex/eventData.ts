// A person's events, leaving (spec house/0005, AC-12, AC-13, AC-16; spec house/0004, AC-10). The event log is append only for every room, and
// nobody but server code reads it. These two helpers are the only ways a person's events leave: their own download (the type, the day and the id
// of each event, nothing about anyone else) and the erase, the one place an event is deleted. Neither is a Convex function a browser can call.
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export type EventExportRow = { type: string; day: string; id: string };

// A page of the student's events, oldest day first. `cursor` is the paginate cursor of the previous page, null for the first.
export async function exportEventsPage(
  ctx: MutationCtx,
  memberId: Id<"members">,
  cursor: string | null,
  limit: number,
): Promise<{ rows: EventExportRow[]; next: string | null }> {
  const page = await ctx.db
    .query("events")
    .withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", memberId))
    .paginate({ numItems: limit, cursor });
  return { rows: page.page.map((e) => ({ type: e.type, day: e.loggedFor, id: e._id })), next: page.isDone ? null : page.continueCursor };
}

// Deletes up to `limit` of the student's events and says whether any are left.
export async function eraseEventsPage(ctx: MutationCtx, memberId: Id<"members">, limit: number): Promise<{ deleted: number; done: boolean }> {
  const rows = await ctx.db
    .query("events")
    .withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", memberId))
    .take(limit);
  for (const row of rows) await ctx.db.delete("events", row._id);
  return { deleted: rows.length, done: rows.length < limit };
}

// How many events the student has, up to `cap`, for the team's counts. Server code only.
export async function countEvents(ctx: MutationCtx, memberId: Id<"members">, cap: number): Promise<number> {
  return (await ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", memberId)).take(cap)).length;
}
