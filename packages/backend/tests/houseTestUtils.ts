// Helpers for the house suites (spec house/0002): people at each role, made the way the real flow makes them (the owner's bootstrap invite, a
// claim, then invites by staff and a claim by each person). Not application code.
import { api, internal } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { CONSENT_TEXTS, HOUSE_NOTICE_VERSION, consentHash } from "../convex/consentText";
import { signInAs, type Backend } from "./convexTestUtils";

export type Person = Awaited<ReturnType<typeof signInAs>> & { memberId: Id<"members"> };

const must = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`);
  return r as Extract<T, { ok: true }>;
};

// A signed in person who presses Join for the invite that holds their address.
export async function joinAs(t: Backend, email: string, opts: { name?: string; emailVerified?: boolean } = {}): Promise<Person> {
  const s = await signInAs(t, { email, name: opts.name, emailVerified: opts.emailVerified });
  const r = must(await s.as.mutation(api.members.claimInvite, {}));
  return { ...s, memberId: r.memberId };
}

export async function makeDhiAdmin(t: Backend, email = "owner@example.com"): Promise<Person> {
  await t.mutation(internal.bootstrap.dhiAdmin, { email, name: "Owner" });
  return await joinAs(t, email, { name: "Owner" });
}

// An institute with its first admin, who has joined.
export async function makeInstitute(t: Backend, owner: Person, name = "Greenfield School", adminEmail = "head@greenfield.test") {
  const { instituteId } = await owner.as.mutation(api.institutes.create, { name });
  must(await owner.as.mutation(api.invites.create, { role: "institute_admin", email: adminEmail, name: "Head Teacher", instituteId }));
  const admin = await joinAs(t, adminEmail, { name: "Head Teacher" });
  return { instituteId, admin };
}

export async function makeClass(admin: Person, grade: "Class 8" | "Class 9" | "Class 10" | "Class 11" | "Class 12" | "College" = "Class 10", section = "A", instituteId?: Id<"institutes">) {
  const { classId } = await admin.as.mutation(api.classes.create, { grade, section, ...(instituteId ? { instituteId } : {}) });
  return classId;
}

export async function makeTeacher(t: Backend, admin: Person, email = "teacher@greenfield.test", classIds: Id<"classes">[] = []) {
  must(await admin.as.mutation(api.invites.create, { role: "teacher", email, name: "Test Teacher" }));
  const teacher = await joinAs(t, email, { name: "Test Teacher" });
  for (const classId of classIds) await admin.as.mutation(api.classes.assignTeacher, { classId, memberId: teacher.memberId });
  return teacher;
}

// A student agrees to the house notice, and for an under 18 the institute admin records the parent's consent on file (spec house/0005).
export async function giveConsent(student: Person, admin: Person | null) {
  must(await student.as.mutation(api.consent.agree, { version: HOUSE_NOTICE_VERSION, hash: await consentHash(CONSENT_TEXTS[HOUSE_NOTICE_VERSION]) }));
  if (admin) must(await admin.as.mutation(api.consent.recordParent, { memberIds: [student.memberId] }));
}

// A student who has joined and is through consent, so the house suites that are not about consent can use the rooms. `consent: false` leaves
// them at the gate. The institute admin passed as `inviter` records the parent's consent for an under 18; a DHI admin inviter cannot, so those
// callers pass `parentBy`.
export async function makeStudent(
  t: Backend,
  inviter: Person,
  classId: Id<"classes">,
  email = "asha@greenfield.test",
  under18 = false,
  opts: { consent?: boolean; parentBy?: Person } = {},
) {
  must(await inviter.as.mutation(api.invites.create, { role: "student", email, name: "Asha Rao", classId, under18 }));
  const student = await joinAs(t, email, { name: "Asha Rao" });
  if (opts.consent !== false) await giveConsent(student, under18 ? (opts.parentBy ?? inviter) : null);
  return student;
}

export const refusal = async (p: Promise<unknown>): Promise<string> => {
  try {
    const r = (await p) as { ok?: boolean; code?: string } | null;
    if (r && r.ok === false) return r.code ?? "refused";
    return "ok";
  } catch (e) {
    const data = (e as { data?: { code?: string } }).data;
    return data?.code ?? `error:${String((e as Error).message).slice(0, 60)}`;
  }
};
