// The rules of the Founding Circle Challenge that more than one file needs (spec 0015). Plain values and pure functions, no database.
// Shared with the pages: `js/api.js` repeats `CODE_RE`, and `convex/challenge.test.ts` fails if it differs from this file.

// The end date is optional (spec 0008, owner's decision of 2026-10-18: the challenge runs with no end for now). `CHALLENGE_ENDS_AT` is an
// ISO date with an offset, for example `2026-10-30T23:59:00+05:30`. Unset, empty or not a date means the challenge never ends: nobody is
// refused, no referral is rejected for time and the board never freezes. Queries cannot read the clock; the job (challengeBoard.ts) decides.
// The offset is required: a bare date such as `2026-10-30` would be read as midnight UTC, five and a half hours early for India. A value that
// is set but is not an ISO date with an offset is a mistake; it still means no end, and it says so in the log so the mistake is not silent.
const ENDS_AT_FORMAT = /(Z|[+-]\d{2}:?\d{2})$/i;
export function endsAtOf(e: { CHALLENGE_ENDS_AT?: string }): number | null {
  const raw = (e.CHALLENGE_ENDS_AT ?? "").trim();
  if (raw === "") return null;
  const ms = ENDS_AT_FORMAT.test(raw) ? Date.parse(raw) : Number.NaN;
  if (Number.isNaN(ms)) {
    console.warn("CHALLENGE_ENDS_AT is set but is not an ISO date with an offset (for example 2026-10-30T23:59:00+05:30), so the challenge has no end");
    return null;
  }
  return ms;
}

// A code is 3 capital letters (from the student's first name, or DHI) then 4 characters from CODE_CHARS (no O, 0, I or 1).
export const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_RE = /^[A-Z]{3}[A-HJ-NP-Z2-9]{4}$/;

export const LEADERBOARD_SIZE = 50;
export const JOB_EVERY_MS = 5 * 60 * 1000;

// `CHALLENGE_LIVE` is the server switch (true, 1, yes or on, any case; unset means off). With it off nobody can join, no referral is
// recorded and the job does nothing, so the site behaves as it did before the challenge went live.
export function isLive(e: { CHALLENGE_LIVE?: string }): boolean {
  return ["true", "1", "yes", "on"].includes((e.CHALLENGE_LIVE ?? "").trim().toLowerCase());
}

// True only when an end date is set and `now` is after it, so a step at the very second of the deadline is still on time.
export function hasEnded(now: number, endsAt: number | null): boolean {
  return endsAt !== null && now > endsAt;
}
