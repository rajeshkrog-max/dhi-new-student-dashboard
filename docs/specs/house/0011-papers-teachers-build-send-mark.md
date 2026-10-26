# 0011. Papers: teachers build, send and mark

**Date**: 2026-10-20
**Status**: In Progress

## Summary

A teacher builds a paper with multiple choice and long writing questions. Each question has a subject and a topic. The right answers stay on the server and never reach a student's browser. The teacher sends the paper to a class or one student with an open time and a due time, then marks it. Long answers get an automatic suggested mark, which the teacher must confirm before a student sees anything. The suggestion runs inside our own system, not an outside AI service. That marking method is not chosen yet, so the suggestion part is held until it is.

## Requirements

**User stories**:
- As a teacher, I want to build a paper and send it to my class so that students sit it in a window.
- As a teacher, I want to mark long answers with remarks so that feedback is honest.
- As a student, I want to see my marks and remarks once the teacher confirms them.

**Acceptance criteria**:
- **AC-1**: A teacher builds a paper with multiple choice and long writing questions. Each question has a subject and a topic. Each multiple choice question has one right answer.
- **AC-2**: A right answer and a wrong option's tag (misread or concept slip) are stored on the server only. No student function returns them.
- **AC-3**: A teacher sends a paper to a class or to one student, with an open time and a due time. Only students assigned to it can see it.
- **AC-4**: A student cannot see a paper before its open time, and cannot see one that is not assigned to them.
- **AC-5**: A teacher marks long answers with a rubric and remarks. Marks and remarks become visible to the student only after the teacher confirms them.
- **AC-6**: A suggested mark for a long answer is produced only by a method that runs inside our system. Until such a method is chosen, no suggestion is produced and the teacher marks by hand.
- **AC-7**: A teacher can see only the papers and students of their own classes. The institute academic preview shows marks and remarks, never answers or tags.

## Decision

**Chosen option**: Teachers build and send papers inside the house. Long answers get a suggested mark from a method inside our system, which the teacher confirms before a student sees the result. The method is not chosen yet.

**Implementation skills**: none yet.

## Rationale

Keeping answers on the server protects the exam, and confirming marks before students see them keeps the teacher in charge. Keeping marking inside our system protects student writing from outside services, a choice recorded in the answers to the scope questions.

## Feature design

**Data model sketch**:
- `papers`: `teacherMemberId`, `instituteId`, `title`, `status` (`draft` or `sent`).
- `paperQuestions`: `paperId`, `order`, `kind` (`mcq` or `long`), `subject`, `topic`, `text`, `options` (for mcq), `rightOption` (server only), `tags` (server only).
- `paperSends`: `paperId`, `target` (class or member id), `opensAt`, `dueAt`.
- `attempts`: `paperId`, `memberId`, `answers`, `submittedAt`, `mark`, `remarks`, `markConfirmed`.

**State transitions**: a paper is `draft`, then `sent` (locked for editing). An attempt is `open`, then `submitted`, then `marked`, then `confirmed`.

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `papers.create` | mutation | title, questions | the paper | teacher | `bad_question`, `forbidden` |
| `papers.send` | mutation | paper id, target, opensAt, dueAt | ok | teacher of the class | `not_found`, `bad_window` |
| `papers.markLong` | mutation | attempt id, mark, remarks | ok | teacher | `forbidden`, `not_found` |
| `papers.confirm` | mutation | attempt id | ok | teacher | `forbidden` |
| `papers.mine` | query | none | the student's visible papers, no answers | student | `consent_required` |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| Send | the class's students | the class membership on the server |
| Student list | the open and due times | the `paperSends` row |
| Marks shown | the mark | `attempts.mark` after `markConfirmed` |
| Suggested mark | not produced | held until a method inside our system is chosen (AC-6) |

**Key invariants**:
- A right answer and a tag never leave the server.
- A student sees a mark only after confirmation.
- A paper reaches only its assigned students.

