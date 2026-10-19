// Where a visitor goes at the front door (spec 0008). The shared account already holds the interview (the DhiRise check the funnel runs), so
// the door only reads it: a student who finished the check goes to the dashboard, anyone else goes to the interview, and nobody is asked
// to fill in anything the house already knows.

// The funnel's first interview page. The funnel keeps `/dhiinterviews*` on the same address (spec 0004), so this is a plain path.
export const INTERVIEW_PATH = "/dhiinterviews/landing.html";
export const DASHBOARD_PATH = "/dashboard";
export const ENTER_PATH = "/enter";

// The part of `students.me` the door reads. The real answer has more; this stays small so the rule is easy to test.
export type EntryMe =
  | { state: "signedOut" }
  | { state: "needsProfile" }
  | { state: "ready"; check: { completedAt: number | null } };

export type EntryAuth = { isLoading: boolean; isAuthenticated: boolean };

export type EntryTarget = "waiting" | "sign-in" | "interview" | "dashboard";

// `me` is `undefined` while it is being asked, and it is only asked once the page is signed in, so a signed out visitor never fetches
// anything about a student.
export function entryTarget(auth: EntryAuth, me: EntryMe | undefined): EntryTarget {
  if (auth.isLoading) return "waiting";
  if (!auth.isAuthenticated) return "sign-in";
  if (me === undefined) return "waiting";
  // The token was accepted but the server sees no session (a stale cookie): the visitor has to sign in again.
  if (me.state === "signedOut") return "sign-in";
  if (me.state === "needsProfile") return "interview";
  return me.check.completedAt !== null ? "dashboard" : "interview";
}

// A referral code in the address (`dhirise.com/?ref=ABC1234`). The funnel's landing page reads `?ref=` itself and checks it against the
// server, so this only keeps what looks like a code (letters and digits, 3 to 16 long) and drops anything else, so nothing odd is ever
// copied into the address of the interview.
export function referralParam(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{3,16}$/.test(code) ? code : undefined;
}

// The interview's landing address, with the visitor's referral code kept when there is one.
export function interviewUrl(referral?: string): string {
  return referral ? `${INTERVIEW_PATH}?ref=${encodeURIComponent(referral)}` : INTERVIEW_PATH;
}

// Where "Back to the house" goes from an error or not found page: the front door when the address starts with `/enter`, the dashboard
// everywhere else (spec house/0003).
export function backToHouse(pathname: string): string {
  return pathname.startsWith(ENTER_PATH) ? "/" : DASHBOARD_PATH;
}

// The house's own entry states (spec house/0002), as `members.me` answers them. Kept small so the rule is easy to test.
export type HouseRole = "student" | "teacher" | "institute_admin" | "dhi_admin" | "counselor";
export type HouseMe =
  | { state: "signedOut" }
  | { state: "noHouse" }
  | { state: "invitePending"; role: HouseRole; instituteName: string | null }
  | { state: "active"; role: HouseRole }
  | { state: "removed" }
  | { state: "suspended"; role: HouseRole };

export const JOIN_PATH = "/join";
export const STAFF_PATH = "/staff";

// Where a person who is signed in goes, by their place in the house. `funnel` means the house has nothing for them yet (no membership and no
// invite), so the funnel's own rule (`entryTarget`) decides. A removed or suspended member goes to the dashboard, which says so plainly.
export type HouseTarget = "waiting" | "join" | "dashboard" | "staff" | "funnel";

export function houseTarget(me: HouseMe | undefined): HouseTarget {
  if (me === undefined) return "waiting";
  switch (me.state) {
    case "signedOut":
    case "noHouse":
      return "funnel";
    case "invitePending":
      return "join";
    case "removed":
    case "suspended":
      return "dashboard";
    case "active":
      return me.role === "student" ? "dashboard" : "staff";
  }
}
