# 0018. After session feeling card

**Date**: 2026-10-22
**Status**: In Progress

## Summary

When a study hour stay of 20 minutes or more ends, the student is offered one small card: how they felt (energised, okay or drained) and their focus from 1 to 5. It can be skipped, and a skip is stored as a skip and changes no value. An answer writes one event of fixed codes and one small number. The same card will serve a DHI desk sitting of 10 minutes or more once the desk opens. This spec was written after the build, from scope row 16 and the Master Spec (calculation rule 7), and it records the choices made, so the owner can confirm them.

## Requirements

**User stories**:
- As a student, I want to say how a sitting felt in two taps, or skip it, so that nothing is forced.
- As the owner, I want a skip to change no value, so that the felt okay and focus measures only hold answers.

**Acceptance criteria**:
- **AC-1**: A stay of 20 minutes or more in the study hour (10 minutes or more at the desk, later) marks its seat "pending" when it ends, whether the student leaves, the heartbeat stops or the hour closes. A shorter stay does not. A card is offered for 24 hours, and then it is left alone.
- **AC-2**: An answer is one of three feelings and a whole focus from 1 to 5. Anything else is refused and nothing is stored. An answer writes one `hour.felt` event with the feeling, the focus, the time band of the start (before 18:00, 18:00 to 21:00, after 21:00, India time) and the length band (under 40 minutes, or 40 or more).
- **AC-3**: A skip is stored as "skipped", changes no value and writes no event. A card answered or skipped cannot be answered again.
- **AC-4**: A student can answer or skip only their own seat. Another student's seat is not found.
- **AC-5**: Only a student has a card. The answer is never shown to staff by name; it reaches the Brain only through the event log.
- **AC-6**: The seat's card status, feeling and focus are in the student's export and are deleted with the seat when they are erased.

## Decision

**Chosen option**: the card status lives on the seat row (`feedbackStatus`, `feel`, `focus`), not in a new table, because a feeling belongs to one seat, and the seat's export and erase then cover it with no new rule. The Master Spec's `session_feedback` table is not built as a separate table.

**What is decided**:
- **Subject.** The scope says answers reach the log "with their subject". A study hour stay has no subject (it is a room, not a topic), so the event carries none. The desk sitting will carry the subject chosen there. This is an open question for the owner (see the follow up).
- **Offered for 24 hours.** A card nobody answers is treated like a skip.
- **No event for a skip.** The seat row records it.

## Feature design

**Data**: three optional fields on `seats` (spec house/0015): `feedbackStatus` ("pending", "answered" or "skipped"), `feel`, `focus`.

**Functions** (`sessionFeedback.ts`, each starts with `requireMember` and a student check):

| Function | Kind | Inputs | Output | Errors |
|---|---|---|---|---|
| `sessionFeedback.pending` | query | none | the newest pending card of the last 24 hours (seat id, source, minutes), or null | `forbidden` |
| `sessionFeedback.answer` | mutation | seat id, feel, focus | `{ ok: true }` or `{ ok: false, code }` | returned: `not_pending`, `expired`, `bad_feel`, `bad_focus`; thrown: `not_found` |
| `sessionFeedback.skip` | mutation | seat id | `{ ok: true }` or `{ ok: false, code }` | returned: `not_pending`; thrown: `not_found` |

**Value sourcing**: the time band comes from the seat's `enteredAt` in India time. The length band comes from the whole minutes between `enteredAt` and `leftAt`. The event time is `leftAt`, so the answer counts for the day of the stay. Nothing in an answer comes from the browser except the feeling and the focus.

**Key invariants**: a skipped or unanswered card leaves the feeling and the focus empty. The event holds codes and one small number, never text.

## Build plan

1. [x] The card rules in `sessionRules.ts` and the fields on `seats`. Satisfies **AC-1**.
2. [x] `sessionFeedback.ts`, the `hour.felt` event type and the offer from the seat ending code. Satisfies **AC-1** to **AC-4**.
3. [x] The card on the study hour screen, the export columns and the erase. Satisfies **AC-5**, **AC-6**.
4. [x] Tests (`sessionFeedback.test.ts`) and the browser proof (`pnpm hour:check`).
5. [x] The desk sitting offers the same card at 10 minutes, now the desk is open (2026-10-24, see "The desk part" below).

## The desk part (2026-10-24)

Owner answers: a desk sitting is a run of questions with no gap over 15 minutes (length is the first question to the last), and the student may pick a subject on the card.

- **Sitting.** `deskSittings` (one row per run, per student). `desk.begin` calls `touchSitting` whenever a question is stored (a model answer or a stored one; a care answer and a refusal are not a sitting). The minute job `deskSitting.closeSittings` ends a run idle for more than 15 minutes and marks it `pending` (10 minutes or more) or `none`.
- **Card.** `deskSitting.pending`, `answer` and `skip` follow the study hour's rules: offered for 24 hours, answered or skipped once, a skip writes no event, another student's sitting is not found. The answer writes `desk.felt` (feeling, focus, time band of the first question, length band, and an optional subject from maths, science, english, social, hindi, other). Bad feeling, focus or subject is refused and nothing is stored.
- **Brain.** E09 and E10 read `desk.felt` beside `hour.felt` (`METRIC_VERSION` 4: stored days are rebuilt from the events).
- **Screen.** `desk/desk-feeling-card.tsx` on the desk, and the bell lists a feeling card for the room `dhi`.
- **Data.** The sitting's status and answer are in the download (pages with cursor `s:` after the talks) and deleted with the student.
- **Desk minutes.** When the minute job ends a sitting of a minute or more it also writes one system event `desk.present` (the whole minutes, nothing else). The Brain reads it as X02, a plain measure (owner, 2026-10-24): no lamp, no home score, no real zero, not a logged day on its own, and not in the parent page. It is stored in the daily values only; the Progress page does not list raw measures.
- **What a sitting held.** Each sitting counts its questions and how many were write, paper or mock (`turns`, `activeTurns` on `deskSittings`, counts only). The minute job writes one system event `desk.mode` {turns, active} for each finished sitting, which the Brain reads as A10 and A12 (spec 0019, `METRIC_VERSION` 6).
- **Tests.** `deskSitting.test.ts` (18 tests) and metric tests.

## Consequences

**Positive**: two taps, skippable, and no new table.

**Negative / tradeoffs**: a study hour stay has no subject, so the later subject breakdown of felt okay and focus can only use the desk's sittings.

## Follow-up

- [ ] Owner: confirm that the study hour event carries no subject (or say what the subject of a study hour stay should be).
- [x] The desk offers the card when it opens (row 15). Built 2026-10-24.
- [ ] The Brain's measures E09 and E10 read `hour.felt` events (row 17).
