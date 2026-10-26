# 0019. The Brain's daily values from room events

**Date**: 2026-10-22
**Status**: In Progress

## Summary

The Brain reads numbers, not rooms. Every minute a job turns the new events of the room event log into one stored row for each student and house day, holding the day's value of 20 measures as a top part and a bottom part. A week is the sum of the tops over the sum of the bottoms, never an average of percentages. A day with nothing to measure has no value, and a zero is stored only for a thing that was expected and did not happen, once the day is over. Opening a report is a read of these rows, with today worked out live from today's events. The measures are the Master Spec's (ids kept), plus X01 for the minutes sat in a study hour. This is scope row 17. It was written after the build, from the Master Spec and the scope, and records the choices made.

## Requirements

**User stories**:
- As the owner, I want every number a student sees to be rebuildable from events, so that changing a formula never loses data.
- As a student, I want a day I did not log to stay "not logged", so that nothing counts a quiet day against me.

**Acceptance criteria**:
- **AC-1**: Each of the 20 measures has a hand made fixture day with its expected top and bottom (`metricRules.test.ts`).
- **AC-2**: A measure with nothing to measure has no value, never a zero. A zero is stored only for a thing that was expected and did not happen (a habit that was open and not ticked, a study hour that was open and not sat), and only once the house day is over.
- **AC-3**: A period value is the sum of the tops over the sum of the bottoms. A period with nothing logged has no value, and the number of logged days is kept beside it. A clock measure (bed time, sleep length) uses the median of the days.
- **AC-4**: Running a job again, or closing the same day again, never counts a thing twice. A changed, undone or late event is picked up by the next pass.
- **AC-5**: A nightly check recomputes the newest stored days from the events and counts those that differ. It keeps and logs counts only, never a name or a value.
- **AC-6**: A change of formula is a bump of `METRIC_VERSION`. Days stored under an older version are rebuilt from the events.
- **AC-7**: A student who has withdrawn, has not agreed, was removed or was erased gets no new values.
- **AC-8**: A student's download holds their daily values, and their erase deletes them with the patterns they hid.
- **AC-9**: Only the rollup writes a day. Only the rollup, the shared day reader, the report, the home summary and the export read them. Daily values are the student's alone: no teacher, institute admin, DHI admin or counselor reads them, and the data wall has a `brain` kind that is private.

## Decision

**Chosen option**: a stored row for each student and day (`brainDays`), kept up to date by a minute job from the event log, with the day's real zeros added by a morning job, and today added live at read time. The Master Spec's separate `daily_metrics`, `daily_breakdowns` and `period_values` tables are not built: one row per day holds every measure's top and bottom in a record, a period is summed at read time over at most 28 rows, and finished days do not change except by a late event inside the log's 7 day window or a rebuild.

**Why not the Master Spec's tables**: 28 rows a read is cheap, and the breakdowns (by subject, topic, time band, length band) need subject and topic on events that the rooms do not carry yet. When they do, a `brainBreakdowns` table can be added beside this one without a rebuild.

**The measures** (id, what it is, top ÷ bottom for a day):

