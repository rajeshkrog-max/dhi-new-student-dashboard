# 0007. Habits room, real

**Date**: 2026-10-19
**Status**: Proposed

## Summary

A signed in student keeps up to five habits, each with its own name, colour, start and end day. They tick a habit once a day (today only) and can undo the tick the same day. Everything is saved on the server, so ticks survive a reload and show on another phone, and a day in the window with no tick reads as a miss and is never rewritten. Each tick or undo writes one small event to the shared log, holding only the kind of habit (never the student's own title). Only the student sees any of it.

## Requirements

**User stories**:
- As a student, I want to keep up to five habits and tick them each day so that I can see my streak grow.
- As a student, I want a missed day to stay visible as a miss, without shame, so that the record is honest.
- As a student, I want to undo a tick I made by mistake today so that a rushed tap does not stay.
- As the owner, I want every tick to reach the event log, with no private words in it, so that the Brain can later read patterns safely.

**Acceptance criteria** (the contract, each one checkable on its own):
- **AC-1**: A student adds a habit (a name, one of the fixed kinds or `custom`, a colour, a start day and an end day). The server refuses a sixth open habit with `too_many_habits`. An open habit is one that is not removed and whose end day has not passed (a habit that starts in the future is open). The screen counts it the same way, so it never offers a slot the server refuses. The browser's check is only a convenience.
- **AC-2**: The window is checked by the server: the start is today or up to 14 days ahead, the end is on or after the start, and the window is at most 90 days long counting both ends, so the end is no later than the start plus 89 days (`bad_window` otherwise, which also covers a start or end that is not a real day). The name is one line, trimmed, 1 to 40 characters counted in code points, with no control characters (`bad_title`), the kind is one of the fixed codes (`bad_habit`) and the colour is one of the eight palette colours (`bad_color`).
- **AC-3**: A student ticks a habit for today only. The browser sends no day: the server reads its clock once and works out the day (04:00 to 04:00 India time, the shared day rule). A tick outside the habit's window, or for a removed habit, is `not_open`. A future or closed day cannot be ticked by any function.
- **AC-4**: Ticks survive a reload and are seen on another device. A day in a habit's window, before today, with no tick reads as a miss on the screen. A miss is never stored and never changed. Streaks, the longest streak, the tallies and the milestones are worked out when the student looks, never stored.
- **AC-5**: A student can undo today's tick. Ticking again after an undo is allowed. After its first tick, a habit's day can be flipped at most 6 more times (`too_many_flips`), so one habit writes at most 7 events a day. Ticking a day that is already ticked, or undoing one that is not, changes nothing and writes no event; a state sent from a stale tab is therefore harmless.
- **AC-6**: Each tick and each undo writes one event in the same step as the room's own row: type `habits.ticked`, payload `{ habit: <kind code> }`, an undo being a void that replaces the tick. The event never holds the student's title. If the log refuses the event, the room's write is rolled back too.
- **AC-7**: Removing a habit ends it today and keeps its history: it stops counting toward the five and leaves the list, its past ticks and misses stay, and no tick is allowed on it. Only the student's erase deletes them.
- **AC-8**: Only a student can use the room, and only through the consent gate (`requireMember`): a student who has not agreed, has no parent record (under 18) or has withdrawn gets `consent_required` or `consent_withdrawn` (thrown); a teacher, institute admin, DHI admin or counselor gets `forbidden` (thrown).
- **AC-9**: No function returns another person's habits or ticks. No staff screen, report or API reads the habit tables; the only readers are the student's own `habits` functions, their export and the erase. A source scan proves it.
- **AC-10**: The room is part of the student's export (each habit with its name, kind, colour, window, removal day and the days ticked, in pages) and of their erase (rows deleted in pages). Both tables are in the data map as `erased`, and the room is registered with its kind code `habits`.
- **AC-11**: Writes are limited to 60 an hour for each student (adding, ticking, undoing and removing together), taken for every attempt after the role check and before validation. Adding is also limited to 10 new habits a day (`too_many_adds`), so cycles of add, tick and remove cannot fill the log's 500 events a day for the student's other rooms. A refused call answers `{ ok: false, code: "rate_limited" }` (or `too_many_adds`) so the count stays.
- **AC-12**: The habits screen works at 360, 768, 1024 and 1280 px, with no sideways scroll, tap targets of at least 44 px and text of at least 12 px on touch, and its look is unchanged. It shows loading and saving states and a plain failure line for each refusal. A habit that starts in the future shows "Starts <date>" with its tick off, and habits whose end day has passed sit in a "Finished" group that keeps the remove button. A screen left open past 04:00 moves to the new day and says so; with two tabs open the other tab follows (a tick is a target state, not a toggle, so a stale resend changes nothing).
- **AC-13**: This build changes no funnel table or funnel file, and the whole funnel suite passes unchanged.

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): two new tables (`habitPlans`, `habitChecks`), student only functions, one event type, and the existing screen rewired to them.

