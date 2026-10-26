import type { HouseRole } from "@/lib/entry";

// The words the house screens use for people and for every refusal the server can send (spec house/0002). Plain, calm and short. The words for
// an address that cannot be invited never say whether it is a member or already invited (AC-19).
export const ROLE_LABEL: Record<HouseRole, string> = {
  student: "Student",
  teacher: "Teacher",
  institute_admin: "Institute admin",
  dhi_admin: "DHI admin",
  counselor: "Counselor",
};

const WORDS: Record<string, string> = {
  rate_limited: "That was too many tries for now. Please wait a little and try again.",
  email_in_use: "That email cannot be invited. Please check it, or ask a DHI admin.",
  no_invite: "We could not find an invite for this Google email.",
  email_not_verified: "Google has not verified this email address yet.",
  invite_expired: "This invite has run out. Ask your institute to extend it.",
  institute_suspended: "This institute is paused for now.",
  class_archived: "This class is closed.",
  bad_name: "Please write a name.",
  bad_email: "That does not look like an email address.",
  bad_section: "A section is a short word or letter, for example A.",
  under18_missing: "Please say yes or no for under 18.",
  class_not_found: "We could not find that class.",
  class_not_in_scope: "That class is not one of yours.",
  class_exists: "That class already exists.",
  class_in_use: "Students are still in this class. Move them first.",
  institute_not_found: "Please choose an institute first.",
  forbidden: "You cannot do that.",
  not_found: "We could not find that.",
  not_a_teacher: "Only a teacher can be given a class.",
  last_admin: "This is the last admin, so they cannot be removed or moved.",
  not_staff: "Only a teacher or an institute admin can be moved. A student who changes school is paused here and invited again at the new school.",
  same_institute: "That person is already in this institute.",
  no_profile: "We could not find a DhiRise check for this Google account.",
  name_taken: "An institute with that name already exists.",
  invite_not_pending: "This invite has already been used or cleared.",
  too_many_rows: "A class list can have up to 300 rows.",
  empty: "The list is empty.",
  bad_rows: "Some rows need fixing. Nothing was invited yet.",
  removed: "Your access is paused. Please ask your institute.",
  not_a_member: "You are not in a house yet.",
  not_signed_in: "Please sign in again.",
  // Consent and your data (spec house/0005)
  consent_required: "Please agree to the house notice first.",
  consent_withdrawn: "Consent is withdrawn, so the house is paused for you.",
  consent_text_changed: "The notice changed. Please read it again and then agree.",
  not_withdrawn_by_you: "Your school withdrew this, so only your school can bring it back.",
  not_under18: "Only a student marked under 18 needs a parent record.",
  too_many: "Please send up to 50 students at a time.",
  bad_request: "Please choose students or a class.",
  bad_cursor: "That download could not continue. Please start again.",
  erase_not_configured: "Erasing is not switched on yet. Please write to privacy@dhirise.com.",
  erase_failed: "We could not erase your data just now. Please try again.",
  // Papers, exams and the blog (spec house/0011, house/0012, house/0014)
  slow_down: "That was a lot in a short time. Please wait a little and try again.",
  bad_title: "Please write a title, up to 120 characters.",
  bad_question: "Each question needs a subject, a topic and its text. A multiple choice question needs 2 to 6 options with one right option.",
  bad_hint: "A hint must be 300 characters or fewer, and it must not give the answer away.",
  bad_window: "A paper must open before it is due, at least a minute apart, not more than 14 days, and its due time must still be ahead.",
  class_paused: "This class is paused for now, so a paper cannot be sent to it.",
  bad_mark: "A mark is a whole number from 0 up to the question's maximum.",
  bad_remarks: "Remarks can be up to 1000 characters.",
  not_submitted: "That paper has not been submitted yet.",
  not_marked: "Save the marks first, then confirm them.",
};

export function refusalWords(code: string | undefined): string {
  return (code && WORDS[code]) || "Something went wrong. Please try again.";
}

// Reasons a row of a class list can be refused, each in one line.
export const BAD_ROW_WORDS: Record<string, string> = {
  bad_name: "The name is missing or too long.",
  bad_email: "The email does not look right.",
  duplicate_in_file: "This email is in the list twice.",
  email_in_use: "This email cannot be invited.",
  class_not_found: "The class does not match a class of this institute.",
  class_not_in_scope: "The class is not one of yours.",
  under18_missing: "Under 18 needs a yes or a no.",
};

export function badRowWords(reason: string): string {
  return BAD_ROW_WORDS[reason] ?? "This row needs fixing.";
}

// The error a Convex call threw, as the code the server gave, or undefined.
export function codeOf(error: unknown): string | undefined {
  const data = (error as { data?: unknown } | null)?.data;
  if (data && typeof data === "object" && "code" in data) return String((data as { code: unknown }).code);
  return undefined;
}
