// Reading and writing a student's consent records (spec house/0005). The pure decision is in consentRules.ts; this file reads the facts on every
// call (so a withdrawal or an age correction takes effect on the very next call) and inserts the append only records. Rows are never changed here.
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { CONSENT_KINDS, CONSENT_TEXTS, HOUSE_ACCEPTED_VERSIONS, HOUSE_PARENT_ACCEPTED_VERSIONS, consentHash, type ConsentKind } from "./consentText";
import { decideGate, isMinor, type ConsentFacts, type ConsentGate, type Side } from "./consentRules";

type Reader = QueryCtx | MutationCtx;

// A student agrees once for each version, and a school records once for each version, so a handful of rows is the most that is ever scanned.
const SCAN = 10;

async function hasAccepted(ctx: Reader, member: Doc<"members">, kind: "self" | "parent", accepted: readonly string[]): Promise<boolean> {
  const rows = await ctx.db
    .query("consentRecords")
    .withIndex("by_memberId_and_kind", (q) => q.eq("memberId", member._id).eq("kind", kind))
    .order("desc")
    .take(SCAN);
  return rows.some((r) => accepted.includes(r.textVersion));
}

// Whether a side is withdrawn: its latest `withdrawn` or `restored` record, in creation order, is `withdrawn`.
export async function sideWithdrawn(ctx: Reader, member: Doc<"members">, side: Side): Promise<boolean> {
  const latest = await ctx.db
    .query("consentRecords")
    .withIndex("by_memberId_and_by", (q) => q.eq("memberId", member._id).eq("by", side))
    .order("desc")
    .filter((q) => q.or(q.eq(q.field("kind"), "withdrawn"), q.eq(q.field("kind"), "restored")))
    .first();
  return latest?.kind === "withdrawn";
}

export async function consentFacts(ctx: Reader, member: Doc<"members">): Promise<ConsentFacts> {
  const [selfAgreed, parentOnFile, self, school] = await Promise.all([
    hasAccepted(ctx, member, "self", HOUSE_ACCEPTED_VERSIONS),
    hasAccepted(ctx, member, "parent", HOUSE_PARENT_ACCEPTED_VERSIONS),
    sideWithdrawn(ctx, member, "self"),
    sideWithdrawn(ctx, member, "school"),
  ]);
  return { under18: member.under18, selfAgreed, parentOnFile, withdrawn: { self, school } };
}

// The gate for one student. Only a student has one: everyone else is `ok` (teachers, institute admins, DHI admins and counselors are not gated).
export async function gateOf(ctx: Reader, member: Doc<"members">): Promise<ConsentGate> {
  if (member.role !== "student") return { state: "ok" };
  return decideGate(await consentFacts(ctx, member));
}

// Whether the school has a parent record on file and has not withdrawn it, for the school's screen (AC-20: only the school's own side).
export async function parentSideOf(ctx: Reader, member: Doc<"members">): Promise<"needed" | "onFile" | "schoolWithdrew"> {
  if (await sideWithdrawn(ctx, member, "school")) return "schoolWithdrew";
  return (await hasAccepted(ctx, member, "parent", HOUSE_PARENT_ACCEPTED_VERSIONS)) ? "onFile" : "needed";
}

// A wording version's exact lines are stored the first time it is used, as the funnel does, so a record always points at text that exists. The
// stored text and fingerprint are never edited. Returns the fingerprint of the stored text.
export async function ensureConsentText(ctx: MutationCtx, version: string, kind: ConsentKind): Promise<string> {
  if (CONSENT_KINDS[version] !== kind) throw new Error("wrong kind for this wording");
  const text = CONSENT_TEXTS[version];
  const hash = await consentHash(text);
  const stored = await ctx.db.query("consentTexts").withIndex("by_version", (q) => q.eq("version", version)).first();
  if (!stored) await ctx.db.insert("consentTexts", { version, hash, text });
  return hash;
}

export { isMinor };
