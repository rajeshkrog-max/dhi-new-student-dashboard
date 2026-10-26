# 0006. Mood room, real, with the Vedic lens

**Date**: 2026-10-19
**Status**: Accepted

## Summary

A signed in student picks one of ten mood colours for today, can add a few private words, and can change both until the day ends (04:00 India time). It is saved on the server, so it is still there after a reload and on another phone. A change of mood also writes one small event to the shared log (only the mood code, never the words). The room shows the day through the three gunas (sattva, rajas, tamas) with one soft line and one rhythm tip for each guna. Only the student ever sees any of it.

## Requirements

**User stories**:
- As a student, I want to colour today and write a few words so that I can look back on how my days went.
- As a student, I want to change today's entry until the day ends so that a rushed tap does not stay wrong.
- As a student, I want my words to be seen by nobody else so that I can be honest.
- As the owner, I want every mood to reach the event log, with no private words in it, so that the Brain can later read patterns safely.

**Acceptance criteria** (the contract, each one checkable on its own):
- **AC-1**: A signed in student saves a mood (one of ten codes) and a note for today. The server stores one `moodDays` row and one `mood.logged` event in the same step, and the event holds only the mood code. After a reload, and on another device, the same entry is read back.
- **AC-2**: One entry a day. A second save on the same day changes the same row. If the mood changed, a new event replaces the earlier one, so the day still reads as logged once; if only the note changed, the row is patched and no event is written (the event would be identical). Saving the same mood and note again writes no row and no event. Two saves at once leave one row. A student may change the mood at most 10 times a day (`too_many_changes`), so edits cannot use up the log's 500 events a day or hide the day from class totals.
- **AC-3**: Only today can be saved. The server reads its clock once and uses it for both the day (04:00 to 04:00 India time, the shared day rule) and the event time, so the row's day and the log's day always agree, including at 03:59:59.999. The browser never sends a day. No function edits an earlier day (only an erase or the retention sweep deletes one).
- **AC-4**: `mood` and `note` are plain strings checked in the handler, so a wrong value is returned as `bad_mood` and an over long note as `note_too_long`, and never echoed in an error. The note is trimmed first, then measured in code points (an emoji counts once), at most 500, newlines allowed. An empty note is stored as absent and read back as `""`. The note is stored only in `moodDays`: never in an event, a log line, a refusal or any count.
- **AC-5**: Only a student can use the room, and only through the consent gate (`requireMember`): a student who has not agreed, has no parent record (under 18) or has withdrawn gets `consent_required` or `consent_withdrawn` (thrown); a teacher, institute admin, DHI admin or counselor gets `forbidden` (thrown).
- **AC-6**: No function returns another person's mood or note. No staff screen, report or API reads `moodDays`; the only readers are the student's own `moods` functions, their export and the erase. A source scan proves it.
- **AC-7**: A student reads one month at a time (`moods.month`, `YYYY-MM`, at most 31 rows, day, mood, note and line index) or a whole year (`moods.year`, `YYYY`, at most 366 rows, day and mood only, no notes). A bad month or year is `bad_month` or `bad_year` (returned). A month or year with nothing is empty. The year shown is the server day's year.
- **AC-8**: The "DHI line" is one of the existing two lines for the mood, picked once when the day is first saved (the day of the month modulo 2, stored as `lineIx`), so a later change of wording never rewrites history. The guna of a mood comes from one fixed map in code. Each guna has one soft line and one rhythm tip (three of each), shown on today's card and on a chosen day. This wording is not stored, so changing it changes how past days read, and that is accepted. All new words are drafts marked as not approved. A test scans every line for clinical words and for labels like weak, average or bright.
- **AC-9**: The room is part of the student's export (day, mood, note, in pages) and of their erase (rows deleted in pages). `moodDays` is in the data map as `erased`, and the room is registered with its kind code `mood`.
- **AC-10**: Saving is limited to 30 a hour for each student, taken for every attempt after the role check and before validation. A refused save answers `{ ok: false, code: "rate_limited" }` so the count stays.
- **AC-11**: The mood screen works at 360, 768, 1024 and 1280 px, with no sideways scroll, tap targets of at least 44 px and text of at least 12 px on touch. It shows loading, saving and a failure line for each refusal. A screen left open past 04:00 moves to the new day and says so; with two tabs open the last save wins and the other tab follows. The help button and its flow stay as they are.
- **AC-12**: This build changes no funnel table or funnel file, and the whole funnel suite passes unchanged.

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): one new table (`moodDays`), three student only functions, one event type, and the existing screen rewired to them.

The room owns one row a day and writes its event beside it through the log, so the two never disagree. The guna lens and the tips are fixed words in code, not a new system.

