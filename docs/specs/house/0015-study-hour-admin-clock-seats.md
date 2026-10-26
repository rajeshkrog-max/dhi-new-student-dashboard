# 0015. Study hour: admin clock, live seats and chat

**Date**: 2026-10-20
**Status**: In Progress

## Summary

A DHI admin opens and closes the study hour. A student enters a seat only while the hour is open. Seats update live for everyone in the hour. A student can show as Live (their picture large, others beside them), Away (their profile only), or Do not disturb (no people and no chat). Chat is real time and every message is stored and moderated, so a teacher or DHI admin can review it. Minutes present reach the event log, as plain numbers.

## Requirements

**User stories**:
- As a DHI admin, I want to set the study hour clock so that the hour is fair across schools.
- As a student, I want to sit in a live seat, with my presence shown or hidden as I choose.
- As a teacher, I want to see and review chat messages in the study hour.

**Acceptance criteria**:
- **AC-1**: Only a DHI admin opens and closes the study hour. Institute staff and students cannot change the clock.
- **AC-2**: A student can enter a seat only while the hour is open. Entry before it opens or after it closes is refused.
- **AC-3**: Seats update live for everyone in the hour.
- **AC-4**: Leaving a seat, or the hour ending, drops the seat on the server.
- **AC-5**: Live shows the student's picture large and others beside them. Away shows the profile only. Do not disturb shows no people and no chat.
- **AC-6**: Chat is real time. Every message is stored and can be reviewed by a teacher or DHI admin. A student can report a message.
- **AC-7**: Minutes present are recorded in the event log as a number, with no name and no message.

## Decision

**Chosen option**: A DHI admin controls the clock. Seats are live, chat is real time and moderated, and minutes present go to the event log.

**Implementation skills**: none yet.

**Progress (2026-10-22)**: built. `studyHour.ts`, `hourRules.ts`, `hourRoom.ts`: the DHI clock with no overlap, seats in three modes split by institute, the heartbeat and a minute sweep that drops idle seats and writes presence minutes (one `hour.present` event, a number only), stored and moderated chat with report and hide, teacher review of their own classes, export and erase. 17 tests in `studyHour.test.ts`. Screens: `study/study-hour-real.tsx` and `staff/hour-section.tsx`. `pnpm hour:check` passes 5 of 5 (the dev helper `hourProof:openNow` opens an hour). Open: the chat retention period and message limit confirmation from the owner. Voice and video are a later row.

## Rationale

A single clock run by DHI keeps the hour the same for every school. Storing every chat message is what makes moderation possible, and the owner chose moderated real time chat over no chat.

## Feature design

**Data model sketch**:
- `studyHours`: `opensAt`, `closesAt`, `setBy` (DHI admin).
- `seats`: `hourId`, `memberId`, `mode` (`live`, `away`, `dnd`), `enteredAt`, `leftAt` (optional).
- `chatMessages`: `hourId`, `authorMemberId`, `text` (plain, length limited), `createdAt`, `reported` (boolean), `status` (`shown`, `hidden`).

**API surface**:

| Function | Kind | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `studyHour.set` | mutation | opens, closes | the hour | DHI admin | `forbidden`, `bad_window` |
| `studyHour.enter` | mutation | mode | the seat | student | `not_open`, `closed`, `rate_limited` |
| `studyHour.leave` | mutation | none | ok | student | none |
| `studyHour.seats` | query (live) | none | the seats the viewer may see | student | `not_open` |
| `studyHour.chat` | mutation | text | the message | student | `bad_text`, `dnd`, `rate_limited` |
| `studyHour.report` | mutation | message id | ok | student | `not_found` |
| `studyHour.review` | query | hour id | messages, for teachers and DHI admins | teacher, DHI admin | `forbidden` |

**Value sourcing**:
| Action | Value | Source |
|---|---|---|
| Open or closed | the current time | server clock, never the device |
| Seat | the student | `requireMember`, never an input |
| Presence minutes | the minutes | server times of `enteredAt` and `leftAt` |

**Key invariants**:
- A seat exists only while the hour is open.
- Do not disturb shows no one and sends no chat.
- Every chat message is stored.

**Security model**: students see only seats and chat of their own institute's hour. Teachers and DHI admins can review chat. No one reads a student's presence minutes by name except through the event log's class total rule.

**Critical test scenarios**:
- Entry before the hour is refused, verifies **AC-2**.
- A seat is dropped when the hour ends, verifies **AC-4**.
- Chat in Do not disturb is refused, verifies **AC-5**, **AC-6**.

## Build plan

1. The study hour clock, set by DHI admin (satisfies **AC-1**, **AC-2**).
2. Live seats and leaving (satisfies **AC-3**, **AC-4**).
3. Modes Live, Away and Do not disturb (satisfies **AC-5**).
4. Chat, storage, reporting and teacher review (satisfies **AC-6**).
5. Presence minutes to the event log (satisfies **AC-7**).

## Consequences

**Positive**: one clock keeps the hour fair, and moderation has the full record.

**Negative / tradeoffs**: storing every message keeps personal words on the server, so retention and erase rules must cover them.

## Follow-up

- [ ] Choose the live connection method (the realtime service). The spec does not name one yet.
- [ ] Confirm the chat retention period with the owner.
- [ ] Confirm the message length limit.

## Rationale

Options considered: a clock per institute (rejected, unfair across schools), one DHI clock (chosen), and chat with no storage (rejected, it cannot be moderated).

## Owner answers and review fixes (2026-10-20)

**Owner answers**: one DHI clock opens the hour for everyone, but each institute sees only its own students' seats and chat. Live updates use our Convex backend.

**Builder fixes from review**:
- Seats and chat messages store `instituteId`, and every read filters on it.
- Add `studyHour.setMode` so a student can change between Live, Away and Do not disturb.
- `studyHour.set` refuses overlapping hours.
- A seat is dropped after 60 seconds with no heartbeat. A closed tab never sets `leftAt`, so the heartbeat stops presence minutes from growing.
- `studyHour.review` filters by the reviewer's institute and class.
- `studyHour.report` only accepts messages in the caller's own hour.
- Add the event types for presence minutes, and the export, erase and data map steps.

## Review fixes (2026-10-22)

- The chat is deleted after 30 days by the daily `retention.sweep` (the builder's default, for the owner to confirm). A message younger than 30 days is kept.
- Teachers of the class and the DHI admin can read the chat to keep it safe. The notice (`house-v2`, spec 0005) now says so, and says the others in the hour can read it too.

