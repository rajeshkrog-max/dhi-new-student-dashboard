# For the legal check

For the person who checks the house's consent and privacy against the DPDP Act before any real student enters (owner gate 3 in `OWNER-GATES.md`). It names what to read and what to decide. Every word here is a draft (`HOUSE_WORDS_APPROVED` is false), and only made up people are loaded until the check is done.

## 1. What to read

1. **The house notice**, version `house-v2` (10 lines): `docs/launch/words/english.md`, the first section, or `packages/backend/convex/consentText.ts` (`HOUSE_NOTICE_LINES`). A student reads it to the end and taps I agree before any room opens.
2. **The parent wording**, version `house-parent-v1` (3 lines), the same section (`HOUSE_PARENT_LINES`). For a student under 18 (or with the flag missing) the school records that it holds the parent's written consent; DHI keeps who recorded it, when, and which wording, and nothing about the parent.
3. **The weekly parent page** words (`PARENT_COPY` and `LINK_COPY` in the same file): off until the student turns it on; the student makes a private link and gives it to the parent; it shows days logged in each room over 7 days and three growth marks, never a mood, a note, sleep, meals, a pattern or anything written.
4. **The data kept and for how long**, below (from `packages/backend/convex/dataMap.ts`, which a test keeps complete).

## 2. Questions for the check

1. Is the school's record of the parent's written consent "verifiable parental consent" under DPDP for a student under 18, or must DHI collect it directly?
2. Is the notice clear enough for a 13 to 17 year old, and does it name everything it must (purpose, what is kept, who sees it, rights, retention, the grievance contact)?
3. **Missing from the notice today (found 2026-10-27):** the DHI desk. A student's questions to the desk are sent to an outside model provider (OpenAI, outside India) and kept as the student's talks; a question asked in the same institute can be answered from a stored answer for 90 days (stored by a hash of the question, with no student in it). The notice lists the rooms and says "only you can see" without the desk. It needs a line (and a new notice version, which asks every student to agree again).
   **Also missing (found 2026-10-27): counseling** (house spec 0024). Every counseling call is recorded and transcribed on Stream (Stream.io, a US company; the recording came from its Mumbai storage), by the owner's choice, and the files stay on Stream. The counselor sees the student's first name, class, school and note, and can share the recording with a named house member who asks for it. The room's own words say this before a student books and before they join, but the notice does not. The same new notice version should name it. To decide: is the recording of a minor's counseling call allowed on the school's parent record alone, how long Stream keeps the files (no deletion is scheduled except on erase), and whether a share needs the student's own yes.
   **Also missing (found 2026-10-28): the study hour call** (house spec 0027). Students, mostly under 18, can join a group call with camera and voice, with only their own school's students. Every call is recorded on Stream (the owner's choice) and kept 30 days; that school's teachers and the DHI team can watch any recording at any time and may share one with a student who asks. The card says this before a student joins; the notice does not. To decide: is recording a group call of minors allowed on the school's parent record alone, is 30 days right, and should a share need the agreement of the other students in it.
