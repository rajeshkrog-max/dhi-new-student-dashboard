# 0012. Exams room, real

**Date**: 2026-10-20
**Status**: In Progress

## Summary

A student opens a paper that the teacher has sent, inside its open window, and sits it. Starting it locks the other menus. Answers are saved as the student types, so they can leave and come back until the window closes. When time runs out, whatever is written is submitted automatically and sent to the teacher. A hint never reveals the answer. A window that closes with no submission stores one miss, and the attempt history stays.

## Requirements

**User stories**:
- As a student, I want to sit a paper inside its window so that I know when it is open.
- As a student, I want to leave and come back to a paper so that a closed tab does not cost my answers.
- As a student, I want a hint that helps me think without giving the answer.

**Acceptance criteria**:
- **AC-1**: A paper opens only inside its window (from its open time to its due time). Before or after, the student sees it closed and cannot answer.
- **AC-2**: Answers are saved as the student types. A student can leave and come back, and sees the answers they gave, until the window closes.
- **AC-3**: When the window closes, whatever the student has written is submitted automatically. Nothing is accepted after the close.
- **AC-4**: A hint response never contains the right answer, whatever the slider position.
- **AC-5**: A closed window with no submission stores exactly one miss for that student and paper.
- **AC-6**: A submitted attempt cannot be changed by the student.
- **AC-7**: Starting a paper locks the other menus until the student submits or the window closes.
- **AC-8**: Accepted feedback from the teacher is recorded once.

## Decision

**Chosen option**: Saved answers with automatic submission at the close, and a single miss on a window with no submission.

**Implementation skills**: none yet.

**Progress (2026-10-22)**: built and proven in a browser (`pnpm exams:check`, 11 of 11, with the blog).
- Server (`exams.ts`, 18 tests in `exams.test.ts`): start inside the window, questions with no answers or tags and a flag for whether a hint exists, saved answers, the choice check, submit, the automatic close, the single miss, another student's attempt refused, hints, `acceptFeedback`, and the minute sweep. A refusal is returned, not thrown, so a window closed by a call keeps its close.
- Close sweep: `exams.sweep` (every minute, `crons.ts`, index `by_status_and_dueAt`) closes every sitting whose window ended, including one nobody opened, so the teacher never sees an open attempt past its time. The student's next call also closes it if that comes first.
- Hints: a hint is one text a teacher writes for a question (up to 300 characters). `papers.create` refuses a hint that holds the right option's words or names its place ("option B", "(b)", "answer 3"); the sitting's questions carry only `hasHint`, never the text. **Changed from the sketch**: `exams.hint` is a mutation, not a query, because opening a hint is remembered on the attempt (`hintsOpened`, once for each question) and the Brain counts it. It returns `no_hint` when the question has none, and the same `not_open` and `closed` codes as the other calls. There is no slider step: one hint per question.
- `exams.acceptFeedback`: only on a confirmed mark, sets `acceptedAt` once (a second press changes nothing); `papers.mine` returns `accepted`.
- Events for the Brain (`eventTypes/exams.ts`): `exams.submitted` {auto, mcqTried, mcqRight, longDone, hints} or `exams.missed` {}, one for each attempt, written when the sitting ends (a closed window counts from its due time). A sitting with nothing answered, also one that is submitted by hand, is a miss. The sweep carries on if the log refuses an event (a withdrawn consent, say), because the room's row is the record.
- Allowance: `examWrite`, 1200 a hour for each student with a burst of 300 (every write); a refusal is returned as `slow_down`.
- Long answers are kept 4 seconds after the student stops typing, when they leave the box and when they leave the screen, so a window that ends costs at most a few seconds of typing.
- Menu lock: client side only, and only while the sitting is open on screen. "Leave for now" unlocks the house, because a window can last days; the server never depends on it. If the owner wants the house locked for the whole window, say so and it is a small change.
- Not built: the late sitting display (a few seconds past the close), and whether a paper is also timed for each attempt (open questions below).

## Rationale

Saving as the student types protects answers from a closed tab. Automatic submission at the close means nothing waits on a button. The hint is built so the server never sends the answer, so the screen cannot reveal it either.

