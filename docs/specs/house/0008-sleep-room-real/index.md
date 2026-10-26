# 0008. Sleep room, real

**Date**: 2026-10-20
**Status**: In Progress

## Summary

A signed in student logs last night's sleep in two taps: a bed time and a wake time, prefilled from their last logged night. It is saved on the server, so it is still there after a reload and on another phone. The room shows last night's length, the usual bedtime and a strip of the last seven nights, and a night with no log simply stays "not logged". Each night writes one small event to the shared log, holding two whole numbers and nothing else. Sleep gets its own room, its own table and its own card, because a bed time and a wake time do not fit a habit tick or a mood colour.

## Requirements

**User stories**:
- As a student, I want to log last night's sleep in two taps so that it takes no effort to keep up.
- As a student, I want to see my usual bedtime and how long I slept so that I can notice my own pattern, with no score and no telling off.
- As a student, I want a night I forgot to stay "not logged" so that nobody guesses and nothing is invented.
- As the owner, I want every logged night to reach the event log as plain numbers, so that the Brain can later read sleep, the signal the research brief leans on most, without any labels.

**Acceptance criteria** (the contract, each one checkable on its own):
- **AC-1**: A signed in student saves a night: a bed time and a length. The server stores one `sleepNights` row and one `sleep.logged` event in the same step. The event holds only `bedMin` and `lengthMin`. After a reload, and on another device, the same night is read back.
- **AC-2**: One entry for each night. A second save for the same night changes the same row. If `bedMin` or `lengthMin` changed, a new event replaces the earlier one, so the night still reads as logged once. Saving the same values again writes no row and no event. A student may change a night at most 10 times (the first save is not a change), answered `too_many_changes`. Two saves at once leave one row.
- **AC-3**: A night is filed under the house day on which it is saved (04:00 to 04:00 India time, the shared day rule), which is the night that ended most recently, and only that night can be saved. The server reads its clock once and uses it for both the night's day and the event time, so the row's day and the log's day always agree, including at 03:59:59.999. The browser never sends a day. No function edits an earlier night (only an erase or the retention sweep deletes one). A student who wakes and saves again before 04:00 is changing the night already filed under that day, not making a new one.
- **AC-4**: `bedMin` is whole minutes after 12:00 noon, 0 to 1439, and a multiple of 15. `lengthMin` is a multiple of 15 from 60 to 960 (1 to 16 hours). Valid means `Number.isInteger(x) && x % 15 === 0` and in range, so a fraction, `NaN`, infinity and `-0` are refused, and a stored value is written as `x + 0`. Anything else is returned as `bad_time` or `bad_length`, never echoed, and nothing is stored. The wake time is not an input: it is `bedMin` plus `lengthMin` on the clock. A night that crosses midnight is normal.
- **AC-5**: Only a student can use the room, and only through the consent gate (`requireMember`): a student who has not agreed, has no parent record (under 18) or has withdrawn gets `consent_required` or `consent_withdrawn` (thrown); a teacher, institute admin, DHI admin or counselor gets `forbidden` (thrown).
- **AC-6**: No function returns another person's nights. No staff screen, report or API reads `sleepNights`; the only readers are the student's own `sleep` functions, their export and the erase. Staff see sleep only as class totals through `classTotal` (the existing `wellbeing` rule), never a named night. A source scan proves it.
- **AC-7**: A student reads their newest nights with `sleep.recent`: at most 30 rows, each `{ day, bedMin, lengthMin }`, newest first. A night with no row is "not logged" on the screen. It is never stored, filled in or inferred.
- **AC-8**: The screen shows last night's length, the usual bedtime and the average length, and the strip of the last 7 nights. Last night's length is the row whose `day` is the display day; with no such row it says "not logged" and never falls back to an older row. The usual bedtime is the median `bedMin` of the newest 14 nights logged in the window of the display day and the 29 days before it (30 days), shown only from 3 nights. An even count takes the lower of the two middle values, so the result is always a real logged value on the 15 minute grid. The average length is the mean `lengthMin` of the same nights with the same 3 night minimum, rounded to the nearest minute and shown as "N h M min". The strip runs oldest on the left to the display day on the right: a bar from bed to wake on the noon shifted scale for each logged night, a quiet dot for "not logged". Every bar is one neutral token colour with no target line, and no colour depends on length. Nothing is stored. No score, no colour or word judging a night, no target hours and no health advice. The words pass the copy rules (a word such as "short", "long", "good" or "enough" fails them) and stay drafts until the owner approves them.
- **AC-9**: The room is part of the student's export (day, bed time, wake time and length, in pages) and of their erase (rows deleted in pages). `sleepNights` is in the data map as `erased`, and the room is registered with its kind code `sleep`.
- **AC-10**: Saving is limited to 30 an hour for each student, taken for every attempt after the role check and before validation. A refused save answers `{ ok: false, code: "rate_limited" }` so the count stays.
- **AC-11**: The sleep screen works at 360, 768, 1024 and 1280 px, with no sideways scroll, tap targets of at least 44 px and text of at least 12 px on touch, in the existing look (the shared kit and tokens, so `look:check` still passes). The screen state is `{ bedMin, lengthMin }`, shown as a bed stepper and a wake stepper in 15 minute steps. The bed stepper moves the whole night (the length stays, so the wake time moves with it) and wraps at noon (12:00 minus 15 minutes is 11:45). The wake stepper changes the length and stops at 1 and 16 hours, so a bad length can never be picked. The times start at the newest logged night's times whatever its age (23:00 and 06:30 the first time), so Save is one tap. When the display day already has a row and nothing is edited, the button is disabled and reads "Saved". Clock times are shown as 24 hour `HH:MM`. It shows loading, saving and a failure line for each refusal (it maps only the returned codes). Typing or tapping during a save is never lost: the form is clean again only if it still holds what was sent. The save result's `day` wins: if it differs from the display day, the screen moves to it and says the night moved on. An unedited draft follows `recent` live, and an edited draft is kept until it is saved or the day moves on. A screen left open past 04:00 moves to the new night and says so. With two tabs open the last save wins and the other follows. The menu has a "Sleep" entry after Habits.
- **AC-12**: This build changes no funnel table or funnel file, and the whole funnel suite passes unchanged.

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): the sleep room is its own room, with one new table (`sleepNights`), two student only functions, one event type, and a new screen on the existing kit.

