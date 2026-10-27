# 0025. The school report

**Date**: 2026-10-27
**Status**: In Progress

## Summary

A report for one class over a range of days, for the institute admin and the class's teachers. It is built only from the papers sent to the class: how many were sat on time or missed, the share of multiple choice answers right by subject, a topic heat map by week, a "re-teach" suggestion (the Master Spec's CR1), and a named academic support list with a plain reason for each name. The institute admin also sees the existing room counts (how many students used each wellbeing room in the last full month, 10 or more). Nothing comes from the Brain, the desk, counseling or a room's content. Taken from the Master Spec's school report and narrowed by the owner's answers below, to keep the 2026-10-24 decision that the Brain stays the student's alone.

## Requirements

**Owner answers (2026-10-27)**:
1. What it holds? **The papers' own numbers, plus the existing room counts.** The Master Spec's blocks built from the Brain (stress by weekday, desk time, the health profile) were not offered, because staff get no Brain totals (owner, 2026-10-24).
2. A named support list? **Yes, with paper reasons only.** The Master Spec's "no room had a log for 5 days" is left out: it would tell the school about wellbeing room use.
3. Who sees it? **The institute admin (any class of the institute) and a teacher (their own classes).**
4. Teacher actions? **CR1 only (re-teach a topic).** CR2 to CR4 read the Brain or the desk.

**User stories**:
- As a teacher, I want to see which topics my class finds hard and who has fallen behind on papers, so I can help them in class.
- As an institute admin, I want the same picture for each class, and to see that students are using the house.

**Acceptance criteria**:
- **AC-1**: `schoolReport.forClass` answers the institute admin of the class's institute and a teacher assigned to the class; everyone else (another class's teacher, another institute, a DHI admin, a counselor, a student) is refused `forbidden`.
- **AC-2**: Only students who stand in the class now and are through consent count; a withdrawn, removed or erased student counts nowhere and is never named.
- **AC-3**: A range is 1 to 91 India days (`bad_range`, `too_long`). The report reads the papers sent to the class with a due time in the range: papers, sittings closed, handed in, missed and excused (a class pause).
- **AC-4**: The share right is shown by subject (with the change from the first shown week to the last) and by topic and Monday week, each only when 5 or more students tried it. Heat map bands: under 50% peach, 50 to 64% gold, 65% and up mint.
- **AC-5**: CR1: over the last 3 weeks of the range, a topic with a class share under 50% that rose less than 5 points from its first shown week to its last shows "Re-teach {topic}" with the share and the change. It needs two shown weeks.
- **AC-6**: The support list is A to Z. A student is on it for two closed papers missed in a row (an excused one is skipped), or for a multiple choice share lower than the week before, two weeks running. Each name carries its reasons only: never a share, a mark, a score or an order by need.
- **AC-7**: Each open writes one access log row `school.report`. The named list is read through `staffRead` (kind `academic`), so each listed student, and only they, has a view row in Your data.
- **AC-8**: `schoolReport.roomCounts` (institute admin only) gives the six wellbeing room counts of one full month through `classTotal`, empty below 10 students.
- **AC-9**: The report's files read no Brain, desk, counseling, event or wellbeing room table (a source scan).
- **AC-10**: The words are drafts (`SCHOOL_WORDS_APPROVED` is false), say the numbers come from papers only and that the list is not a ranking, and pass the copy test.

## Decision

**Chosen option**: a mutation that works the report out when it is opened, from `paperSends` (a new index `by_classId_and_dueAt`), `paperQuestions` and `paperAttempts`, with the rules in a pure file (`schoolRules.ts`). Not stored: a report is a read of rows that already exist, so nothing new is kept and nothing needs erasing. A mutation, not a query, because the named list writes view rows.

## Feature design

**Data**: no new table. A new index on `paperSends`. A new access code `school.report`.

**Functions**:

| Function | Kind | Who | Output | Errors |
|---|---|---|---|---|
| `schoolReport.forClass` | mutation | institute admin, the class's teacher | class name, students, papers, closed, sat, missed, excused, weeks, subjects, topics with week cells, actions, the support list (name and reasons) | `forbidden`, `slow_down`, `bad_range`, `too_long` |
| `schoolReport.roomCounts` | mutation | institute admin | six room counts for one month (null below 10) | `forbidden`, `bad_period`, `slow_down` |

Papers sent to one student alone are not in a class report.

**Screen**: a "School report" tab in the staff area for the institute admin and teachers (`staff/school-report-section.tsx`): the class, the days (the last four weeks by default), Open, then the totals, the subject table, the heat map (both scroll sideways on a phone and can be reached by keyboard), the suggestions, the support list, and for the admin the room counts.

## Checklist for the owner (not code)

- Approve the words (`SCHOOL_WORDS_APPROVED`, `src/lib/dhi/school-words.ts`).
- A PDF of the report is not built; say if a school needs one.

## Tests

`convex/schoolRules.test.ts` (11: AC-3 to AC-6), `convex/schoolReport.test.ts` (8: AC-1 to AC-9), `houseCore.test.ts` (the access code), `src/lib/dhi/school-words.test.ts` (AC-10). Browser proof: `pnpm school:check` (4 steps), `pnpm responsive:sweep --room staff-report` and an axe pass at 1280 and 360.