| Id | Measure | Top ÷ bottom |
|---|---|---|
| A01 | Papers sat before they closed | papers sat ÷ papers sat or missed that day |
| A02 | Multiple choice accuracy | right ÷ tried |
| A06 | Hint reliance | hints opened ÷ questions answered |
| A15 | Films kept | films kept that day (a count) |
| C01 | Showing up | 1 if any room event |
| E01 | Mood logged | 1 if a mood was logged |
| E02 | Stressed days | 1 if stressed or anxious |
| E03 | Heavy days | 1 if sad or heavy |
| E09 | Felt okay or better after studying | sessions energised or okay ÷ sessions answered |
| E10 | Focus | sum of focus 1 to 5 ÷ sessions answered (a mean) |
| E11 | Writing days | 1 if a post was published |
| H01 | Breakfast before 11:00 | 1 or 0 for a day with a plate |
| H02 | Food groups | groups present ÷ 5 (a count of groups, never an amount) |
| H04 | Late dinner | 1 if a dinner after 22:00 |
| H05 | Packaged or fried items | tagged items packaged or fried ÷ tagged items |
| H06 | Bed time | minutes after noon (a clock; the median is the period value) |
| H07 | Sleep length | minutes slept (the median is the period value) |
| H08 | Habit days kept | 1 if a habit was ticked; 0 if one was open and not ticked, once the day is over |
| H12 | Study room day | 1 if 20 minutes or more were sat; 0 if an hour was open and not sat, once the day is over |
| X01 | Study hour minutes | minutes sat (0 if an hour was open and not sat, once the day is over) |
| A10 | Desk study days | 1 on a day with a desk sitting of 3 or more questions, from the system event `desk.mode` {turns, active} that every finished sitting writes. A plain measure by the owner's answer of 2026-10-24, like X02: no real zero, no lamp or home score input (the Master Spec's small score weight for A10 is not taken), not a logged day on its own. `METRIC_VERSION` 6 |
| A12 | Active learning share | desk sittings that held a write, paper or mock question ÷ the day's sittings (the Master Spec's list is mock, recall, write and paper; there is no recall kind, and story and draw do not count). Plain, as A10 |
| X02 | Desk minutes | minutes at the desk, from the `desk.present` event a finished sitting writes (house spec 0018, desk part). A plain measure by the owner's answer of 2026-10-24: no real zero, no lamp or home score input, and a day with only desk time is not a logged day for the chains. `METRIC_VERSION` 5 |

Not built, because the rooms do not capture what they need yet: A03 and A04 to A05, A07 to A14, A16 to A20 (written rubric, review items, mistake types, the desk, module checks), E04 to E08 and E12 to E17 (word counts of notes, writing style, peer engagement), H03 and H09 to H11. They are added without a rebuild: a new id in `metricRules.ts` and a bump of `METRIC_VERSION` rebuilds from the events already stored.

**What changed in the rooms for the Brain** (additive):
- `exams.submitted` {auto, mcqTried, mcqRight, longDone, hints} and `exams.missed`, written when a sitting ends (spec house/0012).
- `blog.published` {tag, words, list}, written when a teacher first approves a post (spec house/0014).
- `meals.logged` version 2 adds the processing tag (home cooked, packaged or fried). A version 1 event has no tag and is left out of H05.

## Version 3: twenty more measures (2026-10-24)

`METRIC_VERSION` is 3. The catalog now holds 40 ids, all made from what the rooms already hold plus four small additive captures. Stored days of version 2 are rebuilt from the events.

| Id | Measure | Top ÷ bottom for a day |
|---|---|---|
| C02 | Rooms with a log | how many rooms the student's own events came from (a count) |
| E05 | Mood swing | distance in lightness (1 to 5, never shown) from the previous logged day, looking back a week |
| E06L, E06S, E06H | Mood mix | 1 on the family of the day's mood: light (best, happy, motivated, determined, content), steady (tired), heavy (stressed, anxious, sad, heavy) |
| E08 | Note days | 1 if the note has 10 or more words (the event keeps only the count) |
| E12 | Words per post | mean words of the day's posts (the period value is the median) |
| E13 | Range of words | moving type-token ratio over 50 word windows, in thousandths, posts of 50 words or more |
| E14 | Structure | posts with paragraphs or a list ÷ posts |
| E15S, E15R, E15Q, E15I | What they write about | posts of that tag ÷ posts (study, reflection, question, idea) |
| E16 | Comments written | comments of the student a teacher approved (a count) |
| E16R | Comments received | comments on the student's posts a teacher approved (a count; not the student's doing, so never a log) |
| H03B, H03L, H03S, H03D | Meal times | mean minute of the house day for the slot's plates (the period value is the median) |
| H11 | Late night study | minutes of study hour stays after 23:00 |

**Captures added** (all additive, a code or a number, never words): `mood.logged` version 2 {mood, noteWords}; `blog.published` version 2 adds {paragraphs, ttr}; `blog.commented` and `blog.replied` (written at the first approval of a comment, dated to when it was written, once for each comment); `hour.present` version 2 adds {lateMinutes}.