**Security model**: a teacher sees only their classes. A student sees only their assigned papers and their own marks. The academic preview shows marks and remarks, never answers.

**Critical test scenarios**:
- A student's `papers.mine` contains no answer or tag, verifies **AC-2**.
- A paper sent to one class is invisible to another class, verifies **AC-3**, **AC-7**.
- An unconfirmed mark is not visible to the student, verifies **AC-5**.

## Build plan

Progress (2026-10-22): steps 1 to 4 are built on the server with tests (`papers.test.ts`, 18), and the teacher screens are built and proven in a browser (`pnpm exams:check`, 12 of 12).
- **Named results go through `staffRead`** (house spec 0005). The earlier `papers.forTeacher` query returned names and marks with no record of the look, which the privacy wall does not allow, so it is replaced by `papers.openForTeacher`, a mutation: it checks that each student is in one of the teacher's classes now, writes one `viewLog` row for every student shown (the student sees it in Your data), then reads. It returns the questions with their rubric and right option, and for each student the status, marks, remarks and answers, so the teacher can read a long answer before marking it (the earlier screen could not show one). A student moved out of the teacher's classes, or one who withdrew, is left out without a word. A page holds 50 students; the screen pages. The teacher is held to 120 opens an hour (`staffOpen`). The marking screen opens once, again after each save or confirm, and on Refresh; it is not live.
- **Academic preview (AC-7)**: `papers.resultsForClass` (institute admin only, one class at a time, 50 a page) returns the confirmed marks and remarks, never an answer or a tag, through the same `staffRead`. The staff area has a Results tab for it.
- Hints per question and `hintsOpened` belong to spec 0012. Step 5 (suggested marks) is held by the owner's answer. A wrong option's tag is optional, as the spec says.
- Not done in this pass: a teacher who is not the paper's author cannot open the marking page (only mark or confirm by an attempt id); the author is the one marker for now.

1. [x] Tables and the paper builder for teachers (satisfies **AC-1**, **AC-2**).
2. [x] Sending to a class or a student, and the student's list (satisfies **AC-3**, **AC-4**).
3. [x] Marking long answers by hand, remarks and confirmation (satisfies **AC-5**).
4. [x] Teacher and preview scoping (satisfies **AC-7**): the teacher read (`openForTeacher`) and the academic preview (`resultsForClass`) are built, both through `staffRead`.
5. The suggested mark, once a marking method inside our system is chosen (satisfies **AC-6**).

## Consequences

**Positive**: teachers keep full control of marks, and student writing stays inside our system.

**Negative / tradeoffs**: until a marking method exists, teachers mark every long answer by hand, which takes longer.

## Follow-up

- [ ] Owner: choose a marking method that runs inside our system, or confirm we wait. Step 5 of the build plan cannot start without it.
- [ ] Confirm the rubric format the teacher uses.

## Rationale

Options considered: an outside AI marking service (rejected by the owner's answer), a marking method inside our system (chosen, not yet chosen concretely), and marking by hand only (the fallback until step 5).

## Owner answers and review fixes (2026-10-20)

**Owner answer**: teachers mark long answers by hand for now. No suggested mark is produced in this version. AC-6 and build step 5 wait for a later spec.

**Builder fixes from review**:
- Before a paper opens, a student sees only its title, subject, open time and due time. No question text, enforced in `papers.mine`.
- Multiple choice answers are marked automatically on the server at submission.
- Each question has a rubric with maximum marks. Marks are stored per question.
- A class send expands into one row per student at send time.
- `papers.markLong` and `papers.confirm` check that the caller is the paper's teacher or a teacher assigned to the student's class.
- A one student send checks that the student is in the teacher's classes.
- Add a teacher read of attempts and an academic preview query that shows marks and remarks, never answers.
- Open question: is a paper timed per attempt, or only by its window (`duration_sec` in BACKEND.md)?
