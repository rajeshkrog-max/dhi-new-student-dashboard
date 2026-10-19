# Review, house/people-roles-invites, 2026-10-19

**Reviewed by**: claude-opus-5-5 (fresh review session, did not write the code; author model not recorded)
**Scope**: 70 files (39 modified, 31 untracked), uncommitted (working tree against HEAD)
**Verdict**: Changes requested

## Summary
The change adds the room event log (house/0004) and consent, privacy and the access record (house/0005): a consent gate in `requireMember`, the school's parent record, `canView`/`staffRead`/`classTotal`, export and a two-step erase with a tombstone and a 30-day email block, a daily retention sweep, and the student and staff screens. Tenancy checks are consistent: no path found that returns another institute's rows, and the gate, the dedupe in the event log and erase-vs-write all serialize correctly under Convex OCC. The main problems are four. The event log accepts staff and system writes about a student who withdrew or never consented. The retention sweep can stall for good. `classTotal` can be subtracted to learn about one student, and it reads too much for a real class. Removed or paused students have no screen that reaches the data rights AC-6 promises them.

## Major

### 🟠 Event log records data about a student who withdrew or never consented, `packages/backend/convex/eventLog.ts:95-103`
**Problem**: `write()` checks the actor's role, the target's `status` and the institute's status, but never the target's consent gate. The actor's own `requireMember` passes for a teacher, a DHI admin or `system`, because staff are never gated. Scenario: a student in Class 10 A withdraws (`consent.withdraw`). A teacher assigned to 10 A runs a room mutation that calls `recordEvent({ by: teacherCtx, memberId: student, room: "exams", ... })`, and the event is stored. The same happens for a student still at `consentNeeded`, and for any `recordSystemEvent` from a nightly job.
**Why it matters**: AC-5 says "from that moment every room refuses with `consent_withdrawn`", and AC-1 says no room acts for a student before consent. Under DPDP, processing must stop on withdrawal, and for a minor it must not start without the parent record. The log comment says "the log owns the ... rules, so no room can get them wrong", but this rule is left to every room. It is latent today (no room writes yet), and it will bite with the first room that lets a teacher or a job write.
**Suggested fix**: In `write()`, after loading `student`, call `gateOf(ctx, student)` and fail with `consent_withdrawn` or `consent_required` unless it is `ok`, for every actor including `system`. Add tests for a teacher writing about a withdrawn student and about a `consentNeeded` student.

### 🟠 Retention sweep can stall for good behind skipped or un-erasable rows, `packages/backend/convex/retention.ts:36-54`
**Problem**: Each run reads the first 50 rows of `by_status_and_removedAt` from the start of the range, with no cursor. Two kinds of row never leave the front of that index. (a) Members of a suspended institute are `skipped`, and the guard at line 54 sets `more = false` when a whole page is skipped. (b) A tombstone that went through `reinstate` and then `remove` has `removedAt` set again, and `beginErase` returns false for it, so it is neither erased nor counted as skipped (see the tombstone finding below). Scenario: a suspended institute has 50 or more students removed more than 12 months ago. Every daily run reads the same 50, erases nothing and stops, so every later leaver in every other institute is never erased.
**Why it matters**: AC-15 (erase after 12 months) quietly stops for the whole platform. Nothing in the logs signals it beyond "0 erased, 50 skipped".
**Suggested fix**: Page with a cursor (`paginate` and pass `continueCursor` to the next scheduled run, as `purge.ts` does) instead of re-reading the head. Also refuse `reinstate`/`remove` on tombstones so (b) cannot enter the index. Add a test with 51 or more suspended-institute leavers ahead of one erasable leaver.

### 🟠 `classTotal` can be subtracted to learn about one named student, `packages/backend/convex/staffRead.ts:97-122`
**Problem**: The fixed calendar-month period stops overlapping time cuts, but the population is whatever the class roster is at the moment of the call, and the same institute admin controls that roster. Scenario: the admin calls `classTotal({classId, kind: "mood", month: "2026-09"})` and gets `{count: 14}`. They `members.remove` student X (`members.ts:232`) or `setClass` X to another class (`members.ts:260`), and call again: `{count: 13}` means X logged mood in September, `{count: 14}` means X did not. Then they `reinstate` or move X back. With the count at exactly 10, the second answer is `null`, which gives the same signal.
**Why it matters**: AC-23 promises that "two answers cannot be subtracted to find one student", and AC-7/AC-8 say wellbeing data is never seen by name. The access log does record remove, reinstate and totals.read, but that only detects the leak, it does not prevent it. It is latent until a public function wraps `classTotal`, so fix it before that.
**Suggested fix**: Make a total for a (class, kind, month) stable once it is computed. For example, snapshot it the first time it is asked for after the month closes and serve the snapshot from then on, or count the class membership as of the month (from `events.classId`) rather than the live roster. At the least, add noise or coarse rounding and refuse a recompute within N days of a roster change in that class.

