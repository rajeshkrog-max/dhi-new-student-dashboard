# Scope: DHI student house, platform and safety

The ground every room stands on: real accounts and roles, the one event log every room writes to, and the consent and privacy rules for students under 18. Nothing in the rooms or the Brain should start before these have a spec. See [index.md](index.md) for the whole house scope.

## Foundations

### 2. People, roles, invites and institutes · in-progress
Real accounts for the house: institutes, the five roles (student, teacher, institute admin, DHI admin, counselor), invite only entry, and one check that every server function makes so a person only ever reads their own institute's rows. It replaces the demo gate and the fixed demo student. The counselor role exists but has no screens yet. It builds on the shared sign in and the one account row in the [repo wide scope](../_root/scope.md) (rows 2 and 4).
**Done when:** an invited student signs in with Google and lands in their own house, a person with no invite is turned away, a student cannot read another student's or another institute's rows by any route, and the demo gate and the fixed demo id are gone from the running app.
- [x] Design it (spec): `/architect people, roles, invites and institutes`
- [x] Build it: `/develop people, roles, invites and institutes`
   - [x] The thread: tables, entry check, Join step, first DHI admin (AC-1, AC-3, AC-6, AC-12)
   - [x] Institutes, staff area, classes and teachers (AC-2, AC-7, AC-8, AC-16, AC-18)
   - [x] Invites and class list upload, with the daily cap (AC-4, AC-5, AC-6, AC-11, AC-17, AC-19)
   - [x] Removal, last admin guards and the clean up change (AC-9, AC-10, AC-11, AC-15)
   - [x] Retire the demo gate, seeded demo institute and the proof matrix (AC-7, AC-8, AC-13, AC-14)
- [ ] Verify it: `/check verify people, roles, invites and institutes`
- [x] Test it: `/test people, roles, invites and institutes`
- [x] Review it (fresh model): `/check review people, roles, invites and institutes`
- [x] Document it: `/document people, roles, invites and institutes`
Spec [0002](../../specs/house/0002-people-roles-invites-institutes/index.md) · code in `packages/backend/convex/{members,invites,classes,institutes,bootstrap,demo,houseAuth,houseCore,inviteCore}.ts`, `src/routes/{join,staff,dashboard}.tsx`, `src/components/dhi/{join-page,house-screens,house-session,staff/}`, `src/lib/dhi/{house-words,class-list}.ts`, `scripts/{test-student,enter-check,responsive-sweep}.mjs`. Runs on the development deployment with synthetic people only until row 4. Cannot start until the repo wide rows 16 (the shared backend package) and 6 (the house on the shared sign in) are built, because the house tables land in that package and the join page reads the shared session.

### 3. Room event log and day rules · in-progress
The one contract every room writes through: each finished action becomes an event with who did it, when it happened, which day it counts for and what it says. It fixes the day boundary (04:00 to 04:00 India time), how a day with no log is kept (not logged, never zero), how late entries are marked, and that a rerun never counts twice. Every number the Brain shows is rebuilt from these events. (basis: the Master Spec storage rules; an event log means a changed formula never loses data)
**Done when:** a room can add an event and read it back by student and day, a meal at 01:00 counts for the day before, an unlogged day reads as not logged, and the same event sent twice is stored once.
- [x] Design it (spec): `/architect room event log and day rules`
- [x] Build it: `/develop room event log and day rules`
   - [x] The day rule as one pure shared file (AC-2, AC-3, AC-13)
   - [x] The events table, the static registry, record and read helpers, and the test room (AC-1, AC-3, AC-9, AC-10, AC-16)
   - [x] Retries, the 500 a day cap and the live concurrency check (AC-4, AC-11)
   - [x] Time limits, not logged, corrections and undo (AC-5, AC-6, AC-7)
   - [x] The payload and key rules, the source scans and the proof (AC-8, AC-12, AC-14, AC-15)
- [x] Verify it: `/check verify room event log and day rules`
- [x] Test it: `/test room event log and day rules`
- [x] Review it (fresh model): `/check review room event log and day rules`
- [x] Document it: `/document room event log and day rules`
Spec [0004](../../specs/house/0004-room-event-log-and-day-rules/index.md) · code in `packages/backend/convex/{dayRules,eventShapes,eventRegistry,eventLog,eventProof}.ts`, `packages/backend/convex/eventTypes/test.ts`, tests `dayRules.test.ts` and `eventLog.test.ts`, `src/lib/dhi/day-rules.test.ts`. Built 2026-10-19; the table and its three indexes are live on the development deployment, and the live race check passed there with `eventProof:race` (one stored event for one key at 2 to 14 callers at once; 20 different keys for one student and day at once ran out of Convex retries, as the spec's tradeoff expects). Builds on row 2 (members and `joinedAt`). Runs on the development deployment with synthetic people only until row 4. Every room row after this one calls it.

### 4. Consent, privacy and access record for minors' house data · in-progress
Before any real student logs a mood or a meal: recorded parent consent for students under 18, what each person may see (student, parent, teacher, institute), the parent sharing switch (the Master Spec recommends off until the student turns it on), a record of who looked at a student's personal data, export and erasure of house data, and the privacy notice saying where the data is stored. It reuses the funnel's consent rules rather than inventing new ones.
**Done when:** a student under 18 cannot enter without recorded parent consent, mood notes and meal logs are never shown to staff or parents beyond what the student shares, every staff read of personal data leaves a record with no personal data inside the record itself, and export and erasure work for house data.
- [x] Design it (spec): `/architect consent, privacy and access record for minors' house data`
- [x] Build it: `/develop consent, privacy and access record for minors' house data`
   - [x] The consent gate: notice, the student agrees, the check in the entry function, the consent screen (AC-1, AC-2, AC-18, AC-20)
   - [x] The school records a parent's consent, age rules, withdrawal and the Your data shell (AC-3, AC-4, AC-5, AC-6, AC-17)
   - [x] Who sees what: the access rule, the logged staff read, class totals and the access record (AC-7 to AC-11, AC-16, AC-23, AC-24)
   - [x] Export, erase in pages, the data map and the 30 day block (AC-12, AC-13, AC-14, AC-19)
   - [x] Retention, demo consent, limits and the proof (AC-15, AC-21, AC-22)
- [ ] Verify it: `/check verify consent, privacy and access record for minors' house data`
- [x] Test it: `/test consent, privacy and access record for minors' house data`
- [x] Review it (fresh model): `/check review consent, privacy and access record for minors' house data`
- [x] Document it: `/document consent, privacy and access record for minors' house data`
Spec [0005](../../specs/house/0005-consent-privacy-and-access-record/index.md) · code in `packages/backend/convex/{consent,consentState,consentRules,accessRules,access,sharing,staffRead,dataRights,eraseCore,eventData,roomRegistry,dataMap,retention}.ts` (plus the gate in `houseAuth.ts`, the states in `members.ts`, the notice words in `consentText.ts`), `src/components/dhi/{consent-screen,your-data}.tsx`, `src/components/dhi/staff/parent-consent-section.tsx`, `src/lib/dhi/your-data.ts`, `scripts/consent-check.mjs`. Built 2026-10-19 on the development deployment (tables live, `ERASURE_HASH_SECRET` set there). The notice and the parent wording are drafts (`HOUSE_WORDS_APPROVED` is false). Builds on rows 2 and 3. Two things must happen before any real student enters: the owner approves the exact words, and a legal check on the school recording a parent's consent. Until then only made up people are loaded.