4. The notice says the data is stored with Convex "on servers outside India" and promises to name the place. The development deployment runs in `ap-southeast-2` (Sydney); the production region must be read from the production dashboard and written into the notice.
5. Retention: are 30 days for the study hour chat, 90 days for desk answers and parent links, 12 months before a removed member is erased, and 3 years for the record of staff looks the right numbers (all the builder's defaults, owner gate 6)?
6. The grievance contact `privacy@dhirise.com`: is it monitored, and does DPDP need a named officer?

## 3. Data kept and for how long

Erase class: **erased** (deleted when the person is erased), **kept** (stays: ids and codes only, or the proof of what was agreed), **patched** (the row stays with the personal fields emptied), **system** (no personal data).

| Table | Class | What and how long |
|---|---|---|
| `institutes` | kept | Kept. No person in it. |
| `classes` | kept | Kept. No person in it. |
| `classPauses` | kept | Kept. No person in it. |
| `members` | patched | Until erased; then a tombstone with no name or email, kept as the proof of the consent that applied. A member removed for 12 months is erased. |
| `teacherClasses` | erased | Deleted when the teacher is erased. |
| `invites` | patched | Pending invites are revoked and every invite for an erased person's email loses its name and email. |
| `accessLog` | kept | Kept. Ids and fixed codes only. |
| `consentRecords` | kept | Kept after an erase as the proof of what was agreed. Ids, codes and a wording version only. |
| `sharingSettings` | erased | Deleted when the student is erased. |
| `funnelLinks` | erased | Deleted when the student unlinks or is erased. The date the student linked their DhiRise check; nothing from the check itself. The funnel's own rows are not touched. |
| `parentLinks` | erased | A hash of the link code, never the code. Deleted when sharing is turned off, when the student removes the link, after 90 days, or when the student is erased. |
| `viewLog` | kept | Kept for 3 years, then deleted by the daily sweep. Ids and codes only. |
| `houseErasures` | kept | Kept. The receipt of an erase: counts only, no student id. |
| `houseErasedEmails` | system | Deleted when the 30 day block ends. A keyed hash, never the email. |
| `classTotals` | kept | Kept. The first answer of a class total for one complete month: a class, a kind and a count, no person in it. |
| `habitPlans` | erased | Deleted when the student is erased. Their habits: the kind, their own title, a colour and a window. Seen by the student alone. |
| `habitChecks` | erased | Deleted when the student is erased. One row for each habit and day ticked. |
| `papers` | kept | Kept. The teacher's paper: its title and questions, which hold no student's words. |
| `paperQuestions` | kept | Kept with the paper. The right answers and tags are the teacher's own material, and hold no student's words. |
| `paperSends` | kept | Kept. Ids, codes and times only; the student's link is the attempt row, which is erased with them. |
| `paperTopics` | kept | Kept. The topics of an institute's papers in the teachers' words; no person in it. A student's tap names a topic by its id, and is erased with the student (house spec 0028). |
| `classTopics` | kept | Kept. Which topics were sent to a class and when; no person in it (house spec 0028). |
| `paperAttempts` | erased | Deleted when the student is erased. Their marks and remarks, and the paper they belong to. |
| `blogPosts` | erased | Deleted when the student is erased. Their own writing: the title, the tag, the cleaned body and the photo, and the photo's file is deleted with the post. |
| `blogComments` | erased | Deleted when the student is erased. Their own comments. |
| `foods` | kept | The catalog is kept: food names and numbers, no person. A student's own dishes (custom, or published, whose catalog copy has no owner) are in their download and deleted when they are erased. |
| `mealPlates` | erased | Deleted when the student is erased. Their own plates: the food, the count, the meal and the time. |
| `films` | kept | Kept. DHI's own films: titles and references, and no student. |
| `filmChecks` | kept | Kept with the film. DHI's own check questions and their right options, and no student. |
| `filmProgress` | erased | Deleted when the student is erased. How far they watched each film, and whether its score was written. |
| `studyHours` | kept | Kept. DHI's clock: an open time and a close time, and no student. |
| `seats` | erased | Deleted when the student is erased. Where and when they sat in a study hour, and their mode. |
| `chatMessages` | erased | Deleted when the student is erased, and by the daily sweep after 30 days. Their own chat messages in a study hour, kept so a teacher can review them. |
| `sleepNights` | erased | Deleted when the student is erased. One row for each night: the bed time and the length. Seen by the student alone. |
| `moodDays` | erased | Deleted when the student is erased. The mood, their own few words and a line index. Seen by the student alone. |
| `deskSettings` | kept | Kept. The monthly coins DHI gives each student; no student in it. |
| `deskDaily` | system | Kept. How many desk questions reached the model on each day, for the whole deployment; no student in it. |
| `deskWallets` | erased | Deleted when the student is erased. Their coin balance and the month it was last topped up. |
| `deskThreads` | erased | Deleted when the student is erased. The title of each of their desk talks. Seen by the student alone. |
| `deskTurns` | erased | Deleted when the student is erased. Their questions to the desk and its answers, with the coins taken and the cost in tokens. Seen by the student alone. |
| `deskCache` | kept | Deleted 90 days after it was stored, by the daily sweep. A hash of the question (never its words) and an answer, with no student, scoped to one institute; a question with an email or a phone number is never stored. |
| `deskSittings` | erased | Deleted when the student is erased. When a run of desk questions began and ended, and the answer to the feeling card: the feeling, the focus and the subject. Seen by the student alone. |
| `counselSlots` | kept | Kept. A counselor's open times; no student in it. |
| `counselBookings` | erased | Deleted when the student is erased. Their booking: the time, the counselor, their own note and the counselor's short summary. Seen by the student and that counselor only. Each call is recorded and transcribed on Stream (never in a DHI table); the recordings of the student's sessions are deleted on Stream when they are erased. |
| `counselShares` | erased | Deleted when the student is erased. Who the counselor shared a session's recording with; the recording itself stays on Stream and is deleted there too. |
| `habitRatings` | erased | Deleted when the student is erased. Their weekly four answers on how automatic a habit feels. Seen by the student alone. |
| `learnTopics`, `learnStats`, `learnAnswers`, `fixItems`, `learnRounds`, `studyPlans` | erased | Deleted when the student is erased. The desk's learning loop (house spec 0031): each answer on a practice question, the wrong answers to go back over, the student's state on each topic and their own answer times, and a test day they planned for. Seen by the student alone. |
| `writtenAnswers` | erased | Deleted when the student is erased. A written practice answer, the model's points and mark, and a teacher's mark. A teacher of the student's class sees the answer without the name when the model is unsure or the student asks. The answer is sent to the outside model provider for marking (the notice needs the desk line). |
| `questionStats` | kept | How many answers a bank question had and how many were right; no person in it. |
| `hourShares` | erased | Deleted when the student is erased. Which study hour recordings a teacher or DHI admin shared with this student; the recordings themselves stay on Stream for 30 days. |
| `events` | erased | Deleted when the student is erased. |
| `brainDays` | erased | Deleted when the student is erased. Their daily values worked out from their events: numbers only, no words. Seen by the student alone. |
| `brainHides` | erased | Deleted when the student is erased. Which patterns they hid, and until when. |
| `brainState` | system | Infrastructure: where the rollup has read to, and the counts of the last nightly check. No person in it. |

A student erases from Your data at any time (two step confirm); the same email cannot join again for 30 days. The funnel's own tables (the DhiRise check) are not erased by the house: the student asks for that part separately, and Your data says so.
