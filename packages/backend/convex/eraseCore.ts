// Erasing a person from the house (spec house/0005, AC-13, AC-15). Step one is atomic and makes the person invisible and locked at once: the
// `members` row becomes a tombstone, their sharing setting goes, their sessions end, the invites for their email are cleared, and the work of
// step two is queued. Step two (dataRights.eraseStep) deletes their events and every room's rows in self scheduled pages and writes one receipt of
// counts. Nothing here logs a name, an email or a count tied to a person: receipts and the access log hold counts, codes and ids only (AC-19).
import { components, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { env, type MutationCtx, type QueryCtx } from "./_generated/server";
import { logAccess } from "./houseAuth";
import { deleteLinks } from "./parentLinkCore";

export const BLOCK_DAYS = 30;
export const BLOCK_MS = BLOCK_DAYS * 24 * 60 * 60 * 1000;

export type EraseBy = "self" | "team" | "retention";

// HMAC SHA 256 of the trimmed lowercase email, as lowercase hex, keyed by ERASURE_HASH_SECRET. The email itself is never stored for the block.
export async function emailHash(secret: string, email: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(email.trim().toLowerCase()));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Whether this address is inside the 30 day block after a student's own erase. With no secret set there is no block to read.
export async function emailBlocked(ctx: Pick<QueryCtx, "db">, email: string): Promise<boolean> {
  const secret = env.ERASURE_HASH_SECRET;
  if (!secret) return false;
  const hash = await emailHash(secret, email);
  const rows = await ctx.db.query("houseErasedEmails").withIndex("by_hash", (q) => q.eq("hash", hash)).take(5);
  const now = Date.now();
  return rows.some((r) => r.until > now);
}

// Ends the sessions of a sign in account, and deletes the account itself only when the person has no funnel profile (the funnel's `students`
// row). A person with a profile keeps the account so the funnel is untouched (AC-13). Each delete is a small page.
async function endAccount(ctx: MutationCtx, authUserId: string, email: string): Promise<{ accountDeleted: boolean }> {
  const del = async (model: "session" | "account" | "verification" | "user", field: string, value: string) => {
    await ctx.runMutation(components.betterAuth.adapter.deleteMany, {
      input: { model, where: [{ field, operator: "eq" as const, value }] } as never,
      paginationOpts: { numItems: 100, cursor: null },
    });
  };
  await del("session", "userId", authUserId);
  const profile = await ctx.db.query("students").withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId)).first();
  if (profile) return { accountDeleted: false };
  await del("account", "userId", authUserId);
  if (email) await del("verification", "identifier", email);
  await del("user", "_id", authUserId);
  return { accountDeleted: true };
}

// Clears every invite for the address: a pending one is revoked, and each loses its name and email.
async function clearInvites(ctx: MutationCtx, email: string, now: number): Promise<number> {
  if (!email) return 0;
  let cleared = 0;
  const rows = await ctx.db.query("invites").withIndex("by_email_and_claimedAt", (q) => q.eq("email", email)).take(50);
  for (const invite of rows) {
    await ctx.db.patch(invite._id, {
      email: "",
      name: "",
      ...(invite.claimedAt === undefined && invite.revokedAt === undefined ? { revokedAt: now } : {}),
    });
    cleared += 1;
  }
  return cleared;
}

// Step one. Returns false when the person is already erased (nothing is done twice). `blockEmail` is true only for a student's own erase.
export async function beginErase(ctx: MutationCtx, member: Doc<"members">, opts: { by: EraseBy; blockEmail: boolean }): Promise<boolean> {
  if (member.erasedAt !== undefined) return false;
  const now = Date.now();
  const email = member.email;
  const authUserId = member.authUserId;

  if (opts.blockEmail && email && env.ERASURE_HASH_SECRET) {
    const hash = await emailHash(env.ERASURE_HASH_SECRET, email);
    await ctx.db.insert("houseErasedEmails", { hash, until: now + BLOCK_MS });
  }
  const setting = await ctx.db.query("sharingSettings").withIndex("by_memberId", (q) => q.eq("memberId", member._id)).first();
  if (setting) await ctx.db.delete("sharingSettings", setting._id);
  await deleteLinks(ctx, member._id);
  const funnel = await ctx.db.query("funnelLinks").withIndex("by_memberId", (q) => q.eq("memberId", member._id)).first();
  if (funnel) await ctx.db.delete("funnelLinks", funnel._id);
  const classes = await ctx.db.query("teacherClasses").withIndex("by_memberId", (q) => q.eq("memberId", member._id)).take(200);
  for (const row of classes) await ctx.db.delete("teacherClasses", row._id);

  await clearInvites(ctx, email, now);
  await endAccount(ctx, authUserId, email);

  // The tombstone keeps the role, institute, class and under 18 flag as the proof of what consent applied, and nothing that names the person.
  // `removedAt` is cleared so the 12 month sweep never meets it again.
  await ctx.db.patch(member._id, {
    status: "removed",
    erasedAt: now,
    name: "",
    email: "",
    authUserId: `erased:${member._id}`,
    removedAt: undefined,
  });
  await logAccess(ctx, {
    actor: opts.by === "self" ? member._id : "owner",
    action: "data.erase",
    instituteId: member.instituteId,
    targetMemberId: member._id,
  });
  await ctx.scheduler.runAfter(0, internal.dataRights.eraseStep, { memberId: member._id, by: opts.by, stage: 0, counts: {} });
  return true;
}

