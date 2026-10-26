// The pure rules of the house's people, roles and invites (spec house/0002). No database here, so every rule can be tested alone and the
// functions in members.ts, invites.ts, classes.ts and institutes.ts stay thin. Nothing in this file reads the clock: callers pass `now`.

export type Role = "student" | "teacher" | "institute_admin" | "dhi_admin" | "counselor";
export type Grade = "Class 8" | "Class 9" | "Class 10" | "Class 11" | "Class 12" | "College";

export const DAY_MS = 24 * 60 * 60 * 1000;
// An invite lives 14 days from creation or from the last extend.
export const INVITE_DAYS = 14;
export const INVITE_MS = INVITE_DAYS * DAY_MS;
// The most refused "address in use" answers an institute may have in a day (the rate limit `emailInUse` in limits.ts).
export const IN_USE_PER_DAY = 50;
// One class list is checked as a whole, up to this many rows.
export const BATCH_MAX = 300;
// Every list the house returns is a page of this many rows.
export const PAGE_SIZE = 25;
// A test sign in has no verified Google email, so it may claim an invite only for an address that can never be a real inbox.
export const TEST_INBOX_SUFFIX = "@example.test";

export const STAFF_ROLES: Role[] = ["teacher", "institute_admin", "dhi_admin"];
// Roles that belong to an institute. dhi_admin and counselor belong to none.
export const INSTITUTE_ROLES: Role[] = ["student", "teacher", "institute_admin"];

export const isStaffRole = (role: Role) => STAFF_ROLES.includes(role);
export const belongsToInstitute = (role: Role) => INSTITUTE_ROLES.includes(role);

// Who may invite which role (spec house/0002, "Who sets up whom"). A DHI admin invites anyone, an institute admin invites teachers and
// students of their own institute, a teacher invites students into their own classes. Nobody else invites.
export function canInviteRole(actor: Role, target: Role): boolean {
  if (actor === "dhi_admin") return true;
  if (actor === "institute_admin") return target === "teacher" || target === "student";
  if (actor === "teacher") return target === "student";
  return false;
}

// Lowercase and trim an email, or null when it does not look like one. A deliberately plain check: the real proof is that the invited person
// signs in with that very address (Google says it is verified), so this only stops typing mistakes.
const EMAIL_RE = /^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']+$/;
export function normaliseEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (email.length < 5 || email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function isTestInbox(email: string): boolean {
  return email.endsWith(TEST_INBOX_SUFFIX);
}

// A session whose Google email is not verified may claim only on a test sign in deployment, only for a test inbox, and never a DHI admin or
// counselor invite (AC-6).
export function mayClaimUnverified(opts: { testSignin: boolean; email: string; role: Role }): boolean {
  return opts.testSignin && isTestInbox(opts.email) && opts.role !== "dhi_admin" && opts.role !== "counselor";
}

export function isExpired(invite: { expiresAt: number }, now: number): boolean {
  return now > invite.expiresAt;
}

// The member shape rules, checked in code on every write (spec house/0002, Feature design). Returns a short reason, or null when fine.
export function memberShapeProblem(m: { role: Role; instituteId?: unknown; classId?: unknown; under18?: unknown }): string | null {
  if (belongsToInstitute(m.role) && m.instituteId === undefined) return "institute_required";
  if (!belongsToInstitute(m.role) && m.instituteId !== undefined) return "institute_not_allowed";
  if (m.role !== "student" && (m.classId !== undefined || m.under18 !== undefined)) return "student_only_fields";
  return null;
}

// "Class 9 A", "9A", "class 10-b", "10/C" and "College B" all read as a grade and a section. The section is a short plain word. Null when
// the text is not a class (spec house/0002: the class column is matched to an existing class by grade and section; classes are never made
// by an upload).
export function parseClassLabel(raw: string): { grade: Grade; section: string } | null {
  const text = raw.trim().replace(/\s+/g, " ");
  const school = /^(?:class\s*)?(8|9|10|11|12)\s*[-/ ]?\s*([A-Za-z0-9]{1,12})$/i.exec(text);
  if (school) return { grade: `Class ${school[1]}` as Grade, section: school[2] };
  const college = /^college\s*[-/ ]?\s*([A-Za-z0-9]{1,12})$/i.exec(text);
  if (college) return { grade: "College", section: college[1] };
  return null;
}

// Sections are compared without regard to case or spaces, so "a" and "A" are one section.
export const sectionKey = (section: string) => section.trim().toLowerCase();

export const MAX_SECTION = 12;
export function cleanSection(raw: string): string | null {
  const section = raw.trim().replace(/\s+/g, " ");
  return /^[A-Za-z0-9]{1,12}$/.test(section) ? section : null;
}

export type BatchRowInput = { name: string; email: string; class: string; under18: boolean | undefined | null };
// `not_checked`: the list already named a day's worth of addresses that cannot be invited, so the later rows were not looked up (AC-19).
export type BadRowReason = "bad_name" | "bad_email" | "duplicate_in_file" | "email_in_use" | "class_not_found" | "class_not_in_scope" | "under18_missing" | "not_checked";
export type BadRow = { row: number; reason: BadRowReason };

// Everything in a class list row that needs no database: the name, the address, a repeat inside the file and the yes or no. The first reason
// found is the one reported for a row. `seen` holds the addresses of the rows before this one.
export function checkRowShape(
  row: BatchRowInput,
  seen: Set<string>,
  cleanName: (raw: string) => string | null,
): { ok: true; name: string; email: string; under18: boolean } | { ok: false; reason: BadRowReason } {
  const name = cleanName(row.name);
  if (!name) return { ok: false, reason: "bad_name" };
  const email = normaliseEmail(row.email);
  if (!email) return { ok: false, reason: "bad_email" };
  if (seen.has(email)) return { ok: false, reason: "duplicate_in_file" };
  seen.add(email);
  if (typeof row.under18 !== "boolean") return { ok: false, reason: "under18_missing" };
  return { ok: true, name, email, under18: row.under18 };
}

// The whole list of fixed codes an access log row may carry (AC-12).
export const ACCESS_CODES = [
  "invite.create",
  "invite.claim",
  "invite.revoke",
  "invite.extend",
  "invite.update",
  "member.remove",
  "member.reinstate",
  "member.class",
  "member.under18",
  "member.move",
  "class.create",
  "class.archive",
  "class.pause",
  "class.resume",
  "class.assign",
  "class.unassign",
  "inst.create",
  "inst.suspend",
  "inst.reinstate",
  "consent.parent",
  "consent.parentWithdrawn",
  "consent.parentRestored",
  "sharing.set",
  "sharing.link",
  "sharing.unlink",
  "data.erase",
  "totals.read",
] as const;
export type AccessCode = (typeof ACCESS_CODES)[number];
