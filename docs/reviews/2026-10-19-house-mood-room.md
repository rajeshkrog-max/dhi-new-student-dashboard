# Review, house/people-roles-invites (commit 0bda7f7, mood room), 2026-10-19

**Reviewed by**: Claude Opus 5.5 (author on Claude Sonnet 5.5)
**Scope**: 27 files, branch vs main (the single commit "Build the real mood room (spec house/0006)")
**Verdict**: Changes requested

## Summary

The commit makes the mood room real: one `moodDays` row per student and day, `moods.save` / `month` / `year`, a `mood.logged` event holding only the code, replace on mood change, a 10 change cap, the rate limit, export and erase hooks, the data map entry, and a screen rewired to Convex. The backend is careful and matches spec 0006 closely: the student is always taken from `requireMember`, every read is keyed by `mc.member._id`, the note never reaches an event, refusal or log, the row and event share one transaction, and Convex OCC makes concurrent first saves converge on one row. The problems are on the screen: a save in flight throws away what the student types meanwhile, and the 04:00 rollover silently discards a draft and never says the day moved (AC-11), which the browser proof does not actually exercise.

## Major

### 🟠 Edits made while a save is in flight are silently reverted, `src/components/dhi/mood-tracker.tsx:124-143` (with `:97-101`, `:187-198`)
**Problem**: `saveToday` sends the `note` / `mood` captured at click time, then after `await saveMood(...)` it unconditionally calls `setDirty(false)` (line 132). The textarea and the mood buttons are not disabled while `saving`, so a student can keep typing during the round trip (slow 3G is common for this audience). When the promise resolves, `dirty` goes false, the sync effect at lines 97-101 runs, and `setNote(todayEntry.note)` overwrites the textarea with the saved snapshot.
**Failing scenario**: type "I finished the paper", tap Save, keep typing " and slept early" before the reply. When the save returns, the textarea reads "I finished the paper" and the extra words are gone with no sign they were lost; the button reads "Saved for today".
**Why it matters**: silent loss of the student's own words in the one room built around them; the spec's focus area "the form sync effects" names exactly this.
**Suggested fix**: remember what was sent and only clear `dirty` if the current form still equals it (compare `mood` and trimmed `note` with the sent values via a ref), or disable the mood buttons and textarea while `saving`. Add a component or browser proof step for typing during a save.

### 🟠 04:00 rollover discards the draft and does not "say so" (AC-11 not met), `src/components/dhi/mood-tracker.tsx:64-67`, `:93-101`, `:206-210`
**Problem**: when the timer advances `today`, the effect at lines 93-96 sets `dirty` to false, and the sync effect then resets `mood` / `note` to the new day's (empty) entry. The `mood-day-changed` notice is only set in the save path when the server's day differs from the screen's (line 133-136), never on the timer path. So a screen left open past 04:00 moves to the new day with no message, and any half written note is erased.
**Failing scenario**: at 03:58 a student opens the room and starts writing about the day. At 04:00:00.05 the timer fires; the textarea empties, the card says "Colour today" for the new date, and nothing tells them why. AC-11: "A screen left open past 04:00 moves to the new day and says so."
**Why it matters**: the AC is unmet, and the student loses typed words at exactly the late night hour this room is likely used.
**Suggested fix**: set `dayChanged` when the timer moves `today` (and clear it on the next save or dismiss). Decide deliberately about the draft: either keep a dirty draft so it can colour the new day (and say so), or keep it and show the notice. Note that `scripts/mood-check.mjs:107-120` only proves the save-result path (device clock ahead of the server), not the timer path the AC describes; add a step that fast forwards a correct clock across 04:00 and expects the notice without saving.

## Minor