The room owns its rows and writes each tick's event beside them through the log. Tips, milestones, colours and insight lines are the ones the room already has. The few new lines (a failure line for each refusal, the "day moved on" notice, "Starts <date>" and "Finished") are drafts marked as not approved in code, as in the Mood room.

**Implementation skills**: `convex` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex/`) · `convex-authz` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-authz/`) · `convex-test` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-test/`)

**What is decided**:
- **Window.** Start today to 14 days ahead; at most 90 days long. No start in the past.
- **Ticks.** Today only; undo today; at most 6 flips a day for each habit.
- **Remove.** Ends the habit today and keeps its history.
- **The title.** The student's own words, in `habitPlans` only; never in an event, a log line or an error.
- **Derived numbers.** Streaks, tallies, the week and month charts and the rating are computed on the screen from the ticks; none is stored.
- **Reading.** One query returns the student's open habits plus up to 25 of the newest finished ones (removed habits are left out), each with the days ticked inside its own window; no staff read exists.

## Feature design

**Data model sketch** (two new tables, additive; the funnel's tables are untouched):

| Table | Key fields | Notes |
|---|---|---|
| `habitPlans` | `memberId` · `instituteId` · `kind` (one of 6 catalog codes or `custom`) · `title` (1 to 40 code points) · `color` (one of 8 palette hexes) · `startOn` · `endOn` (`YYYY-MM-DD`) · `removedOn` (optional day) | Erase class `erased`. At most 5 open for a student. |
| `habitChecks` | `planId` · `memberId` · `instituteId` · `day` · `lit` (boolean) · `flips` (number, 0 for the first tick) | Erase class `erased`. One row for each habit and day, made at the first tick. |

Indexes: `habitPlans` by `memberId` (the export and the finished list) and by `memberId`, `removedOn` and `endOn` (the open habits and the cap: `eq(memberId).eq(removedOn, undefined).gte(endOn, today)`, `take(6)`); `habitChecks` by `planId` and `day` (the ticks and the tick lookup), and by `memberId` (the erase). Uniqueness of (planId, day) holds because Convex runs conflicting writes one after another and `setToday` looks the row up first.

Kind codes: `water`, `sleep`, `page`, `walk`, `phone`, `sit`, `custom` (the existing catalog ids plus `custom`). Palette: the eight existing hexes.

Event: room `habits`, type `habits.ticked`, version 1, payload `{ habit: <kind> }`; a tick is a normal event and an undo is a void; `about` = `habit:<checkId>`, `eventKey` = `habit:<checkId>-0` for the first tick and `habit:<checkId>-<flips + 1>` for each later flip (the new count), `replaces` = the current event of that check and day from `currentFor`. An undo is `void: true` with no payload and the same `about`; a re-tick replaces the void.

**State transitions**: a habit is open (not removed, end day not passed), ended (end day passed) or removed. For each open day a check is absent, ticked or undone (flips up to 6). After the day ends the check is final.

**API surface** (Convex functions, each starts with `requireMember` and then checks the role is student; consent and role refusals are thrown, the others returned):

| Function | Kind | Key inputs | Key outputs | Key errors |
|---|---|---|---|---|
| `habits.list` | query | none | the open habits plus up to 25 of the newest finished ones, each `{ id, kind, title, color, startOn, endOn, ticks: string[] }` | thrown: the consent and role codes |
| `habits.add` | mutation | `kind`, `title`, `color`, `startOn`, `endOn` (all strings) | `{ ok: true, id }` or `{ ok: false, code }` | returned: `bad_title`, `bad_habit`, `bad_color`, `bad_window`, `too_many_habits`, `too_many_adds`, `rate_limited` |
| `habits.setToday` | mutation | `planId: string`, `lit: boolean` | `{ ok: true, day, lit, changed }` or `{ ok: false, code }` | returned: `not_found`, `not_open`, `too_many_flips`, `rate_limited`. thrown: from the log `member_inactive`, `day_full` |
| `habits.remove` | mutation | `planId: string` | `{ ok: true }` or `{ ok: false, code }` | returned: `not_found`, `rate_limited` |

`ticks` is the days with a lit check inside the habit's own window (from `startOn` to the earlier of `endOn` and `removedOn`), oldest first, read from `by_planId_and_day` with `take(91)`; a window is at most 90 days, so this is exact and needs no clock. `planId` is a string normalised with `ctx.db.normalizeId`; a malformed id, a missing row and another student's habit all answer `not_found` (so the rate limit and the answer are reachable). The order in `add` is: `requireMember`, the role check, the rate limit, the daily add limit, validation, the cap, then the write. The order in `setToday` is: `requireMember`, the role check, the rate limit, the habit lookup (`not_found`), the window and removal check (`not_open`, so an undo on a removed habit is `not_open`), the no-op check, the flips check (`too_many_flips`), then the write and the event. A first `lit: false` with no row answers `changed: false` and writes no row. `remove` sets only `removedOn` to today, writes no event, allows a future habit, and answers `{ ok: true }` again for one already removed; a tick already made today stays and can no longer be undone. Thrown log codes (`day_full`, `member_inactive`) roll back the whole call, including its rate limit token.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Any | The student | `requireMember` (the verified session), checked to be a student; never an input |
| Add, tick, remove | `now` and `day` | `Date.now()` read once, then `dayOf(now)` from the shared day rule; never inputs |
| Add | `instituteId` | The student's `members` row |
| Add | The count of open habits | The index on `memberId`, `removedOn` (absent) and `endOn >= day`, `take(6)`, counted inside the mutation; the add is refused at 5 or more |
| Add | The kind and title for a catalog habit | The student's input; a screen habit with no catalog id sends the kind `custom` |
| Add | `startOn` and `endOn` | Inputs, checked against `day` (start in `day` to `day + 14`, end on or after start, at most 90 days) |
| Tick | The check row | `habitChecks` by `planId` and `day`; made at the first tick |
| Tick | `flips` | The stored row's count, plus one on a change |
| Tick | The event payload | The plan's `kind` code only |
| Tick | The earlier event to replace | `currentFor` for `habit:<checkId>` and `day` |
| Remove | `removedOn` | `day` |
| List | The habits and ticks | By `memberId`: the open habits from the cap index, the newest 25 finished ones from `by_memberId`; each habit's ticks are its lit checks inside its own window, `take(91)` |
| Screen | Which day is "today" and what is a miss | The device clock through the shared `@dhi/backend/dayRules`, reset at the next 04:00; a miss is a day from `startOn` to before today (and not past `endOn` or `removedOn`) with no tick |
| Screen | Streaks, tallies, charts, rating, milestones | Computed on the screen from `ticks`; never stored |
| Export | The rows and the cursor | The student's habits in creation order (removed ones too), 25 to a page, each with its ticked days only (not undone rows or flips); the cursor is the last habit's creation time, read with `gt` |

**Key invariants**:
- At most five open habits for a student, checked by the server on every add.
- One `habitChecks` row for each habit and day; a tick is only ever for today and inside the window.
- The title is in `habitPlans` only: never in an event, a log line, a refusal or a count.
- No function reads the tables for anyone but their owner.
- A check and its event are saved together or not at all.
- History is never rewritten: a miss is the absence of a tick, and removing a habit keeps its rows.

**Security model**: the browser is untrusted. Every function starts with `requireMember`, so the consent gate applies. A student reads and writes only their own rows, and a habit id that is not theirs is `not_found`. The only files that may touch the two tables are `habits.ts`, `habitRoom.ts`, the schema and the data map (and the dev proof file); a test scans for it. No staff role has any function that reaches a habit; `canView` already gives staff nothing for `habits` (class totals only, through the log). Compliance scope: personal data of students under 18 in India (DPDP Act 2023).

**Configuration required**: none. Two new rate limit buckets in `limits.ts`: `habitWrite` (a token bucket, rate 60 and capacity 60 an hour, keyed by the member id) and `habitAddDay` (a fixed window of 10 a day, keyed by the member id).

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: add, tick, reload, read back with the tick, and one event holding only the kind, verifies **AC-1**, **AC-4**, **AC-6**.
- Cap: five open habits are fine, the sixth is refused, a removed or ended habit frees a slot, verifies **AC-1**, **AC-7**.
- Window and fields: start in the past, start 15 days ahead, end before start, 91 days, a long or empty name, a bad kind and a bad colour are each refused, verifies **AC-2**.
- Day rule: a tick at 03:59:59.999 and at 04:00 land on different days; a tick outside the window or on a removed habit is `not_open`; no input can name a day, verifies **AC-3**.
- Undo: undo voids the event and the day reads as a miss again; the same state again writes nothing; the 7th flip is `too_many_flips`, verifies **AC-5**, **AC-6**.
- Gate: a student at the gate, one who withdrew, a teacher, an institute admin, a DHI admin and a counselor are each refused, and another student's habit id is `not_found`, verifies **AC-8**, **AC-9**.
- Export and erase: the export holds the student's habits with their ticks in pages; an erase with more than one page leaves none, verifies **AC-10**.
- Limits, screens: the 61st write in an hour is refused; the screen at four widths with the 04:00 and two tab behaviour; the live race of two first ticks at once; the funnel suite unchanged, verifies **AC-5**, **AC-11**, **AC-12**, **AC-13**.

## Build plan

Build approach: Tracer Bullet (from the house scope). The thin thread first (add, tick and read end to end), then the rules around it.

1. **The thread.** The two tables, `habitRules.ts` (kinds, palette, limits, window rules, exported as `@dhi/backend/habitRules` with a `package.json` export and a line in the backend `AGENTS.md`), the `habits.ticked` event type, `habits.add`, `habits.list` and `habits.setToday` for the happy path, and the schema pushed to the development deployment. Satisfies **AC-1**, **AC-3**, **AC-4**, **AC-6**, **AC-8**.
2. **The rules.** The window and field checks, the cap of five, undo with the flips limit, the no-op, `habits.remove`, and the rate limit. Satisfies **AC-2**, **AC-5**, **AC-7**, **AC-11**.
3. **Export, erase and the data map.** One room registry entry with `table: "habitPlans"` that handles both tables (the exporter nests each habit's ticks; the eraser deletes `habitChecks` first, then `habitPlans`, and counts under `habits`), the data map entries for both, a test that both tables are in the map, the updated registry test, and the privacy scan. Satisfies **AC-9**, **AC-10**.
4. **The screen.** Rewire `habit-tracker.tsx` and `habit-compose.tsx` to the server. The streak, tally and chart helpers in `store.ts` stay as pure functions but move from the local midnight to the shared day rule (`todayOf`, `shiftDay`); the demo's seed, local storage and local mutations are removed (the stale `dhi-habits-v2` key is ignored). The compose form's start defaults to the shared day's today, with the start limited to today to +14 and the end to the start +89. Add the loading, saving and failure states, the 04:00 reset, the "Starts" and "Finished" displays, and a test that the screen's catalog ids and palette equal the lists in `habitRules`. Satisfies **AC-4**, **AC-12**.
5. **Proof.** The backend suite, a live race check of two first ticks at once on the development deployment, a browser proof (add, tick, reload, undo, remove, another device, past 04:00), the responsive sweep for the habits scenes, and the funnel suite unchanged. Satisfies **AC-1** to **AC-13**.

## Consequences

**Positive**:
- The second real room reuses the log, the gate, the export and erase, and the data map exactly as Mood did.
- A miss stays an honest empty day, and removing a habit never rewrites history.
- Nothing derived is stored, so a changed streak or milestone rule never needs a data fix.

**Negative / tradeoffs**:
- A student who forgets cannot tick yesterday (today only). That keeps the log honest but is strict.
- A removed habit leaves the list but its rows stay until the student erases; the student cannot see them again in the room.
- Each tick and undo is an event, so a student flipping many habits many times uses part of the log's 500 events a day. The flips cap (7 events a habit a day) and 5 open habits bound it to 35 events a day, and the 10 adds a day limit stops add and remove cycles from adding more.
- The screen's idea of "today" comes from the device clock for display; the server's day wins on a write.
- Compliance scope: personal data of students under 18 in India; both tables join the data map and the export and erase.

**Neutral**:
- Class totals for habits (rows 17 onward) come from the event log by the existing `classTotal`, not from these tables.
- The demo store file stays for the other rooms' shared helpers only where still imported; the habits room no longer reads it.

## Follow-up

- [ ] Row 17 (daily values) reads `habits.ticked` events.
- [ ] A habit "edit" (rename, recolour) is not in this build; add it as a later change if wanted.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
