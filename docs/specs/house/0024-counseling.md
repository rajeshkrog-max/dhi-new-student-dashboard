# 0024. Counseling on Stream Video

**Date**: 2026-10-27
**Status**: In Progress

## Summary

A student books a 30 minute session with a DHI counselor and meets them in a video call inside the house. Counselors open their own times. The counselor sees only the student's first name, class, school and the student's own note, never anything from the rooms. Every call is recorded and transcribed on Stream, and the files stay on Stream. The counselor can watch the recording and share it with a named member of the house who asks for it, and can take the share back. School staff and DHI admins never see a booking. Built after the owner's answers below; it replaces the old "coming soon" screen and the mood room's demo help desk.

## Requirements

**Owner answers (2026-10-27)**:
1. Who sets the times? **The counselors**, each opening their own 30 minute times.
2. What does the counselor see? **The first name, class, school and the student's note.** Nothing from the rooms or the Brain.
3. Where does the call happen? **Inside the house, on Stream Video.** No outside meeting tool.
4. Recording? **Every call is recorded and transcribed**, and the recordings stay on the Stream dashboard (this changes the old rule in `BACKEND.md` that DHI never holds a recording; see Decision).
5. Who can watch it? **The counselor, and a named house member they share it with on request.** The counselor can take a share back.
6. Plan: Stream's free plan.
7. Locked during an exam sitting? **No** (2026-10-27): counseling stays open while a paper is open, like mood and Your data. A counselor sees no paper, and help is never shut off.

**User stories**:
- As a student, I want to book a time with a counselor, say in a few words what it is about, and meet them without leaving the house.
- As a counselor, I want to open my own times, see who booked and their note, meet them, and write a short note after.

**Acceptance criteria**:
- **AC-1**: A counselor opens a time on the hour or half hour, in the future, at most 60 days ahead, with at most 200 open at once, and can take back a time nobody booked. Only a counselor reaches these functions, and only for their own times.
- **AC-2**: A student sees the free times of the next 14 days with each counselor's first name, and books one with an optional note of at most 300 letters. A student has one open booking at a time. Two students cannot book the same time.
- **AC-3**: The student and the counselor can each cancel before the start; the time opens again. After the start neither can cancel.
- **AC-4**: The counselor's view of a booking holds the student's first name, class, school, the note, the summary and the number of shares, and nothing else. A booked session whose call window has closed reads as "Ended" on both screens.
- **AC-5**: The call opens 10 minutes before the start and closes 30 minutes after the end. Only the booking's student and counselor get a call token, for that one call. The call type `dhi_counsel` lets only a call's members join, and records and transcribes every call (auto on), with at most 4 people and 60 minutes.
- **AC-6**: Before joining, the lobby says the call is recorded and transcribed and who does not see it. In the call, a line says whether the recording is on, from Stream's live state.
- **AC-7**: After the start the counselor marks the session done with an optional summary of at most 1000 letters. Only that student and that counselor read it.
- **AC-8**: The counselor shares a session's recording with a house member by their email (at most 10 people a session) and can take it back. A shared person sees the time, the counselor's first name and the recording and transcript, never the note or the summary. Recordings are opened through `counselCall.media`, which returns Stream's own signed links to the counselor and the people shared with only.
- **AC-9**: No teacher, institute admin or DHI admin function reads a booking (`counsel` is a private kind in `accessRules.ts`). The student's download holds their bookings (time, counselor's first name, status, note, summary) and says the calls were recorded on Stream. Erasing the student deletes their bookings and shares and schedules the deletion of the sessions' recordings and transcripts on Stream.
- **AC-10**: The words are drafts (`COUNSEL_WORDS_APPROVED` is false) and pass the copy test: no label or rank, no illness word, the recording named, a helpline named.
- **AC-11**: The call screens pass axe (WCAG 2.0 and 2.1 A and AA) at 1280 and 360 px: the microphone, camera, share screen and leave buttons are the house's own, each with a name and its on or off state.

## Decision

**Chosen option**: Stream Video's React SDK in the page (loaded only when a call is opened) with a private call type, and a Convex action that signs a call token with the Stream secret, which never leaves the deployment. The booking id is the call id.

