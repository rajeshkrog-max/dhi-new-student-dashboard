// The pure rules of the house consent gate (spec house/0005, AC-1, AC-4, AC-5). No database and no clock: consentState.ts reads the facts and this
// decides. A student may enter only with their own agreement to a version in HOUSE_ACCEPTED_VERSIONS and, while the under 18 flag is not a plain
// "no", the school's record of a parent's consent in HOUSE_PARENT_ACCEPTED_VERSIONS, and with no side withdrawn.

export type Side = "self" | "school";
export type Missing = "self" | "parent";

// What the database says about one student, read on every call.
export type ConsentFacts = {
  under18: boolean | undefined;
  selfAgreed: boolean; // a `self` record in HOUSE_ACCEPTED_VERSIONS
  parentOnFile: boolean; // a `parent` record in HOUSE_PARENT_ACCEPTED_VERSIONS
  withdrawn: { self: boolean; school: boolean }; // each side's latest withdrawn or restored record is `withdrawn`
};

export type ConsentGate = { state: "ok" } | { state: "withdrawn"; by: Side[] } | { state: "consentNeeded"; missing: Missing[] };

// A missing flag counts as under 18 (AC-1): the safe way round. Only a plain `false` is an adult.
export const isMinor = (under18: boolean | undefined): boolean => under18 !== false;

// Withdrawn is answered first (AC-1). A parent's withdrawal binds only while the flag says under 18 (AC-4), and comes back by itself if the flag
// goes back to under 18, because the record stays. The student's own side binds whatever the flag says.
export function decideGate(f: ConsentFacts): ConsentGate {
  const by: Side[] = [];
  if (f.withdrawn.self) by.push("self");
  if (f.withdrawn.school && isMinor(f.under18)) by.push("school");
  if (by.length > 0) return { state: "withdrawn", by };
  const missing: Missing[] = [];
  if (!f.selfAgreed) missing.push("self");
  if (isMinor(f.under18) && !f.parentOnFile) missing.push("parent");
  if (missing.length > 0) return { state: "consentNeeded", missing };
  return { state: "ok" };
}

export const isOpen = (g: ConsentGate): boolean => g.state === "ok";
