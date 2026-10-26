// The daily retention job (spec house/0005, AC-15). It deletes view records older than 3 years, erases (as AC-13) every member, staff included,
// who has been removed for 12 months and not reinstated and does not belong to a suspended institute, and deletes expired erase blocks. It works
// in pages and continues itself, so it never reads or writes too much in one transaction; running it twice does the same as running it once.
// Counts only are logged: no names, emails or ids.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { beginErase } from "./eraseCore";
import { CACHE_DAYS } from "./deskRules";

const DAY = 24 * 60 * 60 * 1000;
export const VIEW_LOG_KEEP_MS = 3 * 365 * DAY;
export const LEAVER_KEEP_MS = 365 * DAY;
export const SWEEP_PAGE = 50;
// The study hour chat is kept so a teacher can review it, and then deleted (house spec 0015). 30 days is the builder's default for the owner to confirm.
export const CHAT_KEEP_MS = 30 * DAY;
// A desk answer is served for CACHE_DAYS and then deleted.
export const DESK_CACHE_KEEP_MS = CACHE_DAYS * DAY;
// Erasing a member is heavier than deleting a row (it ends sessions and clears invites), so fewer in one run.
export const ERASE_PER_RUN = 10;

export const sweep = internalMutation({
  args: { now: v.optional(v.number()), cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    let more = false;

    // 1. View records past their 3 years.
    const oldViews = await ctx.db.query("viewLog").withIndex("by_at", (q) => q.lt("at", now - VIEW_LOG_KEEP_MS)).take(SWEEP_PAGE);
    for (const row of oldViews) await ctx.db.delete("viewLog", row._id);
    if (oldViews.length === SWEEP_PAGE) more = true;

    // 2. Erase blocks that have ended.
    const blocks = await ctx.db.query("houseErasedEmails").withIndex("by_until", (q) => q.lt("until", now)).take(SWEEP_PAGE);
    for (const row of blocks) await ctx.db.delete("houseErasedEmails", row._id);
    if (blocks.length === SWEEP_PAGE) more = true;

    // 3. Study hour chat past its 30 days.
    const oldChat = await ctx.db.query("chatMessages").withIndex("by_creation_time", (q) => q.lt("_creationTime", now - CHAT_KEEP_MS)).take(SWEEP_PAGE);
    for (const row of oldChat) await ctx.db.delete("chatMessages", row._id);
    if (oldChat.length === SWEEP_PAGE) more = true;

    // 3a. Desk answers past the 90 days they are served (house spec 0016; review of 2026-10-26): the row goes too, not only its use.
    const oldAnswers = await ctx.db.query("deskCache").withIndex("by_createdAt", (q) => q.lt("createdAt", now - DESK_CACHE_KEEP_MS)).take(SWEEP_PAGE);
    for (const row of oldAnswers) await ctx.db.delete("deskCache", row._id);
    if (oldAnswers.length === SWEEP_PAGE) more = true;

    // 3b. Parent links past their 90 days (house spec 0022). An expired link already refuses; this removes the row.
    const oldLinks = await ctx.db.query("parentLinks").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).take(SWEEP_PAGE);
    for (const row of oldLinks) await ctx.db.delete("parentLinks", row._id);
    if (oldLinks.length === SWEEP_PAGE) more = true;

    // 4. Members removed for 12 months and not reinstated, a page of ${ERASE_PER_RUN} at a time with a cursor that moves on, so rows that are
    // skipped (a suspended institute's members) can never hold up the rest. A reinstated member has status `active`, so the index never offers them,
    // and an erased member (a tombstone) has no `removedAt`.
    const leavers = await ctx.db
      .query("members")
      .withIndex("by_status_and_removedAt", (q) => q.eq("status", "removed").gt("removedAt", 0).lt("removedAt", now - LEAVER_KEEP_MS))
      .paginate({ numItems: ERASE_PER_RUN, cursor: args.cursor ?? null });
    let erased = 0;
    let skipped = 0;
    for (const member of leavers.page) {
      const institute = member.instituteId ? await ctx.db.get(member.instituteId) : null;
      if (institute?.status === "suspended") {
        skipped += 1;
        continue;
      }
      if (await beginErase(ctx, member, { by: "retention", blockEmail: false })) erased += 1;
    }
    if (!leavers.isDone) more = true;

    console.log(`retention.sweep: ${oldViews.length} view record(s), ${blocks.length} block(s), ${oldChat.length} chat message(s), ${oldAnswers.length} desk answer(s), ${oldLinks.length} parent link(s), ${erased} member(s) erased, ${skipped} skipped`);
    // The same `now` goes on, so the next page's query has the same bounds as the one that made the cursor (a cursor is only good for its own query).
    if (more) await ctx.scheduler.runAfter(0, internal.retention.sweep, { now, cursor: leavers.isDone ? null : leavers.continueCursor });
    return null;
  },
});