**Recordings on Stream (owner's choice)**: the old rule said DHI never reads or stores a counselor recording. The owner chose to record every call and keep the files on Stream, not in a DHI table. DHI's own tables still hold no recording, no transcript and no link to one; the links are asked from Stream when the counselor or a shared person opens them, and expire.

## Feature design

**Data**: `counselSlots` (`counselorMemberId`, `startsAt`, `endsAt`, `status` open, booked or closed; erase class `kept`, no student in it), `counselBookings` (`slotId`, `counselorMemberId`, `memberId`, `instituteId`, `startsAt`, `note`, `status`, `summary`, `summaryAt`; `erased`), `counselShares` (`bookingId`, `memberId`, `sharedBy`, `at`; `erased`). Room `counsel` in `eventShapes.ts` (no event is written yet). `counselRoom.ts` is the export and erase hook in `roomRegistry.ts`.

**Functions**:

| Function | Kind | Who | Output | Errors |
|---|---|---|---|---|
| `counsel.mySlots` | query | counselor | own times from a day back, each with its booking | `forbidden` |
| `counsel.openSlot`, `closeSlot`, `cancelByCounselor`, `finish`, `shareRecording`, `unshareRecording` | mutation | counselor | `{ ok }` | `bad_time`, `too_soon`, `too_far`, `too_many_slots`, `slot_taken`, `booked`, `started`, `not_started`, `summary_too_long`, `no_such_person`, `already_yours`, `too_many_shares`, `rate_limited` |
| `counsel.freeSlots`, `mine` | query | student | free times; own bookings | `forbidden` |
| `counsel.book`, `cancel` | mutation | student | `{ ok }` | `note_too_long`, `already_booked`, `slot_gone`, `started`, `rate_limited` |
| `counsel.sharedWithMe` | query | any member | recordings shared with them | |
| `counselCall.joinCall` | action | the booking's two people, in the window | `{ apiKey, token, user, callType, callId }` | `call_closed`, `calls_not_set_up`, `calls_unavailable` |
| `counselCall.media` | action | the counselor, a shared person | recordings and transcripts with Stream's signed links | `not_found`, `calls_unavailable` |
| `counselCall.setupCallType`, `forget` | internal action | run once; the eraser | | |

Limits: `counselWrite` 120 an hour for a counselor; `counselBook` 10 a day for a student. Needs `STREAM_API_KEY` and `STREAM_API_SECRET` on the deployment (dev and production share one Stream app) and `setupCallType` run once (done).

**Screens**: the student's Counseling room (`counsel/counsel-room.tsx`): bookings, free times by day with the note, shared recordings, the helpline. The mood room's help button opens it. The counselor's staff area shows only Sessions (`staff/counsel-section.tsx`) and Your data (with recordings shared with them). The call (`counsel/counsel-call.tsx`): a lobby, then the call. The content policy allows Stream's hosts (`*.stream-io-api.com`, `*.stream-io-video.com`, `*.getstream.io`, media from `*.stream-io-cdn.com`; the recording came from `mumbai.stream-io-cdn.com` on 2026-10-27), and the Permissions-Policy allows camera, microphone and screen capture for the house itself.

**Development only**: a test inbox can never claim a counselor invite, so `counselProof.makeCounselor` makes a made up `@example.test` account a counselor, `startNow` moves a booked session to a minute ago, and `seedDemo` gives the demo counselor a free time and a booking for the sweep. All refuse where the test sign in is off.

## Open

- The house notice does not yet name counseling or its recordings; it needs a line (a new notice version) before a real student books (`docs/launch/legal-check.md`).
- On Stream's free plan, recording and transcription minutes are limited; the owner watches the Stream dashboard.

## Checklist for the owner (not code)

- Approve the words (`COUNSEL_WORDS_APPROVED`, `src/lib/dhi/counsel-words.ts`).
- Add counseling and the recordings to the legal check of the notice.
- Invite the first counselor from the staff area with their Google email, once the words and the notice are approved.

## Tests

`convex/counsel.test.ts` (7 tests: AC-1 to AC-4, AC-7 to AC-9), `houseConsent.test.ts` (the private kind), `proofGuard.test.ts` (the development helpers), `src/lib/dhi/counsel-words.test.ts` (AC-4 status, AC-10), `src/lib/security-headers.test.ts`. Browser proof: `pnpm counsel:check` (14 steps, two browsers with fake camera and microphone on the real Stream app, the recording loaded under the content policy), `pnpm responsive:sweep --room counsel,staff-counsel` and an axe pass of the six counseling views (AC-11).