**Implementation skills**: `convex` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex/`) · `convex-authz` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-authz/`) · `convex-test` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-test/`)

**What is decided**:
- **Edit window.** Today only (the log's 7 days is a ceiling; this room allows fewer).
- **Time.** One read of the server clock gives the day and the event time.
- **The note.** In `moodDays` only, 500 code points, seen by the student alone. A note only change writes no event.
- **The lens.** A fixed map of the ten moods to three gunas; one soft line and one tip for each guna; drafts for the owner to approve.
- **The DHI line.** The existing 20 lines are kept (moved to `mood-words.ts`; the demo store keeps its own copy for the help flow); the day stores which of the two it got.
- **Reading.** A month, or a year of colours only. No staff read exists; class totals later come from the event log, never from this table.
- **Help button.** Unchanged (still the demo flow); counseling is a later row.

## Feature design

**Data model sketch** (one new table, additive; the funnel's tables are untouched):

| Table | Key fields | Notes |
|---|---|---|
| `moodDays` | `memberId` (id of `members`, the student) · `instituteId` · `day` (`YYYY-MM-DD`) · `mood` (one of 10 codes) · `note` (optional text, at most 500) · `lineIx` (0 or 1) · `changes` (number of mood changes so far, 0 for the first save) | Erase class `erased`. One row for each student and day. |

Indexes: `by_memberId_and_day` (the save, the month and year reads, the export). Uniqueness holds only because `save` looks the row up first, as in the rest of the backend.

Mood codes: `best`, `happy`, `motivated`, `determined`, `content`, `tired`, `stressed`, `anxious`, `sad`, `heavy` (the existing codes). Guna map: sattva = best, happy, content; rajas = motivated, determined, stressed, anxious; tamas = tired, sad, heavy.

Event: room `mood`, type `mood.logged`, version 1, payload `{ mood: <code> }`, `about` = `mood:<id>`, `eventKey` = `mood:<id>-<changes>`, `replaces` = the current event of that thing and day from `currentFor`.

**State transitions**: a day has no entry, then one entry; the mood can change up to 10 times and the note any number of times until the day ends; after that it is final. There is no delete (a wrong tap is changed, not removed).

**API surface** (Convex functions, each starts with `requireMember` and then checks the role is student; consent and role refusals are thrown, the others returned):

| Function | Kind | Key inputs | Key outputs | Who | Key errors |
|---|---|---|---|---|---|
| `moods.save` | mutation | `mood: string`, `note: string` | `{ ok: true, day, mood, note, lineIx, changed }` or `{ ok: false, code }` | a student | returned: `bad_mood`, `note_too_long`, `too_many_changes`, `rate_limited`. thrown: `consent_required`, `consent_withdrawn`, `forbidden`, `not_a_member`, `removed`, `institute_suspended`, and from the log `member_inactive`, `day_full` |
| `moods.month` | query | `month: string` (`YYYY-MM`) | up to 31 of `{ day, mood, note, lineIx }` | a student, their own | returned: none; thrown: `bad_month`, and the same consent and role codes |
| `moods.year` | query | `year: string` (`YYYY`) | up to 366 of `{ day, mood }` | a student, their own | thrown: `bad_year`, and the same consent and role codes |

`save` order: `requireMember`, the role check, the rate limit (every attempt counts), validation, the no-op check, then the write. A no-op returns the stored entry with `changed: false`.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Save | The student | `requireMember` (the verified session), checked to be a student; never an input |
| Save | `now` | `Date.now()` read once in the mutation |
| Save | `day` | `dayOf(now)` from the shared day rule; never an input |
| Save | `occurredAt` for the event | `now` (the room has no time of its own) |
| Save | `lineIx` | `Number(day.slice(8)) % 2`, set on the first save of the day and kept |
| Save | The event payload | The mood code only |
| Save | `changes` and the event key | The stored row's `changes`, plus one when the mood differs |
| Save | The earlier event to replace | `currentFor` for `mood:<id>` and `day` |
| Month, year | The student | `requireMember`; rows read by `memberId` and the day range of the month or year |
| Month, year | The year shown | `dayOf(now)` year on the server for the default; the screen asks for that year and has no year navigation |
| Month | The DHI line, the guna line and the tip text | Fixed words in `src/lib/dhi/mood-words.ts`, chosen from the stored `mood` and `lineIx` and the fixed guna map; never stored |
| Screen | Which day is "today" for display | The device clock through the shared `@dhi/backend/dayRules`, reset at the next 04:00; the save result carries the server's day, which wins |
| Export | The rows and the cursor | `{ day, mood, note }` for the student, read with `gt` on the last day key from `by_memberId_and_day`; `lineIx` and `changes` are left out |

**Key invariants**:
- One `moodDays` row for each student and day, and at most one current event for it.
- Only today is ever saved; no function edits an earlier day.
- The note is in `moodDays` only: never in an event, a log line, a refusal or a count.
- No function reads `moodDays` for anyone but its owner.
- The row and its event are saved together or not at all.

**Security model**: the browser is untrusted. Every function starts with `requireMember`, so the consent gate applies. The student reads and writes only their own rows. Teachers, institute admins, DHI admins and counselors have no function that reaches a mood or a note; `canView` already gives staff nothing for `mood` (class totals only, through the log). Compliance scope: personal and sensitive data of students under 18 in India (DPDP Act 2023). The words are drafts until the owner approves them.

**Configuration required**: none. A new rate limit bucket `moodSave` (30 an hour) in `limits.ts`.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: save, reload, read back the month and the year, and see one event holding only the code, verifies **AC-1**, **AC-4**, **AC-7**.
- Edit: a mood change replaces the event; a note only change patches the row and writes no event; the same content again writes nothing; the 11th mood change is `too_many_changes`; two at once leave one row (checked live), verifies **AC-2**.
- Day rule: a save at 03:59:59.999 and at 04:00 land on different days, the row day equals the event's `loggedFor`, no input can name a day, verifies **AC-3**.
- Note rules: 500 is allowed, 501 is refused, an emoji counts once, an empty note clears it, the event and the logs never hold it, verifies **AC-4**.
- Gate: a student at the gate, one who withdrew, a teacher, an institute admin, a DHI admin and a counselor are each refused, verifies **AC-5**.
- Privacy: a scan finds no other reader of `moodDays`; another student's month returns only their own rows, verifies **AC-6**, **AC-7**.
- Words: every line is free of clinical words and labels; the guna map covers all ten moods; a bad month and year are refused, verifies **AC-7**, **AC-8**.
- Export and erase: the export holds the student's moods in pages; an erase with more than one page of days leaves none, verifies **AC-9**.
- Limits and screens: the 31st save in an hour is refused; the screen at four widths, with the 04:00 and two tab behaviour; the funnel suite unchanged, verifies **AC-10**, **AC-11**, **AC-12**.

## Build plan

Build approach: Tracer Bullet (from the house scope). The thin thread first (one save and one read end to end), then the rules around it.

1. [x] **The thread.** The `moodDays` table, `moodRules.ts` (codes and the guna map, exported as `@dhi/backend/moodRules`), the `mood.logged` event type in the registry, `moods.save` and `moods.month` for the happy path, and the schema pushed to the development deployment. Satisfies **AC-1**, **AC-5**, **AC-7**.
2. [x] **The rules.** One entry a day with the mood change and note only paths, the no-op, today only from one clock read, the note limits, the 10 changes cap, the rate limit, `moods.year`. Satisfies **AC-2**, **AC-3**, **AC-4**, **AC-7**, **AC-10**.
3. [x] **Export, erase and the data map.** The room's entry in the room registry (exporter and eraser), the data map entry, and the privacy scan. Satisfies **AC-6**, **AC-9**.
4. [x] **The words.** `mood-words.ts` with the 20 existing lines, the guna lines and the tips (drafts), and the copy rules test. Satisfies **AC-8**.
5. [x] **The screen.** Rewire `mood-tracker.tsx` to `moods.save`, `moods.month` and `moods.year`, with the loading, saving and failure states, the 04:00 reset, a draft note for the new words, and the demo store kept only for the help button. Satisfies **AC-1**, **AC-8**, **AC-11**.
6. [x] **Proof.** The backend suite, a live race check on the development deployment (two first saves at once leave one row), the browser proof (save, reload, edit, another context), the responsive sweep for the mood room, and the funnel suite unchanged. Satisfies **AC-1** to **AC-12**.

## Consequences

**Positive**:
- The first real room proves the whole path: sign in, consent, the event log, export and erase.
- The Brain can later read mood from the event log without ever touching a student's words.
- Wrong taps are fixable the same day, and history is stable.

**Negative / tradeoffs**:
- A student who missed a day cannot fill it in later (today only). That keeps the log honest but is strict.
- The screen's idea of "today" comes from the device clock for display only; a very wrong device clock shows the wrong day until the save result comes back with the server's day.
- The new guna and tip words are drafts and must be approved by the owner before real students see them. Changing them changes how past days read.
- A note only change is not in the event log; that is fine because the log never holds the note.
- The help button still runs on demo data until the counseling row.
- Compliance scope: personal and sensitive data of students under 18 in India; every new table joins the data map and the export and erase.

**Neutral**:
- Class totals for mood (rows 17 onward) come from the event log by the existing `classTotal`, not from this table.
- Subject and topic columns are not needed here.

## Follow-up

- [ ] Owner: approve the guna lines and the rhythm tips (drafts in `mood-words.ts`).
- [ ] The counseling row replaces the demo help flow.
- [ ] Row 17 (daily values) reads `mood.logged` events.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