### 🟠 `classTotal` reads more than one transaction allows for a real class, `packages/backend/convex/staffRead.ts:115-120` with `eventLog.ts:211-226`
**Problem**: For each student (up to 1000), `standingOf` makes about 5 reads, and `hasEventInRange` loads up to 2000 full event documents (payloads up to 2 KB) for the month. It does not stop at the first match, and it reads every room's events, not only those of the asked kind. A class of 40 students who log about 15 events a day comes to 40 × 450 = 18,000 documents, about 10 to 36 MB. That is beyond Convex's per-transaction read limits, so the mutation fails for exactly the classes where a total is meaningful.
**Why it matters**: The feature fails in production at ordinary scale, and the 10-student minimum makes small classes useless anyway.
**Suggested fix**: Add an index such as `by_memberId_and_room_and_loggedFor` and probe each room with `.first()` per day, or keep a per-(member, room, day) "has data" marker or an aggregate. Stop at the first current, non-voided hit. Consider spreading the work over scheduled pages.

### 🟠 Removed or paused students cannot reach their data rights, `src/routes/dashboard.tsx:48-49`, `src/components/dhi/your-data.tsx:20-21`
**Problem**: AC-6 says a removed student, or one in a suspended institute, "can still reach Your data for their consent state, export and erase". The backend supports this (`exportMine`/`eraseMine`/`consent.state` use `{ inactive: true }`), but `/dashboard` renders `AccessPaused` for `removed` and `suspended`, and `AccessPaused` (`house-screens.tsx:40`) has no link to Your data. Even if one were added, `YourData` also subscribes to `sharing.get` and `access.mine`, which call `requireMemberAllowLocked(ctx)` without `inactive`. For a removed student those throw `removed`, and the component errors.
**Why it matters**: A removed student can never export or erase their own data. That is a DPDP right and a spec AC, and the 12-month retention is the only way their data ever goes. The backend test at `houseConsent.test.ts:405` passes, but no screen uses it.
**Suggested fix**: Give `AccessPaused` (student role) an entry to a reduced Your data with consent state, download and erase. Either skip the `sharing`/`access` queries there, or make those two queries tolerate `inactive` as well, which would mean updating the AC-6 list and the scan. Extend `scripts/consent-check.mjs` to cover a removed student.

## Minor

### 🟡 Staff can reinstate, move or re-flag an erased tombstone, `packages/backend/convex/members.ts:246-290`
**Problem**: `reinstate`, `setClass` and `setUnder18` (and `targetFor`) never check `erasedAt`. An institute admin can reinstate a tombstone, which then shows in `members.list` as an "active" student with an empty name and email. A DHI admin can change the tombstone's `under18`, which AC-13 says is kept as the proof of what consent applied. Reinstating and then removing it also puts a tombstone into the retention index, where it stays (see the retention finding above).
**Suggested fix**: Have `targetFor` fail `not_found` for `erasedAt !== undefined`, and filter tombstones out of `members.list`.

### 🟡 The 5-an-hour export limit is bypassed by starting at the events page, `packages/backend/convex/dataRights.ts:55-57`
**Problem**: The limit is taken only when `cur.s === -1`. A client can send `cursor: '{"s":0,"c":null}'` and page through every event with no limit, as often as it likes. That breaks AC-12/AC-17 ("at most 5 exports an hour").
**Suggested fix**: Charge the limit on the first page of any section when `c === null` and `s` is the first section, or issue a signed or server-stored export session id with the header page and require it on later pages.

### 🟡 A student with no `under18` flag is locked with no way out for the school, `packages/backend/convex/consent.ts:188,217`
**Problem**: The gate treats a missing flag as under 18 and asks for a parent record (`consentRules.ts:19`). But `parentStudent` skips anyone whose `under18 !== true` as `adult` / `not_under18`, and `parentList` hides them, so the school cannot see or record them. Only a DHI admin's `setUnder18` can unlock the student. New invites always set the flag, but seeded or legacy rows (for example `eventProof.seed` style inserts, or rows from before 0002) may not.
**Suggested fix**: Treat `under18 !== false` the same way in `parentStudent` and `parentList` (using `isMinor`), or reject members without a flag at join time. Add a test.

### 🟡 No rate limit on the school's withdraw/restore or on the sharing toggle, `packages/backend/convex/consent.ts:314-324`, `packages/backend/convex/sharing.ts:23-38`
**Problem**: Each call appends a `consentRecords` row and an `accessLog` row with no limit. A script can flip them in a loop and fill the append-only tables, which are never deleted.
**Suggested fix**: Charge `parentRecord` for `recordParentWithdrawn/Restored`, and add a small per-member bucket for `sharing.set`.

