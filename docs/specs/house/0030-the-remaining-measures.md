# 0030. The remaining Master Spec measures

**Date**: 2026-10-28
**Status**: In Progress (built; the words are drafts)

## Summary

The Brain now stores or works out every measure of the Master Spec's catalog that the house can feed. Nineteen are added: the stress level and when stress shows (E04, E07), why paper answers went wrong (A07), answer pace (A08), the day 21 matched paper (A20), asked for help (E17), the forgiving streak (H09), desk time by subject (A11), the teacher's rubric (A03), how automatic a habit feels (H10), the film checks and their effect on papers (A16, A17), help given (A19), doubts resolved (A18), and, with the desk's learning loop of spec 0031, recall after 7 days (A04), old mistakes fixed (A05), recall rounds (A13), topics held (A09) and the weak topic follow up (A14). They show on the student's Progress page under "Your measures", in English and Hinglish. Like X02, they are plain measures: no lamp, chain, home score or parent page reads them.

## Requirements

**Owner answers (2026-10-28)**: the owner chose "go with your recommendation" for every question of this run. So: none of the new measures feeds a lamp or the home score; they are shown to the student only.

**Defaults the builder chose (say if any should change)**:
- E04 is a word (low under 15% of mood days, in the middle from 15 to 35%, high over 35%), never a number shown to anyone but the student. It is not on the parent page (spec 0022 stays as it is).
- E07's contexts follow the Master Spec, in order: a paper due the next house day, then 3 or more hours of study hour and desk minutes that day, then other. The row shows only with 3 or more such days in 28.
- A07: misread by the paper author's tag on the chosen option; careless when the student got the topic right on 2 of their last 3 answers and answered in under half their own median time (their newest 30 timed answers, at least 5); concept for the rest. Worked out at submission from the student's state before the paper.
- A08: the seconds from the previous answer saved (or the start) to a multiple choice question's first choice, up to 10 minutes; a changed choice keeps the first time. Shown as the mean of the 28 days.
- A20: a teacher may mark a new paper as repeating one of their own earlier sent papers ("this paper repeats an earlier one"). The gain is this paper's share right minus the earlier one's, in points, for a student who sat both.
- E17 counts counseling bookings (`counsel.asked`, an event with nothing in it). The Brain is the student's alone, so no staff function reads it.
- H09: days with a log of the student's own, one missed day in any seven forgiven; today never counts as a miss.
- A11: a desk sitting's minutes go to the subject the student tapped on its card (`desk.felt` version 3 carries the minutes); the share is over all desk minutes (X02).
- A03: when marking, a teacher may give three scores of 0 to 4 for each written answer (understanding, structure, expression); all three or none. They reach the Brain when the mark is confirmed (`exams.remarked`, written by the teacher).
- H10: once a week for each open habit, four lines of 1 to 7 ("I do it without having to remember", "without thinking much", "I start it before I notice", "it feels odd not to do it"). The week turns on Monday at 04:00.
- A16: an academic film's two checks, answered once after the film is kept; the right options come back only after the answer. A DHI admin may give an academic film a subject and topic in the teachers' words; it is matched in each student's own institute.
- A17: for a film's topic, the share right on that topic's paper answers in the 7 days before the checks and the 7 days after, shown only with 4 or more answers on each side.
- A19: the post's author marks a classmate's approved comment "This helped me", once. The event goes to the commenter, written by the system (a student never writes another student's event).
- A18: "This solved my doubt" on an answered plain question (chat), within 6 days; the bottom part is the plain questions of the day's sittings (`desk.mode` version 2 carries `doubts`).
- A04, A05, A13 and A09 come from `desk.answered` and `desk.mastered` (spec 0031). A14 counts the topics a paper got wrong that the student practised or tapped on the desk the same day or within 3 days.

**Acceptance criteria**:
- **AC-1**: `METRIC_VERSION` is 9; each new daily measure has a fixture in `metricRules.test.ts` with its expected top and bottom, and stored days are rebuilt.
- **AC-2**: A measure worked out from another log (E04, E07, A07, A08, A20), the teacher's rubric (A03), a helpful mark (A19) and the desk's practice (A04, A05, A09, A13, A18) are not a log of their own; the rubric and a helpful mark do not make a day of showing up (C01).
- **AC-3**: No lamp, chain, home score, parent page or staff function reads a new measure. The report's `measures` are the signed in student's own.
- **AC-4**: Each new input checks its owner and its range: a rubric score outside 0 to 4 is `bad_rubric`; the feels check needs four whole numbers of 1 to 7 and refuses a second answer in the week; a film's checks need the film kept and are answered once; only the post's author marks a comment, not their own, once; a doubt is resolved only by its asker.
- **AC-5**: The words are drafts (`BRAIN_WORDS_APPROVED`, `HABIT_WORDS_APPROVED`, the modules room's own lines) and pass the Brain's copy lint in both languages.

## Cost on the free plan (house spec 0029)

No new cron and no new timer job. The new inputs are a few writes a student a week. The one new read is the "paper due tomorrow" fact, an indexed range of one or two rows on a day with a mood (`paperAttempts.by_memberId_and_dueAt`). Estimate for one class of 40: under 5,000 calls and under 20 MB of reads and writes a month.

## Tests

`metricRules.test.ts` (a fixture for every measure, the derived rule, E07's order, A18's cap, the streak, desk time by subject, a film's effect, the weak topic follow up), `measures.test.ts` (film checks, a helpful comment, the counseling event, the report's block for the student only), `learn.test.ts` (the feels check, a resolved doubt, the rubric event, a matched paper's gain, why a paper answer went wrong), `brain-words.test.ts` (the rows in both languages and the copy lint). Browser: `pnpm learn:check` (the feels check, a film's checks, a resolved doubt, Progress showing A05 and H10), `exams:check` (the builder's key points box). Sweep: `habits`, `modules-checks`, `progress`, `staff-papers`. axe: clean at 1280 and 360.

## Still open

- The words are drafts until the owner approves them.
- The parent page could later show the E04 word when sharing is on (the Master Spec allows it); not built, because spec 0022 is the owner's narrower choice.
