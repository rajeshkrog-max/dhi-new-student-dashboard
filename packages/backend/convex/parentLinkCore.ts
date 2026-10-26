// The shared steps of the parent's private link (spec house/0022). The code is 24 random bytes as 48 lowercase hex characters, shown to the student once;
// only its SHA 256 is stored. These are server helpers, not Convex functions.
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { logAccess } from "./houseAuth";

export const LINK_DAYS = 90;
export const LINK_MS = LINK_DAYS * 24 * 60 * 60 * 1000;
// A look through the link is written to the student's own record at most once an hour for one link, so a refreshing page does not fill it.
export const LOOK_LOG_GAP_MS = 60 * 60 * 1000;
export const CODE_RE = /^[a-f0-9]{48}$/;

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

export function newCode(): string {
  return hex(crypto.getRandomValues(new Uint8Array(24)));
}

export async function hashCode(code: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code))));
}

// Deletes every link of a student and says how many there were. No record: the erase writes its own, and `dropLinks` writes the student's.
export async function deleteLinks(ctx: MutationCtx, memberId: Id<"members">): Promise<number> {
  const rows = await ctx.db.query("parentLinks").withIndex("by_memberId", (q) => q.eq("memberId", memberId)).take(10);
  for (const row of rows) await ctx.db.delete("parentLinks", row._id);
  return rows.length;
}

// Ends the student's link and writes one access log row if there was one.
export async function dropLinks(ctx: MutationCtx, member: Doc<"members">): Promise<boolean> {
  const removed = await deleteLinks(ctx, member._id);
  if (removed > 0) await logAccess(ctx, { actor: member._id, action: "sharing.unlink", instituteId: member.instituteId, targetMemberId: member._id });
  return removed > 0;
}
