# Review, house/people-roles-invites (HEAD 66d65dc, the habits room), 2026-10-19

**Reviewed by**: Claude Opus 5.5 (author on Claude Sonnet 5.5)
**Scope**: 32 files, the single commit `66d65dc` "Build the real habits room (spec house/0007)" on branch vs main
**Verdict**: Changes requested

## Summary
The commit moves the habits room onto the shared Convex backend: two tables (`habitPlans`, `habitChecks`), `habits.list/add/setToday/remove`, a `habits.ticked` event that carries only the kind, export and erase hooks, and the screen rewired to the server with the streak helpers on the shared 04:00 day rule. The backend is solid. Ownership, the cap under concurrency, the flips chain, the no-op rule, rollback with the log, the list bound and erase order all hold, and the convex-test suite covers almost every AC. The problems are on the screen. Clearing or typing into the compose form's Start date crashes the room, and the "today" shown can stay on yesterday after a phone or laptop sleeps past 04:00. When that happens the student sees yesterday's ticks as today's and a tap is silently a no-op.

## Major

### 🟠 Clearing or typing the Start date crashes the habits screen, `src/components/dhi/habits/habit-compose.tsx:106`
**Problem**: The End input renders `max={addDays(startOn, MAX_WINDOW_DAYS - 1)}`. `addDays` is `shiftDay` from `dayRules.ts`, which throws `RangeError("not a day key")` for any value that is not `2xxx-MM-DD`. The Start input's `onChange` copies `e.target.value` into `startOn` with no check. A date input reports `""` when the student taps "Clear" (on the Android Chrome picker or with Backspace on desktop). While a year is typed digit by digit, Chrome reports `"0002-10-19"`, `"0020-…"` and `"0202-…"`. Each of these makes the next render throw. Confirmed: `shiftDay("", 89)`, `shiftDay("0002-10-19", 89)` and `shiftDay("0202-10-19", 89)` all throw. No route under `src/routes` or `src/components/dhi` has its own error boundary, so the dashboard route falls to the router's error screen.
**Why it matters**: One ordinary gesture in the add form takes the whole room down until the page is reloaded.
**Suggested fix**: Do not call `shiftDay` on unvalidated input. Compute the End `max` only when `isDayKey(startOn)`, or keep a "last valid start" for the derived attributes. Also disable Create while either date is not a day key or the end is past start + 89, so the convenience check matches the server's `windowProblem`.