**Rules**: a comment received (`blog.replied`) and a paper that closed unsat (`exams.missed`) are not the student's doing: they set no C01 or C02 and `didSomething` ignores E16R. A day's E05 reads the previous mood from the events, so a late edit of that earlier day moves it only on a rebuild.

**Still not built** (the rooms do not capture what they need): A03 to A05, A07 to A14, A16 to A20 (rubric, review items, mistake types, the desk, module checks), E04 and E07 (these are periods and contexts, a later insight), E17, H09 and H10 (a forgiving streak is a period rule, the weekly automaticity question is a new capture).

## Feature design

**Data** (`schema.ts`):
- `brainDays`: `memberId`, `instituteId`, `day`, `values` (a record of measure id to `{num, den}`), `version`, `computedAt`. Indexes by member and day, and by version. Erase class `erased`.
- `brainHides`: `memberId`, `patternId`, `until` (spec house/0020). Erase class `erased`.
- `brainState`: the rollup's own place (where it has read to, the counts of the last check). No person in it. Class `system`.

**Jobs** (`brainRollup.ts`, `crons.ts`), all idempotent because a day is always recomputed from its events and never added to:

| Job | When | What |
|---|---|---|
| `run` | every minute | reads events written since the last pass (from a minute earlier), recomputes the touched (student, day) pairs, 20 pairs a pass, and schedules itself again if there are more |
| `closeYesterday` and `closeDay` | 04:15 India time | for every student, closes the last two days so real zeros exist; 20 students a page |
| `reconcile` | 04:45 India time | recomputes the newest 300 stored days and counts those that differ (rows written in the last 5 minutes are left out) |
| `rebuildStale` | every 10 minutes | rebuilds days stored under an older `METRIC_VERSION`, 40 a pass |

**The shared reader** (`brainDay.ts`): `valuesFor` works out one day, `windowRows` returns the last N days (stored, with today live), `eligible` applies the consent and membership rules. The home score and the Brain report both read through it, so they cannot disagree.

**Value sourcing**: every value comes from the student's own current, not voided events of that house day (the log's own day rule, 04:00 to 04:00 India time) and two facts the events cannot say (how many habits were open, whether a study hour was open). Nothing comes from the browser.

**Key invariants**: the values are numbers and measure ids only, never a word the student wrote (a test checks the stored row for the mood, the dish and the habit title). A week is never an average of percentages. A zero is never invented for a day with nothing expected.

## Build plan

1. [x] The pure rules and the fixtures (`metricRules.ts`, `metricRules.test.ts`). Satisfies **AC-1** to **AC-3**.
2. [x] The tables, the rollup jobs and the shared reader (`brainRollup.ts`, `brainDay.ts`). Satisfies **AC-4** to **AC-7**.
3. [x] The events the Brain needs from exams, the blog and meals (`eventTypes/exams.ts`, `blog.ts`, `meals.ts` version 2).
4. [x] Export, erase and the data wall (`brainRoom.ts`, `accessRules.ts` kind `brain`). Satisfies **AC-8**, **AC-9**.
5. [x] Tests: `metricRules.test.ts` (8) and `brainRollup.test.ts` (12).
6. [ ] The Master Spec's golden reports (three synthetic students with 60 days of events, the full payloads saved) wait for the teacher and parent views, which are deferred.

## Consequences

**Positive**: one source for the home score and the Brain report; a formula change is a rebuild, not a loss; no room code knows about the Brain.

**Negative / tradeoffs**: a value can be up to a minute behind the event that made it (today is live, so the student does not see it); the two morning jobs depend on the cron running, and one missed morning heals on the next because two days are closed. There is no per subject or per topic breakdown yet.

## Follow-up

- [ ] Add subject and topic to the rooms' events (the desk, the study hour) so the breakdowns of E09 and E10 can be built.
- [ ] A reconcile result above zero should page the team. For now it is a logged line and a stored count (`brainState`).