The room owns one row a night and writes its event beside it through the log, so the two never disagree. The pattern is the Mood room's (house spec 0006) and the Habits room's (0007).

**Implementation skills**: `convex` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex/`) · `convex-authz` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-authz/`) · `convex-test` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-test/`)

**What is decided**:
- **Placement.** Its own room, card and menu entry. Not a habit kind, not a mood field.
- **The night.** It is filed under the house day on which it is saved, the night that ended most recently. The server's day is the only night that can be saved. There is no day input.
- **Edit window.** That one night, until 04:00 ends the day. A forgotten night stays "not logged".
- **Stored values.** `bedMin` (minutes after noon, so 23:30 is 690 and 00:30 is 750, which keeps the median sensible across midnight) and `lengthMin`. The wake time is derived.
- **The event.** `sleep.logged`, two whole numbers, no bands and no labels.
- **Fields.** Only the two times. No note and no rating, so this room holds no free text.
- **Read back.** Length, usual bedtime, average length, a 7 night strip. No target and no advice.
- **Design source.** The existing look and kit, in the style of Mood and Habits.

## Feature design

**Data model sketch** (one new table, additive; the funnel's tables are untouched):

| Table | Key fields | Notes |
|---|---|---|
| `sleepNights` | `memberId` (id of `members`, the student) · `instituteId` · `day` (`YYYY-MM-DD`, the wake day) · `bedMin` (0 to 1439, a multiple of 15) · `lengthMin` (60 to 960, a multiple of 15) · `changes` (number of changes so far, 0 for the first save) | Erase class `erased`. One row for each student and night. |

Index: `by_memberId_and_day` (the save, `recent`, the export). Uniqueness holds only because `save` looks the row up first, as in the rest of the backend.

**Event**: room `sleep` (already in `ROOMS`; its data kind is `sleep`, in class `wellbeing`, in `accessRules.ts`), type `sleep.logged`, version 1, payload `{ bedMin: int 0..1439, lengthMin: int 60..960 }`. A first save uses `about` = `sleep:<id>`, `eventKey` = `sleep:<id>-0`, no `replaces` and `occurredAt` = `now`. A change calls `currentFor` for the member, `about` and day, uses `eventKey` = `sleep:<id>-<changes + 1>` and `replaces` = that event, then patches `changes + 1`. The order is as in `moods.ts`: the no op check, then the `changes >= 10` cap, then the write. `eventTypes/sleep.ts` carries a comment that `bedMin` is minutes after 12:00 noon India time and the wake time is `(bedMin + lengthMin)` mod 1440; any change to that scale is version 2. The room entry in the registry is `{ room: "sleep", table: "sleepNights", kinds: ["sleep"] }`.

**State transitions**: a night has no entry, then one entry; it can change up to 10 times until the day ends; after that it is final. There is no delete (a wrong tap is changed, not removed).

**API surface** (Convex functions, each starts with `requireMember` and then checks the role is student; consent and role refusals are thrown, the others returned):

| Function | Kind | Key inputs | Key outputs | Who | Key errors |
|---|---|---|---|---|---|
| `sleep.save` | mutation | `bedMin: number`, `lengthMin: number` | `{ ok: true, day, bedMin, lengthMin, changed }` or `{ ok: false, code }` | a student | returned: `bad_time`, `bad_length`, `too_many_changes`, `rate_limited`. thrown: `consent_required`, `consent_withdrawn`, `forbidden`, `not_a_member`, `removed`, `institute_suspended`, and from the log `member_inactive`, `day_full` |
| `sleep.recent` | query | none | up to 30 of `{ day, bedMin, lengthMin }`, newest first | a student, their own | thrown: the same consent and role codes |

`save` order: `requireMember`, the role check, the rate limit (every attempt counts), validation, the no op check, then the write. A no op returns the stored entry with `changed: false`.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Save | The student | `requireMember` (the verified session), checked to be a student; never an input |
| Save | `now` | `Date.now()` read once in the mutation |
| Save | `day` | `dayOf(now)` from the shared day rule; never an input |
| Save | `occurredAt` for the event | `now` (the room has no time of its own) |
| Save | `bedMin`, `lengthMin` | The two inputs, checked against the AC-4 rules |
| Save | The event payload | `bedMin` and `lengthMin` only |
| Save | `changes` and the event key | The stored row's `changes`, plus one when either value differs |
| Save | The earlier event to replace | `currentFor` for `sleep:<id>` and `day` |
| Recent | The student | `requireMember`; rows read by `memberId`, newest first, `take(30)` |
| Screen | Which day is "today" for display | The device clock through the shared `@dhi/backend/dayRules`, reset at the next 04:00; the save result carries the server's day, which wins |
| Screen | The two times shown | In `sleepRules.ts`: clock minute to `bedMin` is `(clock - 720 + 1440) % 1440` (12:00 is 0, 11:45 is 1425); `bedMin` to clock minute is `(m + 720) % 1440`; the wake clock minute is `(bedMin + lengthMin + 720) % 1440`. Shown as 24 hour `HH:MM` |
| Screen | The prefill | The newest row of `recent` whatever its age; with none, `bedMin` 660 (23:00) and `lengthMin` 450 (wake 06:30) |
| Screen | Last night's length | The row of `recent` whose `day` equals the display day; none means "not logged" |
| Screen | The 7 night strip | The seven days ending at the display day; a day with a row in `recent` is a bar from bed to wake, any other is "not logged" |
| Screen | Usual bedtime, average length | `sleepRules.ts` over the rows of `recent` between `shiftDay(displayDay, -29)` and the display day, newest 14, from 3 rows (lower middle for the median, mean rounded to the minute); never stored. `recent`'s 30 newest rows always cover this window, the 14 newest and the strip |
| Export | The rows and the cursor | `{ day, bed, wake, lengthMin }` (bed and wake as `HH:MM`) oldest first, read with `gt` on the last day key from `by_memberId_and_day`, in pages of the registry's export page size (100); `changes` is left out. The erase uses the registry's erase page size (100) |

**Key invariants**:
- One `sleepNights` row for each student and night, and at most one current event for it.
- Only the server's day is ever saved; no function edits an earlier night.
- The event holds two whole numbers and no text; the room holds no free text at all.
- No function reads `sleepNights` for anyone but its owner.
- The row and its event are saved together or not at all.
- The usual bedtime and the average are worked out when the student looks and are never stored.

**Security model**: the browser is untrusted. Every function starts with `requireMember`, so the consent gate applies. The student reads and writes only their own rows. Teachers, institute admins, DHI admins and counselors have no function that reaches a night; `canView` already treats `sleep` as `wellbeing` (class totals only, through the log, and only from 10 students). Compliance scope: personal and sensitive data of students under 18 in India (DPDP Act 2023). The words are drafts until the owner approves them.

**Configuration required**: none. A new rate limit bucket `sleepSave` (30 an hour) in `limits.ts`. A new switch `SLEEP_WORDS_APPROVED` (false) in the words file, as in the other rooms.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: save, reload, read `recent`, and see one event holding only the two numbers, verifies **AC-1**, **AC-7**.
- Edit: a changed time replaces the event; the same values again write nothing; the 11th change is `too_many_changes`; two at once leave one row (checked live), verifies **AC-2**.
- Day rule: a save at 03:59:59.999 and at 04:00 land on different days, the row day equals the event's `loggedFor`, no input can name a day, and a second save at 03:30 on the same house day is a change to that night, not a new row, verifies **AC-3**.
- Limits: 60 and 960 are allowed, 45 and 975 are refused, 7, 7.5, 1440, `NaN` and `-0` as `bedMin` are refused or stored as 0, a night over midnight saves, verifies **AC-4**.
- Gate: a student at the gate, one who withdrew, a teacher, an institute admin, a DHI admin and a counselor are each refused, verifies **AC-5**.
- Privacy: a scan finds no other reader of `sleepNights`; another student's rows never appear, verifies **AC-6**, **AC-7**.
- Read back: the median across midnight (23:00, 00:30, 23:30), an even count takes the lower middle, fewer than 3 nights shows no usual bedtime or average, a missing night is "not logged" and never an older row; every word, including the strip and the average, is free of labels, targets and advice ("short", "long", "good", "enough" fail the copy test), verifies **AC-8**.
- Export and erase: the export holds the student's nights in pages; an erase with more than one page leaves none, verifies **AC-9**.
- Limits and screens: the 31st save in an hour is refused; the screen at four widths with the 04:00, two tab and typing during a save behaviour; the funnel suite unchanged, verifies **AC-10**, **AC-11**, **AC-12**.

## Build plan

Build approach: Tracer Bullet (from the house scope). The thin thread first (one save and one read end to end), then the rules around it.

1. [x] **The thread.** The `sleepNights` table, `sleepRules.ts` (no imports; limits, the clock converters, the usual bedtime and average), its `exports` entry `@dhi/backend/sleepRules` in `packages/backend/package.json` and the matching line in the backend `AGENTS.md`, the `sleep.logged` event type in the registry, `sleep.save` and `sleep.recent` for the happy path, and the schema pushed to the development deployment. Satisfies **AC-1**, **AC-5**, **AC-7**.
2. [x] **The rules.** One entry a night with the change and no op paths, the server day from one clock read, the validation, the 10 changes cap, the rate limit. Satisfies **AC-2**, **AC-3**, **AC-4**, **AC-10**.
3. [x] **Export, erase and the data map.** The room's entry in the room registry (exporter and eraser), the data map entry, the kind code check and the privacy scan. Satisfies **AC-6**, **AC-9**.
4. [x] **The words.** `sleep-words.ts` with the labels, the failure lines and the "not logged" wording as drafts, and the copy rules test. Satisfies **AC-8**.
5. [x] **The screen.** A new `sleep-tracker.tsx` on the shared kit, a "Sleep" menu entry after Habits in `home.tsx`, with the prefill, the 7 night strip, the usual bedtime, the loading, saving and failure states, the 04:00 reset and no lost edits during a save. Satisfies **AC-8**, **AC-11**.
6. [x] **Proof.** The backend suite, a live race check `sleepProof.ts` on the development deployment (many first saves at once leave one row), the browser proof `pnpm sleep:check` (a fresh student saves, reloads, edits, and sees it in a second context), the responsive sweep for the sleep room, and the funnel suite unchanged. Satisfies **AC-1** to **AC-12**.

## Consequences

**Positive**:
- Sleep, the signal the research brief leans on most, reaches the event log as plain numbers with no labels.
- A new room costs little: it reuses the gate, the day rule, the log, export and erase and the kit.
- Two taps means a student can keep it up without effort.

**Negative / tradeoffs**:
- A student who forgot a night cannot fill it in later (the night that ends today only). That keeps the log honest but is strict, and it makes "not logged" common.
- A night is filed under the house day on which it is saved, because the server cannot know when the student woke. A student who logs in the evening, before sleeping, is saving the night that ended that morning (the label "Last night" says so). A student who wakes and saves again before 04:00 changes the night already filed under that day, so a night saved before 04:00 can overwrite the earlier one.
- The noon shifted `bedMin` suits night sleepers. A bed time between noon and 18:00 sorts after a midnight one, so the median reads oddly for someone who sleeps by day.
- A wrong device clock shows the wrong night until the save result comes back with the server's day.
- The new words are drafts and must be approved by the owner before real students see them.
- Compliance scope: personal and sensitive data of students under 18 in India; the table joins the data map and the export and erase.

**Neutral**:
- The habit kind `sleep` (a daily tick) stays in the Habits room. A student may use both.
- Class totals for sleep (rows 17 onward) come from the event log by the existing `classTotal`, not from this table.

## Follow-up

- [ ] Owner: approve the sleep words (drafts in `sleep-words.ts`, `SLEEP_WORDS_APPROVED` false).
- [ ] Row 17 (daily values) reads `sleep.logged` events.
- [ ] If students ask to fill in a missed night, revisit the edit window with the owner (it changes what the event log means).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