### 🟠 The shown "today" goes stale after the device sleeps past 04:00, so a tap aims at the wrong day, `src/components/dhi/habits/habit-tracker.tsx:67`
**Problem**: The day moves on only through one `setTimeout(…, dayEndsAt(today) - Date.now())`. Browser timers run on a monotonic clock that stops during device sleep (Android's CLOCK_MONOTONIC, laptop suspend), and background tabs are frozen. Example: a student opens the room at 22:00, locks the phone and unlocks it at 07:30. The timer fires hours late, or only after the remaining monotonic delay passes. Until it does, `today` is still yesterday:
- The cards show yesterday's ticks as today's ("Undo Water").
- `toggle` sends `lit: !isLit(store, id, today)`, which is `lit: false`. The server's day has no row, so it answers `{ ok: true, changed: false }`. Nothing changes and no line is shown.
- A student who sees "done" never ticks, so today becomes a real miss. The screen's mistake becomes the record.

The pure helpers in `src/lib/dhi/habits/store.ts` make it worse. `currentStreak`, `longestStreak`, `tally`, `river`, `rangeScore` and `insight` read `todayKey()` from the live clock (`store.ts:74, 93, 102, 116, 142`), while the cards, `openPlans` and `isLit` use the stale `today` state. One render then mixes two days. The `fastForward("26:00:00")` step in `scripts/habit-check.mjs` uses a faked clock and cannot catch this.
**Why it matters**: This breaks AC-12 ("A screen left open past 04:00 moves to the new day and says so"). Leaving a phone tab open overnight is the main case for students, and the result is wrong ticks and false misses.
**Suggested fix**: Re-check `todayKey()` on `visibilitychange`, `pageshow` and `focus`, plus a cheap interval (about one minute). Use the server's answer too: when `setToday` returns a `day` different from `today`, move `today` to it and show the "day moved on" notice. Pass `today` into every helper instead of their `todayKey()` defaults so one render uses one day.

## Minor

### 🟡 The daily add limit is not the house day, `packages/backend/convex/limits.ts:70`
**Problem**: `habitAddDay` is a `fixed window` with no `start`. The limiter's own docs say a missing `start` means "a random number between 0 and `period`", so the 24 hour window does not line up with the 04:00 day. A student can add 10 habits just before their window resets and 10 more after it, inside one house day. The comment on line 68 also says "Both are taken for every attempt", but `habitAddDay` is (correctly) taken only for a real add.
**Why it matters**: AC-11 and the Consequences section promise "10 new habits a day". The real bound on events per day is about (5 + 20) × 7 = 175, not the spec's 35 (or 105). That is still under the log's 500, so this is not a safety problem, but the contract and the comment are wrong.
**Suggested fix**: Set `start` so the windows begin at a 04:00 India boundary. That is 22:30 UTC, `start: dayBounds("2026-01-01").start`. Fix the comment, and update the spec's bound to match.

### 🟡 Clock skew or a wrong device clock makes taps no-ops with no feedback, `src/components/dhi/habits/habit-tracker.tsx:103`
**Problem**: The tick target is worked out from the device's day, and the `day` the server returns is ignored. A phone whose clock is wrong, or skewed by a few minutes around 04:00, sends the wrong target. The server answers `changed: false` and the student sees nothing happen.
**Why it matters**: Low-cost phones often have wrong clocks. The spec accepts the device clock for display, but a silent no-op is confusing.
**Suggested fix**: When `r.ok && !r.changed && r.lit !== isLit(...)` or `r.day !== today`, adopt `r.day` (see the Major above) or show a short line.

### 🟡 The compose form keeps the day it opened with, `src/components/dhi/habits/habit-compose.tsx:27`
**Problem**: `useState(today)` freezes the default start and its `min` and `max`. If the form is open across 04:00, the default start is yesterday and the server answers `bad_window`.
**Suggested fix**: Re-clamp `startOn` when the `today` prop changes, or key the sheet on `today`.

### 🟡 The streak helpers are quadratic over the ticks on every render, `src/lib/dhi/habits/store.ts:63`
**Problem**: `isLit` is a linear `some` over every check in the store, which can hold up to 30 habits × 90 ticks = 2,700. Some callers loop over it:
- `longestStreak` and `tally` do so for each day of each habit.
- `leadingHabit` calls `currentStreak` and `longestStreak` inside a sort comparator.
- The Finished list calls `tally` for each of up to 25 habits (`habit-tracker.tsx:220`).

None of this is memoized, and it reruns whenever `busy`, `fail`, `tip` or `scope` changes. In the worst case that is tens of millions of closure calls per render.
**Why it matters**: The janky taps will be felt on low-end Android phones, which is the target device.
**Suggested fix**: Build a `Map<planId, Set<day>>` once in `storeFromServer` and memoize the per-plan tallies on `[store, today]`.

### 🟡 Gaps in the AC-11 and 00:00–04:00 tests, `packages/backend/convex/habits.test.ts:353`
**Problem**:
- The test of the 61st write only asserts `rate_limited` appears somewhere and that the last call is refused. It does not pin the exact 61st call, or show that a `bad_title` (validation after the limit) still uses a write token.
- Nothing tests that a `bad_title`, `bad_window` or `too_many_habits` refusal leaves `habitAddDay` unspent ("a typing mistake never uses it up").
- The comment "and the next day opens again" (line 370) is not tested.
- On the screen side, `src/lib/dhi/habits/habits.test.ts` uses the live clock only. No test fixes the time between 00:00 and 04:00 to prove the streak and miss helpers follow the shared day rule, and the helpers cannot be given a time because they call `todayKey()` themselves.
**Suggested fix**: Add the add-limit order cases and an exact 61st-call case. Let the helpers take `today` (see the Major) and test them at 02:00 India time.

### 🟡 Spec and AGENTS lines not updated, `packages/backend/AGENTS.md`
**Problem**: Spec 0007 build step 1 asks for "a line in the backend `AGENTS.md`" for the new `@dhi/backend/habitCodes` export. The package AGENTS still lists only `api, consentText, dayRules, feedbackRules, challengeRules, reportVersion`. `convex/AGENTS.md` has no key-files row for `habits.ts`, `habitRoom.ts`, `habitRules.ts`, `habitCodes.ts` or `habitProof.ts`.
**Suggested fix**: Add the rows, or leave them to `/sync`, but track them.

## Nits
- ⚪ `src/components/dhi/habits/habit-compose.tsx:52`, `maxLength={40}` counts UTF-16 units, but the server counts code points, so an emoji title is cut at 20 emoji while the server allows 40. This errs on the strict side.
- ⚪ `packages/backend/convex/habitRoom.ts:24`, `Number(cursor)` turns a malformed cursor into `NaN`, which goes to `gt("_creationTime", NaN)`. Return `next: null` or refuse instead. Owner only, so harmless.
- ⚪ `packages/backend/convex/habitRoom.ts:13`, the spec says ticks run to "the earlier of `endOn` and `removedOn`". The code uses `endOn` only. It is equivalent because no tick can land after `removedOn`, but a one-line comment would stop the next reader wondering.
- ⚪ `packages/backend/convex/habits.ts:173`, removing a finished habit stamps `removedOn` after `endOn`, and removing a future one stamps it before `startOn`. The export shows both as they are. That is fine, but consider `min(day, endOn)` for an honest record.
- ⚪ `packages/backend/convex/habits.test.ts:177`, `for (const kind of HABIT_KINDS) expect(windowProblem(TODAY, TODAY, TODAY), kind)` asserts the same thing seven times.
- ⚪ `packages/backend/convex/eventLog.test.ts:742`, the inline comment explains only `moodProof.ts`. Add `habitProof.ts`.
- ⚪ `src/components/dhi/habits/habit-tracker.tsx:110`, remove has no busy or saving state, unlike tick. A double tap is harmless because remove is idempotent.

## Strengths
- Ownership is airtight. `ownPlan` turns a malformed id, a missing row and another student's plan into the same `not_found` after the rate limit. `list` and the export read only by `memberId`. The source scan (AC-9) and the "title appears nowhere" test (event, accessLog, viewLog, classTotals, refusal) back this up.
- The write paths are careful:
  - The cap reads the exact index range that a concurrent insert lands in, so OCC serializes two adds.
  - `setToday` is a target state with a no-op before the flips check.
  - The undo/void/`replaces` chain uses unique `eventKey`s per flip.
  - The check row and its event commit or roll back together, and the `day_full` rollback test shows it.
  - Erase deletes checks before plans.
  - `list` is clock free (sorted by `endOn` desc, `take(30)`, each habit's ticks bounded to its own window with `take(91)`).
  - A live race proof (`habitProof:race`) covers what convex-test cannot.

## Test coverage
The backend suite (`packages/backend/convex/habits.test.ts`) covers AC-1 through AC-10 well: the cap, the window edges (14 ahead, 90 days, code points), the 03:59:59.999 / 04:00 split, not_open, undo/void/replaces, the flips cap, rollback, ids and the gate, the privacy scans, the list bound, export paging and multi-page erase. AC-11 is covered weakly (see Minor). The screen's pure helpers have one node test that runs on the live clock, so the 00:00–04:00 behaviour and the stale-day handling are untested. The compose form, where the crash lives, has no test. The browser proof (`scripts/habit-check.mjs`) checks the day-moved notice with a faked clock but not that the old tick stops showing as today's.

## Resolution (same day, by the author)
Both majors and most minors are fixed, and `pnpm habit:check` (9 of 9 steps, with a fresh student each run) covers them:
- Clearing or half typing the start date no longer crashes the room: nothing is worked out from a date that is not a real day, and Create stays closed until the dates match what the server accepts.
- The shown day no longer goes stale after a phone sleeps: it is looked at again on wake, focus, page show and once a minute, the server's returned day is adopted, and every streak, tally and chart helper now takes the day it should read, so one render uses one day (also between 00:00 and 04:00).
- The daily add window now begins at 04:00 India time, and its comment is right; the compose form moves its start up if left open across 04:00; the lit days are indexed once so lookups are not scans; the export cursor and some comments were tidied; tests were added for the exact 61st write, the daily limit not being spent by a refused add, and the helpers on explicit days.
Left open: the `AGENTS.md` lines for the new files (left to `/sync`); the stamp of `removedOn` on a finished or future habit (shown as it is); remove has no busy state (it is idempotent).