## Feature design

**Data model sketch**: uses the attempts table from spec 0011, plus `misses`: `memberId`, `paperId`, `day`, unique by member and paper.

**State transitions**: an attempt is `open` (answers saved), then `submitted` (by the student or by the close), then `marked` (spec 0011).

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `exams.start` | mutation | paper id | the attempt | student | `not_open`, `not_assigned` |
| `exams.answer` | mutation | attempt id, question id, answer | ok | student | `closed`, `submitted` |
| `exams.submit` | mutation | attempt id | ok | student | `closed` |
| `exams.hint` | query | question id, slider step | a hint text, never the answer | student | `not_open` |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| Open or closed | the current time | server clock, never the device |
| Auto submit | the close time | the paper's due time on the server |
| Hint | the hint text | a fixed hint per step, stored with the question, without the answer |

**Key invariants**:
- An answer can be saved only inside the window.
- A submitted attempt is never changed.
- At most one miss per student and paper.

**Security model**: a student sees and writes only their own attempts. The right answer never leaves the server.

**Critical test scenarios**:
- A save after the due time is refused, verifies **AC-3**.
- The hint response holds no answer at any step, verifies **AC-4**.
- Two closes never store two misses, verifies **AC-5**.

## Build plan

1. Open and closed rules from the server clock (satisfies **AC-1**).
2. Saved answers and resuming (satisfies **AC-2**).
3. Automatic submission at the close (satisfies **AC-3**, **AC-6**).
4. Hints that never reveal the answer (satisfies **AC-4**).
5. The single miss and menu locking (satisfies **AC-5**, **AC-7**).
6. Feedback recording and a proof (satisfies **AC-8**).

## Consequences

**Positive**: a student's answers survive a closed tab, and the close is fair.

**Negative / tradeoffs**: a student who leaves a paper open is submitted when the window closes, even if they have stopped.

## Follow-up

- [x] Hint texts are written by the teacher for each question (the form has the field), and the server refuses one that gives the answer away.
- [ ] Decide how a late sitting (a few seconds past the close) is shown to the student.

## Rationale

Options considered: a Submit button with a grace period (rejected, it reopens the close), automatic submission (chosen), and a locked paper with unsaved work kept for the teacher (rejected, it makes disputes).

## Owner answers and review fixes (2026-10-20)

**Owner answer**: a window that closes with no answers counts as a miss. The empty attempt is kept as history.

**Builder fixes from review**:
- `exams.hint` checks that the student is assigned to the paper, that the window is open, and that they own an open attempt.
- `exams.answer` and `exams.submit` check that the caller owns the attempt. A multiple choice answer must be a valid option index.
- `papers.create` takes `hints` per question and refuses a hint that contains the right option's text or letter.
- Add `exams.acceptFeedback`, which records `acceptedAt` once.
- The menu lock is client side only, and the browser proof says so.
- Open question: is a paper timed per attempt, or only by its window?

## Review fixes (2026-10-22)

**Excused windows**: a window that ends while the student's class has its logins paused (spec 0021) is not a miss. If the attempt holds no answers it closes as `excused`: no `exams.missed` event, no mark, and the teacher cannot mark it (`markLong` answers `not_submitted`). An attempt that already holds answers is submitted as usual. The student and the teacher are told it was excused.

**Sending**: `papers.send` refuses a paused class or a student of a paused class (`class_paused`) and a bad window (`bad_window`: shorter than a minute, longer than 14 days, or already over).

**Marking**: `papers.markLong` refuses the same question twice in one call (`bad_mark`), so a mark is never added twice, and refuses an excused attempt.

**Hint rule**: `hintGivesAnswer` also catches an option made only of marks such as "+", "option no. 2", "choice (c)", "the answer's B" and "(2)", and does not fire on "First answer a simpler question".

**Sweep**: `exams.sweep` closes 25 sittings at a time and schedules itself again while more are due, so one slow minute cannot hold up the rest. Lists are newest first (`desc`).

**Late submit**: pressing Submit a moment after the window ended answers `closed`. The screen tells the student that what they had written was submitted when the time ended, and the attempt is not changed.