### 🟡 `adminExport` can exceed the read limit, `packages/backend/convex/dataRights.ts:169`
**Problem**: `countEvents(ctx, id, 10_000)` loads up to 10,000 full event documents (each up to 2 KB) only to count them. That can reach 20 MB in one mutation.
**Suggested fix**: Count in pages through a scheduled or looping internal query, or keep a counter.

### 🟡 Missing tests for the risky branches above
**Problem**: The suite is broad, but it has no test for: a staff or system `recordEvent` about a withdrawn or `consentNeeded` student, a retention page that is all skipped with an erasable leaver behind it, reinstating a tombstone, the export limit bypass, or `classTotal` stability across a roster change.
**Suggested fix**: Add these as each fix lands.

## Nits
- ⚪ `packages/backend/convex/houseAuth.ts:61-62`, the comment lists `members.me` as a user of the lock-tolerant check, but `me` does not call it.
- ⚪ `packages/backend/convex/consentState.ts:28`, `.filter()` after the index goes against `_generated/ai/guidelines.md` (line 89). It is bounded in practice. An index on `["memberId","by","kind"]` would make the scan exact.
- ⚪ `packages/backend/convex/eraseCore.ts:106-108`, `memberById` is never used.
- ⚪ `packages/backend/convex/staffRead.ts:53-56`, `not_found` (no such id) and `forbidden` (exists, not yours) tell a staff member whether an id exists in another institute. Ids are hard to guess, so this is low risk.
- ⚪ `packages/backend/convex/eraseCore.ts:24-31`, rotating `ERASURE_HASH_SECRET` silently lifts every active 30-day block. Note it in AGENTS.md.
- ⚪ `src/components/dhi/your-data.tsx:135-143`, "Withdraw my consent" appears before the student has agreed. Pressing it records a withdrawal, so the student must then restore and agree.

## Strengths
- One entry check (`loadMember`) with an explicit lock-tolerant twin, and a source scan that pins exactly which files may use it.
- The event log's retry and dedupe rule leans on Convex serializability correctly. The registry has no free-text field kind, so the "no student words in events" rule is structural rather than a convention.
- The erase makes the person invisible in one atomic step (tombstone, sessions, invites, block hash) and finishes in self-scheduled pages with a counts-only receipt. The funnel account is kept when a profile exists, and the team command answers a uniform `no_match`.
- `parentStudent` answers another institute's student and a non-existent id the same way, and every school action is scoped to `mc.member.instituteId`.
- Refusals that count against a limit return `{ ok: false }` instead of throwing, so the count stays.

## Test coverage
Coverage is strong for the stated ACs. `houseConsent.test.ts` has about 50 cases, covering the gate matrix, the school record, withdrawal order, the AC-6 scan, `canView`, staffRead and view rows, totals, export paging, a multi-page erase, the block, a funnel-profile account surviving, retention, and the source scans. `eventLog.test.ts` covers the shapes, keys, day rules, corrections and cap. The 812 backend tests pass per the author. The gaps are the scenarios in the findings: staff or system writes for a locked student, retention head-of-line blocking, operations on tombstones, the export limit bypass, `classTotal` under roster changes and at realistic volume, and any UI path for a removed student. Races cannot be shown under convex-test. `eventProof:race` covers the dedupe live, but no live check covers erase racing a write.

## Resolution (same day, by the author)
All five majors and the six minors were fixed, each with a test in `packages/backend/convex/houseReviewFixes.test.ts` (and the browser proof `pnpm consent:check` for the paused student):
- The event log now refuses a student who is not through consent, for every actor including `system` (`eventLog.ts`).
- The retention sweep pages with a cursor, ten members at a time, so skipped rows cannot hold up the rest (`retention.ts`).
- A class total is worked out once for a class, a kind and a month and then served as it was (new `classTotals` table), so two answers cannot be subtracted. This is a design addition to spec 0005 AC-23; `/architect` should record it.
- The class total probe uses a new index and stops at the first hit (`events.by_memberId_and_room_and_loggedFor`).
- A removed student or one of a paused institute reaches a reduced Your data (consent state, download, erase) from the pause page.
- Minors: tombstones cannot be reinstated, moved or re flagged and are not listed; every export page after the start is limited to 300 an hour; a missing under 18 flag is listed for the school and can be recorded; the school's withdraw and restore and the sharing switch have limits; the team's export counts stop at 1000.
- Nits: the `houseAuth` comment, the unused `memberById`, and the withdraw button that showed before a student had agreed.
Not changed: `consentState.ts` still uses `.filter` after an index (bounded), and `not_found` against `forbidden` in `staffRead` (ids are hard to guess).
