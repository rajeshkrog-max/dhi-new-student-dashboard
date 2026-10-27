# 0027. Voice and video in the study hour

**Date**: 2026-10-28
**Status**: In Progress

## Summary

A student in a Live seat can join the study hour's call: camera and voice, inside the house on Stream Video, with only their own institute's students. Every call is recorded on Stream. That institute's teachers and a DHI admin can watch any recording at any time, join the open hour to moderate (mute, remove), and share a recording with a student of that institute who asks. Recordings are deleted on Stream after 30 days. Built on spec 0015 (the study hour) and the Stream setup of spec 0024 (counseling).

## Requirements

**Owner answers (2026-10-28)**:
1. What kind? **Camera and voice** (offered: camera only and silent, the recommended option; voice only).
2. Recorded? **Yes, on Stream** (the recommended option was never recorded).
3. Who may watch? **That institute's teachers and a DHI admin, every recording, any time, and either may share one with a student who asks.** This changes the house rule that a DHI admin never sees room content: for study hour recordings it now does, by the owner's choice.

**Defaults the builder chose (say if any should change)**: only a Live seat joins; camera and microphone start off; teachers and DHI admins join as moderators who can mute or remove; a share reaches only a student of that institute; recordings are kept 30 days (like the chat); no transcript; at most 50 people in one call.

**Acceptance criteria**:
- **AC-1**: A student joins only from a current Live seat in the hour open now, and only their own institute's call (`not_live`, `not_open`). Away and Do not disturb have no call; changing away from Live leaves it.
- **AC-2**: A teacher joins their own institute's call as a moderator; a DHI admin names the institute; an institute admin, a counselor and another institute's teacher cannot.
- **AC-3**: The call type `dhi_hour` is private (members only), records every call, has no transcript, starts camera and microphone off, and holds at most 50 people. The call id is a short hash of the hour and the institute. Before joining, the card says the call is recorded, who may watch it, for how long, and that only the school's students are in it; in the call, a line says whether the recording is on.
- **AC-4**: That institute's teachers and a DHI admin open the recordings of any hour of the last 30 days in which the institute had anyone seated. Another institute's teacher, an institute admin and a student without a share cannot.
- **AC-5**: A teacher of the institute or a DHI admin shares an hour's recording with a student of that institute by email (at most 20 a recording) and takes it back; the student then sees it in the study hour.
- **AC-6**: Each staff opening of a recording writes one view row (kind `hour`) for every student seated in that hour, through `staffRead.recordGroupLook`.
- **AC-7**: A daily job deletes on Stream the recordings of hours that closed more than 30 days ago.
- **AC-8**: The student's download names the day of each recording shared with them; erasing the student deletes the shares made to them. (A group recording is not deleted on one student's erase, because others are in it; it goes after 30 days.)
- **AC-9**: Every call screen passes axe at 1280 and 360 px, with the house's own named buttons (shared with counseling), and no layout shift when the card arrives.
- **AC-10**: The words are drafts (`HOUR_CALL_WORDS_APPROVED` is false) and pass the copy test.

## Feature design

**Data**: `hourShares` (`hourId`, `instituteId`, `memberId`, `sharedBy`, `at`; erase class `erased`). No recording, link or transcript is stored in a DHI table.

**Functions**: `hourShares.ts` (V8): `joinAccess` and `watchAccess` (internal), `recordWatch` (internal), `recordedHours`, `share`, `unshare`, `sharedWithMe`, `openNow`, `oldCalls` (internal). `hourCall.ts` ("use node"): `joinHourCall`, `recordings`, `setupCallType` (run once; done on the shared Stream app on 2026-10-28 with the owner's yes), `sweepRecordings` (daily cron). `hourCallRules.ts` (pure, shared as `@dhi/backend/hourCallRules`).

**Screens**: the study hour room gains the call card under the chat for a Live seat, and "recordings shared with you". The staff area gains "Hour calls" for teachers and DHI admins: join to moderate, the recorded hours with their recordings, share and take back. `call/device-buttons.tsx` is now shared by both calls.

## Open

- The house notice does not name the study hour call or its recordings; it needs a line (a new notice version) before real students join (`docs/launch/legal-check.md`).
- On Stream's free plan a group call uses participant and recording minutes quickly; the owner watches the Stream dashboard.

## Tests

`convex/hourShares.test.ts` (10: AC-1, AC-2, AC-4 to AC-8), `convex/hourCallRules.test.ts` (the call id), `houseConsent.test.ts` and `privacySweep.test.ts` (the view record writers and the download), `src/lib/dhi/hour-call-words.test.ts` (AC-10). Browser proof: `pnpm hourcall:check` (8 steps on the real Stream app with fake cameras: two students and a moderating teacher, the recording played from `mumbai.stream-io-cdn.com`, a share and its removal); `counsel:check` and `hour:check` rerun; the sweep of the study hour scenes; an axe pass of the card, the call and the staff page.
