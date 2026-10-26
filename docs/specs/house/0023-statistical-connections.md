# 0023. Statistical connections in the Brain

**Date**: 2026-10-26
**Status**: In Progress

## Summary

The Brain can now show a connection: two things in the student's own days that tend to go together, found by a fixed list of comparisons and a strict test, so a coincidence is not shown. It is the Master Spec's connections engine, built for the four pairs the rooms can already feed. It is the student's alone, like the rest of the Brain: no teacher, institute admin, DHI admin or counselor function reads it, and the parent page never carries it.

## Requirements

**Owner answer (2026-10-26)**: build the connections with the other deferred items ("all").

**The pairs built** (`connectionRules.ts`, ids in `brainCodes.ts`):
- `sleep_papers` (P1): the share of paper answers right on a day after a bedtime before 23:30, against a later bedtime.
- `breakfast_focus` (P2): the focus a student rated after studying on a day with breakfast before 11:00, against a day with a meal but no breakfast. A food guard shows it only when the breakfast side is higher, so nothing suggests that skipping a meal helps.
- `bedtime_mood` (P3): the share of days with a light mood after an early bedtime, against a later one.
- `late_room_feeling` (P5): how the next day's session felt after a study room day that ran 30 minutes or more past 23:00, against one that did not.

Not built: P4 (a desk day and the next paper on the same topic) and P6 (a subject and the feeling after it). They need topic and subject tags the rooms do not capture yet. They still count as untested pairs in the correction, which only makes it stricter.

**Acceptance criteria**:
- **AC-1**: Each side of a pair needs at least 14 finished days. Today is never read. A day the pair's rule does not name is in neither side.
- **AC-2**: A connection is shown only if the 95 percent bootstrap interval of the difference of the means leaves out 0 and it survives a Benjamini Hochberg correction over all six pairs at q below 0.1.
- **AC-3**: The resampling uses a seeded generator, so the same days always give the same answer and a connection never flickers between two looks.
- **AC-4**: The server sends the pair id, the two means (whole percents, or the focus out of five with one decimal) and the days behind each side. The words are the screen's (`CONNECTION_COPY`, English and Hinglish): "tend to go together", never a cause, always the student's own days, always the number of days, and a note that it is not a judgement.
- **AC-5**: A connection can be hidden for 30 days with "does not feel true", like a pattern, and shown again. Nothing is stored about connections except that hide.
- **AC-6**: The connections read the last 120 finished days (about four months). Nothing is stored; they are worked out when the student looks.
- **AC-7**: No staff function, class total, access log or view log reads a connection, and the weekly parent page does not carry one. The files of the connections and the Brain are scanned for the staff read functions.
- **AC-8**: The words are drafts (`BRAIN_WORDS_APPROVED` is false) and pass the Brain's copy rules (no ranking, clinical or food judging word, no cause word, no order, no stray digit).

## Tests

`connectionRules.test.ts` (the statistics, each pair, the 14 day minimum, the food guard, today ignored), `brain.test.ts` (the report, hide and show, the same answer twice, staff refused, the source scan) and `brain-words.test.ts` (the copy rules for every pair in both languages).

## Still open

P4 and P6 once topic and subject tags exist. Whether to widen the list is the owner's call, and every pair added makes the correction stricter.