### 🟡 A device clock ahead of the server flip-flops the day every second, `src/components/dhi/mood-tracker.tsx:64-67`, `:133-136`
**Problem**: after a save returns `r.day` earlier than the device day, `setToday(r.day)` re-runs the timer effect; `dayBounds(r.day).end - Date.now()` is negative, so after `Math.max(1000, …) + 50` ms the timer sets `today` back to the device's day. The screen shows the saved day for about a second, then reverts to an empty "Colour today" card; a second save flips it again. This is exactly the path `mood:check` exercises (it passes because it only waits for the notice).
**Why it matters**: the spec accepts a wrong day "until the save result comes back"; here the server's day does not stick.
**Suggested fix**: keep an offset between server and device time from the save result (or stop the timer from moving `today` backwards / ahead of the server day it was given), and reset `dayChanged` when the day really changes.

### 🟡 The month board does not follow the rollover, `src/components/dhi/mood-tracker.tsx:52`
**Problem**: `month` is initialised once from the device day and never updated when `today` moves. On the 1st of a month (or 1 January, where `year` changes but `month` stays 11, showing December of the new year, all future) the calendar keeps showing the old month and today's ring is missing.
**Suggested fix**: when `today` crosses a month boundary, move `month` to the new month unless the student has navigated away.

### 🟡 The week pie loses late December in early January, `src/components/dhi/mood-tracker.tsx:103-120`
**Problem**: the pie counts from `yearMoods`, which only holds `moods.year` for the current year. From 1 to 6 January the "week" range `shiftDay(today, -6)` reaches into December, but those days are not loaded, so the week reads as fewer days than were logged.
**Suggested fix**: build the week from `currentRows` plus the previous month's rows (or a dedicated range query) rather than from the year array.

### 🟡 The note box limit disagrees with the counter and the server for emoji, `src/components/dhi/mood-tracker.tsx:193`, `:200`
**Problem**: `maxLength={500}` counts UTF-16 code units, while the counter and the server (`noteLength`) count code points. A student writing in emoji (or other astral characters) is stopped at about 250 characters while the counter reads "250 of 500"; the counter also counts untrimmed text while the server trims.
**Suggested fix**: drop `maxLength` and enforce the code point limit in `onChange`, or show the limit from the same `noteLength` the server uses.

### 🟡 Query errors are not handled on the screen, `src/components/dhi/mood-tracker.tsx:59-61`
**Problem**: `useQuery` throws on a thrown `ConvexError` (`consent_withdrawn` after a withdraw in another tab, `removed`, `institute_suspended`). The room has no boundary of its own, so the screen falls to whatever boundary is above it rather than a plain failure line; the "Loading…" state also never shows for `viewRows` / `yearRows`, which render as empty months while loading.
**Suggested fix**: confirm the dashboard swaps to `LockedHouse` reactively before these throw, or wrap the room so a refused read shows plain words.

### 🟡 `moodProof.ts` reads the events table directly and the scans were loosened to allow it, `packages/backend/convex/moodProof.ts:54`, `packages/backend/convex/eventLog.test.ts:742`
**Problem**: AGENTS.md says only `eventLog.ts` and `eventData.ts` read events. The proof could use `eventsForDay` / `currentFor` (as `eventProof.ts` does via the read helper allowlist) instead of a raw `query("events")`, which needed a new exemption in the AC-10/AC-12 scan. Its `saveAs` also writes a mood for any `memberId` without a role check (guarded only by `TEST_SIGNIN_ENABLED`, internal only, so not exploitable from a browser).
**Suggested fix**: count through the read helpers, put `moodProof.ts` on `READ_HELPER_IMPORTERS` instead of exempting it from the raw read scan, and refuse a non student in `saveAs`. Add a backend test that `race`, `saveAs` and `makeStudent` answer `proof_disabled` when the flag is off.

### 🟡 The AC-6 privacy scan is narrow, `packages/backend/convex/moods.test.ts:237-248`
**Problem**: it only scans `./*.ts` for the literal `moodDays`. A reader in a subfolder, or one that imports `MOOD_TABLE` from `moodRoom.ts` and queries with it, passes. The year check is a regex on the exact source text of one `map`, which breaks on reformatting rather than on a leak.
**Suggested fix**: glob `./**/*.ts`, also flag imports of `MOOD_TABLE`, and assert the year's return validator keys (or call `moods.year` and check the row keys) instead of matching source.

