# 0017. Home and DHI score, real

**Date**: 2026-10-20
**Status**: In Progress

## Summary

The home screen shows real data for a signed in student: a greeting, open exams, quick tiles and the DHI score. The score is a growth mark, never a rank, built from the student's own record: exams sat before their window closes and missed exams, study time in an open hour, modules kept, and habit ticks. Mood and meal logs count only as presence (logged or not), and their content never counts.

## Requirements

**User stories**:
- As a student, I want the home screen to show my real day so that I know what is open.
- As a student, I want to understand how my DHI score is worked out, so that I can see what raises it.

**Acceptance criteria**:
- **AC-1**: Home loads for a real student with no demo data.
- **AC-2**: The DHI score is built from exams sat before the window closes, misses, study time in an open hour, modules kept and habit ticks. Each input can be shown.
- **AC-3**: Mood and meal logs count only as presence: a day with a log counts, a day without does not. The content of a log never counts.
- **AC-4**: The score is a growth mark. It is never shown as a rank and never compared with another student.
- **AC-5**: Open exams link to the papers room.
- **AC-6**: The score uses only the signed-in student's own rows.

## Decision

**Chosen option**: One DHI score, built from the student's own record and shown with its inputs. It is a single number, kept separate from the three lamps in the Brain until the owner decides whether they are one thing or two.

**Implementation skills**: none yet.

## Rationale

A score the student can explain is fair, and a growth mark compared with their own past never ranks them. Counting presence only for mood and meals respects the owner's rule that content is private.

## Feature design

**Data model sketch**: no new table. The score is worked out at read time. **Changed 2026-10-22**: it is read from the Brain's stored daily values (spec house/0019, with today worked out live), not from the other rooms' tables, so the home score, the three lamps (row 21) and the Progress page are one thing and cannot disagree. A stored score is not kept.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `home.summary` | query | none | greeting, open exams, tiles, score with its inputs | student | `consent_required` |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| Greeting | the name | the student's own record |
| Score | each input | counted from the room tables at read time |
| Open exams | the list | the papers assigned to the student and inside their window |

**Key invariants**:
- The score is never stored, only worked out.
- Mood and meal content never reaches the score.
- Only the student's own rows are read.

**Security model**: a student reads only their own rows. The score is shown to that student only.

**Critical test scenarios**:
- A day with a mood log counts and a day with no log does not, verifies **AC-3**.
- The score with its inputs adds up, verifies **AC-2**.
- Another student's rows never change the score, verifies **AC-6**.

## Build plan

1. The summary query reading each room's presence (satisfies **AC-1**, **AC-6**).
2. The score and its inputs, computed at read time (satisfies **AC-2**, **AC-4**).
3. Presence only for mood and meals (satisfies **AC-3**).
4. Open exams and their links to the papers room (satisfies **AC-5**).

## Consequences

**Positive**: the score is explainable and changes with the student's own work only.

**Negative / tradeoffs**: the score depends on rooms that are not built yet (exams, study hour, modules), so it is partial until they are.

## Follow-up

- [x] Owner: the DHI score and the three lamps are one thing: each lamp counts one third (the owner's Vedic mapping, 2026-10-20), and the score is the mean of the lamps that have a value, times 100.
- [x] Weights: inside a lamp every input that has a value counts the same (Sadhana: papers sat and days sat in the study hour; Niyam: habit days; Viveka: films kept). Spec house/0020 records every formula.
- [x] Build order: rows 11, 12 and 14 are built, so every input has a source.
- [ ] Owner: confirm Viveka's four films in four weeks (`VIVEKA_FULL`), the builder's default.

**Progress (2026-10-22)**: built. Home shows the greeting, the score card, open exams, recent exams with confirmed marks, and quick access. The sample data note, the sample tiles, the house board, the calendar and the lamp matrix are gone, because every number on them was made up. `home.summary` reads the lamps through `brainDay.windowRows`; 8 tests in `home.test.ts`; `pnpm brain:check` checks Home and Progress show the same score.

## Rationale

Options considered: one stored score (rejected, it goes stale), a score worked out at read time (chosen), and a rank among classmates (rejected by the house rules).

## Owner answers and review fixes (2026-10-20)

**Owner answers**: only the student sees their own score. The institute does not see it. The score compares the student with their own last 4 weeks.

**Builder fixes from review**:
- "Module kept" means `scored` is true for the film (spec 0013).
- The window is a rolling 4 weeks, read at read time.
- A test proves that the inputs add up to the score.
- Open questions: the weight of each input (exams, study time, modules, habits), and what the three Brain lamps are (one thing or two).

## Review fixes (2026-10-22)

**The bell** (`waiting.mine`, `notification-bell.tsx`): read from the student's own rows when they look, stored nowhere. It lists a paper that is open now, a confirmed mark not yet read, and a feeling card from a study hour that ended in the last day. Each item has a button into its room. Only a student has a bell, and a student who withdrew gets nothing.

**The lamps** (the Brain's three lamps, spec 0020): each lamp counts one third of the score, and the score is the mean of the lamps that have a value, times 100. The Viveka lamp is four films kept in 28 days (a builder default, to confirm). A day that holds only a real zero (a habit open and not ticked, an hour open and not sat) is not a logged day. Movement is worked out in whole thousandths, so a rise of 0.6 over 0.5 and of 0.4 over 0.3 both read "rising". The formula is `METRIC_VERSION` 2, and stored days of version 1 are rebuilt from the events.

