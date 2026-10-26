// The pure rules of the Modules room (spec house/0013). No database and no clock, and no imports, so the screen and the tests read the same rules.
// A film is uploaded and approved by DHI only. A student watches it with progress saved by the server, and the score is written once, when the
// server's own record shows the film was watched to its end. The server never trusts the position the browser reports: it raises the furthest
// watched point only a little faster than real time (progressAfter), so a script cannot jump to the end and claim the score.

export const CATEGORIES = ["academic", "self_help", "mental_health"] as const;
export type Category = (typeof CATEGORIES)[number];
export const isCategory = (text: unknown): text is Category => typeof text === "string" && (CATEGORIES as readonly string[]).includes(text);

export const MAX_TITLE = 80;
export const MAX_BLURB = 200;
export const MAX_SCORE = 100;
export const MIN_DURATION_SEC = 10;
export const MAX_DURATION_SEC = 2 * 60 * 60;
export const CHECKS_FOR_ACADEMIC = 2;
export const MAX_CHECK_TEXT = 200;

// The progress cap. A report is accepted at most once every 4 seconds, and raises the furthest point by at most the real time since the last
// accepted report plus one second, so no script watches faster than about 1.25 times real time. The first report may reach 5 seconds.
export const MIN_INTERVAL_MS = 4000;
export const SLACK_SEC = 1;
export const FIRST_ALLOWANCE_SEC = 5;
// A film counts as watched to its end when the furthest point is within 3 seconds of its length (the last moments are credits).
export const FINISH_TOLERANCE_SEC = 3;
// The play link of a film is good for 10 minutes.
export const LINK_TTL_MS = 10 * 60 * 1000;

// A trimmed text of at most `max` characters (counted in code points), or null.
export function cleanText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  return text.length > 0 && [...text].length <= max ? text : null;
}

// The video reference a DHI admin gives for a film: a file inside the house's own public folder (the stand in host, used until the video host
// account is ready: `/something/name.mp4` or `.webm`, no `..`), or the 32 character id of a hosted video. Anything else is refused.
export function hostRefProblem(ref: unknown): "bad_host_ref" | null {
  if (typeof ref !== "string") return "bad_host_ref";
  if (/^\/[A-Za-z0-9_\-/.]+\.(mp4|webm)$/.test(ref) && !ref.includes("..") && !ref.includes("//")) return null;
  if (/^[a-f0-9]{32}$/.test(ref)) return null;
  return "bad_host_ref";
}

// The playable address of a film. A path in the house's own folder plays as it is (the stand in host). A hosted video id needs the video host's
// signed link, which is not set up yet, so it answers `host_not_ready`.
export function playUrlOf(ref: string): { ok: true; url: string } | { ok: false; code: "host_not_ready" } {
  if (ref.startsWith("/")) return { ok: true, url: ref };
  return { ok: false, code: "host_not_ready" };
}

export type ProgressInput = {
  furthest: number; // the furthest point the server has recorded, in seconds
  lastAt: number | undefined; // when the server last accepted a report, in ms (undefined before the first)
  now: number;
  reported: number; // the position the browser says the student reached, in seconds
  durationSec: number;
  // The finish call reports the end of the film at once, so it is not held to the 4 second gap (it is still held to the real time rule).
  ignoreInterval?: boolean;
};

// The new furthest point. A report that is not a number, is negative, or comes too soon changes nothing. Otherwise the furthest point rises to
// the reported position, but not by more than the real time since the last accepted report plus one second (5 seconds for the first report),
// never goes down, and never passes the length of the film.
export function progressAfter(i: ProgressInput): { furthest: number; accepted: boolean } {
  if (!Number.isFinite(i.reported) || i.reported < 0) return { furthest: i.furthest, accepted: false };
  if (i.lastAt !== undefined && i.ignoreInterval !== true && i.now - i.lastAt < MIN_INTERVAL_MS) return { furthest: i.furthest, accepted: false };
  const gain = i.lastAt === undefined ? FIRST_ALLOWANCE_SEC : Math.max(0, (i.now - i.lastAt) / 1000) + SLACK_SEC;
  const next = Math.max(i.furthest, Math.min(i.reported, i.furthest + gain, i.durationSec));
  return { furthest: next, accepted: true };
}

// Whether the furthest point counts as the end of the film.
export const reachedEnd = (furthest: number, durationSec: number): boolean => furthest >= durationSec - FINISH_TOLERANCE_SEC;

// A multiple choice check question for an academic film: a question, 2 to 4 options, one right option.
export function checkProblem(c: unknown): "bad_check" | null {
  if (typeof c !== "object" || c === null) return "bad_check";
  const item = c as Record<string, unknown>;
  if (!cleanText(item.question, MAX_CHECK_TEXT)) return "bad_check";
  const options = item.options;
  if (!Array.isArray(options) || options.length < 2 || options.length > 4) return "bad_check";
  if (!options.every((o) => cleanText(o, MAX_CHECK_TEXT) !== null)) return "bad_check";
  if (!Number.isInteger(item.rightOption) || (item.rightOption as number) < 0 || (item.rightOption as number) >= options.length) return "bad_check";
  return null;
}

// The whole upload: a title, a category, a blurb, a score, a length, a host reference, and the check questions an academic film carries.
export function uploadProblem(u: {
  title: unknown;
  category: unknown;
  blurb: unknown;
  scoreValue: unknown;
  durationSec: unknown;
  hostRef: unknown;
  checks: readonly unknown[];
}): "bad_title" | "bad_category" | "bad_blurb" | "bad_score" | "bad_duration" | "bad_host_ref" | "bad_check" | null {
  if (!cleanText(u.title, MAX_TITLE)) return "bad_title";
  if (!isCategory(u.category)) return "bad_category";
  if (!cleanText(u.blurb, MAX_BLURB)) return "bad_blurb";
  if (!Number.isInteger(u.scoreValue) || (u.scoreValue as number) < 1 || (u.scoreValue as number) > MAX_SCORE) return "bad_score";
  if (!Number.isInteger(u.durationSec) || (u.durationSec as number) < MIN_DURATION_SEC || (u.durationSec as number) > MAX_DURATION_SEC) return "bad_duration";
  const host = hostRefProblem(u.hostRef);
  if (host) return host;
  const need = u.category === "academic" ? CHECKS_FOR_ACADEMIC : 0;
  if (u.checks.length !== need) return "bad_check";
  for (const c of u.checks) if (checkProblem(c)) return "bad_check";
  return null;
}