### 🟡 The team's count export leaves out mood rows, `packages/backend/convex/dataRights.ts:166-176`
**Problem**: `adminExport` (answering a parent for an under 18 student) returns `events` and `consent` counts only; with the first real room, the answer now under-reports what is held.
**Suggested fix**: add per room counts from `ROOM_ENTRIES` (a bounded count, like `countEvents`).

## Nits
- ⚪ `src/components/dhi/mood-tracker.tsx:206-210`, `dayChanged` is never cleared once set, so the notice stays for the rest of the session.
- ⚪ `src/components/dhi/mood-tracker.tsx:38`, "Content" is preselected, so tapping "Colour today" without choosing logs Content; consider no preselection on a day with no entry.
- ⚪ `packages/backend/convex/moods.ts:49`, `instituteId as NonNullable<…>` relies on `requireMember` always giving a student an institute; a short `if (!instituteId) fail(...)` would turn a schema error into a fixed code.
- ⚪ `packages/backend/convex/moods.ts:41` and `eventLog.ts:122`, the log reads `Date.now()` a second time for `in_future` / `isLate`. Row day and `loggedFor` always agree (both from `occurredAt`), so AC-3 holds; only if the runtime clock is not frozen within a mutation could a save straddling 04:00 by milliseconds get `late: true`. Passing `now` through, or a comment that Convex fixes the clock per mutation, would close it.
- ⚪ `packages/backend/convex/moods.ts:30-83`, `saveFor`'s body is indented four spaces, unlike the rest of the file (Prettier will fix it).
- ⚪ `scripts/responsive-sweep.mjs:298-306`, the sweep now writes a "Content" entry for the demo student on the development deployment; worth a line in its header.

## Strengths
- The server side privacy wall is solid: no input names a student or a day, every read is `eq("memberId", mc.member._id)`, the year projection drops notes, refusals are fixed codes, and the AC-4 test dumps events, access log, view log and class totals to prove the note is absent.
- The row and its event are written in one mutation, and the "log refuses, row rolls back" test (`day_full`) proves the atomicity; the replace chain via `currentFor` and the monotonic `${about}-${changes}` keys keep exactly one current event per day, with the cap bounding the day at 11 events.
- Good boundary tests: 03:59:59.999 vs 04:00 with row day equal to `loggedFor`, 500 vs 501 code points with emoji, trimming and empty note to absent, every role and gate state refused, and export (3 pages of 230) and erase across pages with another student's row kept.
- Export and erase hooks use the index with a `gt` cursor rather than a second paginate, which fits Convex's one paginate per function rule.

## Test coverage
Backend coverage is strong and maps to AC-1 to AC-10 (convex-test), plus a live OCC race (`moodProof:race`) for the one-row rule, and node tests for the word bank (AC-8) and refusal wording. Gaps: nothing exercises the screen's state logic (save in flight, the timer rollover with a correct clock, the server-day-wins path holding beyond one second, two tabs where one is dirty); `mood:check`'s 04:00 step proves a different path than AC-11 describes. No test that `moodProof` refuses when `TEST_SIGNIN_ENABLED` is off. AC-12 (funnel unchanged) holds by the file list: nothing under `apps/` changed.

## Resolution (same day, by the author)
Both majors are fixed in `mood-tracker.tsx`, and the browser proof `pnpm mood:check` (10 of 10 steps, run twice with a fresh student each time) covers them:
- Words typed while a save is in flight are kept: the form is clean again only if it still holds what was sent.
- When the day moves on (the 04:00 timer), the screen now says so, keeps a half written line (it belongs to the new day) and shows the new month.
Also fixed from the minors: the note box now counts code points like the server, and the month board follows the day change.
Left open (minor): a device clock that is ahead flips the shown day back after about a second; the week pie misses late December days in early January; a failed query is not shown on the screen; `adminExport` leaves out mood counts; the AC-6 scan checks top level files only; `moodProof` has no test that it refuses when the test sign in is off.
