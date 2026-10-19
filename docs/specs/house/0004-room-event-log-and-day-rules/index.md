# 0004. Room event log and day rules

**Date**: 2026-10-19
**Status**: In Progress

## Summary

Every finished action in a room (a mood logged, a plate saved, a habit ticked) becomes one event in a single log, saved in the same step as the room's own row, so the two can never disagree. The log works out which day each event counts for (a day runs 04:00 to 04:00 India time), says whether a day was logged, was missed, or came before the person joined, and never stores the same event twice. It is built as a small set of server helpers that each room calls, with no way for the browser to add or read events, and it holds only ids, counts and codes, never a student's own words. The numbers (daily values, the Brain) come later and are rebuilt from this log.

## Requirements

**User stories**:
- As a room builder, I want to save my room's row and its event in one step so that the log can never hold something that did not happen, or miss something that did.
- As the Brain (later rows), I want every event tied to a student, a day and a class so that every number can be rebuilt from the log when a formula changes.
- As a student, I want a day I did not log to count as "not logged", never as a zero, and a meal at 1 am to count for the day I am still living so that nothing I do reads as failing.
- As the owner, I want a retry to never count twice, and no private writing to leak into the log, so that the numbers stay honest and safe for students under 18.

**Acceptance criteria** (the contract, each one checkable on its own):
- **AC-1**: A room function records an event about a student with `recordEvent` in the same transaction as its own write, and reads it back by student and day with `eventsForDay`. If the event is refused, the room's own write is rolled back too.
- **AC-2**: A day runs from 04:00 to 04:00 India time. An event at 01:00 counts for the day before. 03:59:59.999 belongs to the earlier day and 04:00:00.000 to the next. Month ends, year ends and 29 February give the right day.
- **AC-3**: The day an event counts for (`loggedFor`) is worked out by the server from `occurredAt`. No caller can set it, and a caller cannot make an event count for a different day than its time says.
- **AC-4**: The same student and `eventKey` with the same content is stored once, and the second call returns the first event with its stored `loggedFor` and `late`, marked `duplicate`. "Same content" means the same room, type, version, payload, `occurredAt`, `about`, `replaces` and `void`; the actor is left out. The same key with different content is refused with `key_conflict` and changes nothing. Two calls at once store one event (this holds because Convex retries the loser, and is proven by a live check on the development deployment, since the in memory test tool runs one call at a time).
- **AC-5**: `dayStatus` answers `future` for a day after today, `beforeJoined` for a day before the day the person joined, and otherwise `logged` or `notLogged`, optionally narrowed to one room or some types. Only current events that are not voided count, so a day whose events were all replaced by voids reads `notLogged`. A missed day writes no row and is never a zero. A malformed day fails with `bad_day`, and an empty `types` list is refused.
- **AC-6**: The server clock is `Date.now()` inside the mutation. An event is refused with `in_future` if its time is more than 5 minutes ahead (exactly 5 minutes is allowed) or its day is later than today. It is refused with `too_old` if its `loggedFor` is older than 7 days before today (today is day 0, so 7 days back is still allowed). It is refused with `before_joined` if its `loggedFor` is before the day the person joined. An event written on a later day than its `loggedFor` is marked `late`.
- **AC-7**: The current event for a thing is the latest stored event for the same student, `about` and `loggedFor`. A correction is a new event that may name the earlier event it replaces (`replaces`, kept as an audit link) and must be the same student, `about`, day, room and type (a newer version is allowed), or it is refused with `replaces_mismatch`. Old events are kept and readers see only the current one. A correction never moves an event to another day. `late` on a correction is inherited from the first event of that thing, so a late fix never turns an on time day late.
- **AC-8**: Every event type is registered, in one static file that imports every room's types, with its room, version and exact payload shape. An unknown type is refused with `unknown_type`, a payload that does not match with `bad_payload`, and one over 2 KB (the UTF-8 size of its JSON, at most one level of nesting, no `NaN`) with `payload_too_big`. A payload string must be a fixed code or an id, and the registry cannot hold a free text field. `about` and `eventKey` must match `table:id` (a lowercase word, a colon, then letters, digits, `_` or `-`, at most 100 characters in all), or the call is refused with `bad_key`.
- **AC-9**: Each event records the student it is about, who caused it (a member, or `system`), and the institute and class at that moment. A later class change never rewrites an old event. The event must be about a member whose role is student (`not_a_student`). A student may record only about themselves, a teacher only about a student of a class assigned to them, a DHI admin about any student, and a counselor never (all others `forbidden`). `system` is available only through an internal wrapper. A removed member, or a member of a suspended institute, receives no new events (`member_inactive`). A member who was removed and then reinstated may fill in the last 7 days again, and the days they were removed read `notLogged`.
- **AC-10**: No app code updates or deletes an event. Every write to the `events` table names the table, so a source scan can prove it. The only removal is the erase path decided in house row 4.
- **AC-11**: One student has at most 500 stored events for one day (every stored row counts, replaced and voided ones too, and a duplicate adds none). The 501st is refused with `day_full`, and the room's own write rolls back with it.
- **AC-12**: No public function reads or writes events. The log is reachable only by server helpers called from other server functions, the read helpers may only be imported by files on an allowlist, and no public function may return an event document (proven from the return shapes of every public function).
- **AC-13**: The day rule is one small pure file, exported from the backend package as `@dhi/backend/dayRules`, that reads no database and no clock (the caller passes the time). The house screens and the server use the same file.
- **AC-14**: No personal data is logged: a source scan of the log's own files finds no log line and no refusal message that carries anything but counts, codes and ids.
- **AC-15**: The funnel is untouched: no funnel table changes, no funnel file changes, and the whole funnel suite passes unchanged.
- **AC-16**: `eventsForDay` returns the current events of one student and one day (not voided ones unless asked), at most 500, sorted by `occurredAt`, then creation time, then id, and never another student's.

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): one append only `events` table, written by server helpers inside each room's own function.

A room calls `recordEvent` beside its own write. The log owns the day rule, the retry rule, the late rule and the correction rule, so no room can get them wrong, and the browser never touches it.

**Implementation skills**: `convex` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex/`) · `convex-authz` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-authz/`) · `convex-test` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-test/`) · `convex-reviewer` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-reviewer/`)

**What is decided**:
- **Scope.** The log and the day rules only. Daily values, the nightly check and the Brain are rows 17 to 22. A changed formula therefore never touches this table.
- **Who writes.** Only a server helper called from a room's mutation, in the same transaction as the room's own row. There is no public "add event" function.
- **Append only.** Events are never changed or deleted by app code. A correction is a new event; readers take the latest event for the same student, thing and day.
- **Undo.** A correction may be a void (no payload, `void` true), so un ticking a habit or removing a meal makes the day read not logged again.
- **Retries.** A stable `eventKey` per student. Same key and same content is a retry (stored once). Same key with different content is a bug in a room and is refused loudly.
- **Day rule.** Fixed India time for everyone (all institutes are in India, and India has no daylight saving). The server works out `loggedFor` from `occurredAt` with the shared pure file.
- **Time.** The room gives the time the thing happened (a meal eaten earlier) and the server checks it against its own clock. A room that has no real time of its own uses the server time. The 7 days is the log's ceiling; a room may allow fewer, and should check it before it writes its own row.
- **Late entries** are marked `late` and never counted as on time. A correction keeps the lateness of the first event.
- **Not logged.** No current event means not logged. One read, `dayStatus`, says logged, not logged, before they joined, or future. Nothing is written for a missed day.
- **Payload.** Ids, numbers, booleans and fixed codes only, up to 2 KB, checked against the registered shape for the type. A student's own words stay in the room's own table and never enter the log. The same goes for `about` and `eventKey`, which are fixed in form.
- **Event types.** This row ships the registry and its rules, and tests use a test type. Each room row adds its own types and payload shapes to the one static registry file when that room is built.
- **Who may record.** About a student only. A student about themselves, a teacher about a student of an assigned class, a DHI admin about any student, a counselor never, and `system` only through an internal wrapper.
- **Who and what.** Each event names the student it is about, who caused it, and the institute and class at that moment.
- **Corrections stay on their day.** A wrong day is a new entry for the right day. A day older than 7 days can therefore never be changed.
- **Cap.** 500 stored events a student a day.
- **Reads.** None from the browser. Row 4 decides who may ever see events, and the Brain reads daily values, not events.
- **Subject and topic** are not columns yet (no subject list exists). A room puts them in its payload until the exam and desk rows define them, and a column can be added then.

## Feature design

**Data model sketch** (one new table, additive; funnel tables untouched):

| Table | Key fields | Notes |
|---|---|---|
| `events` | `memberId` (id of `members`, required, the student it is about) · `actorId` (id of `members` or `"system"`) · `instituteId` (id, required) · `classId` (id, optional, the class at that moment) · `room` (code) · `type` (code from the registry) · `schemaVer` (number) · `payload` (object, at most 2 KB) · `occurredAt` (number) · `loggedFor` (`YYYY-MM-DD`) · `late` (boolean) · `voided` (boolean, optional) · `eventKey` (text, `table:id`, at most 100) · `about` (text, optional, `table:id`) · `replaces` (id of `events`, optional) | Append only. One row per student and `eventKey`. |

Rooms (`room` codes): `mood`, `meals`, `habits`, `sleep`, `exams`, `modules`, `blog`, `desk`, `hour`. Counseling is deferred and has no code.

Indexes: `events` by `memberId` and `loggedFor`; by `memberId` and `eventKey` (the retry check); by `memberId`, `about` and `loggedFor` (the current event for a thing on a day). Uniqueness holds only because `recordEvent` looks up by `memberId` and `eventKey` first, as in the rest of the backend. Later rows may add an index by institute and day for class totals, which is additive.

Relationships: a member has many events, an institute has many events, and an event may point at one earlier event of the same member, thing and day it corrects. Erase class (platform spec 0001 child 0002): `erased`, keyed by `memberId`, decided in row 4.

**State transitions**: an event is stored, and a later event for the same thing and day may make it no longer current (a correction, or a void). It is never changed or removed. The current event for a thing is the latest one, and Convex runs conflicting writes one after another, so there is one line of events per thing and day.

**API surface** (server helpers, not Convex functions a browser can call; each room calls them inside its own mutation or query; they live in files on an allowlist):

| Helper | Kind | Key inputs | Key outputs | Who calls | Key errors |
|---|---|---|---|---|---|
| `recordEvent` | mutation helper | `by` (the caller's member context), `memberId` (the student), `room`, `type`, `payload`, `occurredAt`, `eventKey`, `about` (opt), `replaces` (opt), `void` (opt) | `eventId`, `loggedFor`, `late`, `duplicate` | a room's mutation | `unknown_type`, `bad_payload`, `payload_too_big`, `bad_key`, `in_future`, `too_old`, `before_joined`, `member_inactive`, `not_a_student`, `forbidden`, `key_conflict`, `replaces_mismatch`, `day_full` |
| `recordSystemEvent` | internal wrapper | the same, with `system` as the actor | the same | internal jobs only | the same |
| `eventsForDay` | read helper | `memberId`, `day`, `includeVoided` (opt, default false) | up to 500 current events of that day, sorted by time, creation, id | server code | `bad_day` |
| `currentFor` | read helper | `memberId`, `about`, `day` | the current event for that thing on that day, or null | server code | `bad_day`, `bad_key` |
| `dayStatus` | read helper | `memberId`, `day`, `room` (opt), `types` (opt, not empty), `today` (queries pass it in; mutations use their own clock) | `logged`, `notLogged`, `beforeJoined` or `future` | server code | `bad_day` |
| `defineEvent` | registry | `room`, `type`, `version`, `payload` shape | a registered type in the one static registry file | each room's row, when built | refuses a free text field at build time |
| `dayRules` (pure) | functions | a time or a day | `dayOf(ms)`, `todayOf(now)`, `dayBounds(day)`, `shiftDay(day, n)`, `isDayKey(text)`, `isLate(loggedFor, nowMs)`, `MAX_AGE_DAYS = 7`, `BOUNDARY_HOUR = 4` | server and screens | none |

Errors use the existing `fail(code)` helper. A refusal inside a room's mutation rolls the room's own write back too, on purpose.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Record | The student it is about | The room's own `memberId`, found by that room from the verified session or from its own scoped lookup (never from the browser), and checked to be a student |
| Record | `actorId` | The caller's member context from `requireMember` (house spec 0002), or `"system"` from the internal wrapper only |
| Record | `instituteId`, `classId` | The student's `members` row at the moment of writing |
| Record | `occurredAt` | The room (the time the thing happened), or the server time when the room has none, checked against the server clock |
| Record | The server clock | `Date.now()` inside the mutation |
| Record | `loggedFor` | Derived on the server from `occurredAt` with `dayRules.dayOf` |
| Record | `late` | Derived: `dayOf(now)` is later than `loggedFor`; a correction takes the `late` of the first event of that thing and day |
| Record | `schemaVer` and the payload shape | The registry entry for `room` and `type` |
| Record | `eventKey`, `about`, `replaces`, `void` | The room: a stable key from its own row and action, the thing the event is about, the id from `currentFor`, and whether this undoes the thing |
| Record | Limits (7 days, 5 minutes, 2 KB, 500) | Constants in the log's module |
| Record | The earliest allowed day | The day of the student's `members.joinedAt` (house spec 0002) |
| Day status | `beforeJoined` | `day` earlier than the day of `members.joinedAt` |
| Day status | `future` | `day` later than `todayOf(now)`, where `now` is the caller's own clock in a mutation and the passed in time in a query |
| Day status | `logged` | At least one current, not voided event for that student and `loggedFor`, narrowed by the optional `room` and `types` |
| Any read | The student | The `memberId` the caller passes, scoped by that caller's own authorization before it gets here |

**Key invariants**:
- One stored event per student and `eventKey`.
- `loggedFor` always equals `dayOf(occurredAt)`. It is never an input.
- An event is never updated or deleted by app code, and an event that is no longer current stays.
- An event is about a student, and its actor is that student, a teacher of an assigned class, a DHI admin, or `system`.
- A payload never holds free text: the registry allows only ids, numbers, booleans and fixed codes, and `about` and `eventKey` are fixed in form.
- A day with no current event is "not logged", never zero, and no row is written for it.
- No function a browser can call reads or writes `events`, or returns an event document.
- The room's own row and its event are saved together or not at all.
- No personal data in any log line.

**Security model**: the browser is untrusted and has no access to the log at all. Only server helpers, called from functions that have already run `requireMember` or are internal jobs, can write or read, and the read helpers are importable only from files on an allowlist. `recordEvent` re checks the student is active and in an active institute, and applies the actor rules above (a student only about themselves, a teacher only about an assigned class, a DHI admin about any student, a counselor never). Events about students under 18 are personal data: the payload rule keeps private writing out, and who may ever see events, how long they live, and how they are erased belong to house row 4, which must be built before any real student's events exist. Until then only synthetic people are loaded (house spec 0002). Compliance scope: personal data of students under 18 in India. Counts and ids only in logs.

**Configuration required**: none. No new environment variable, secret or third party service.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: a test room saves its own row and an event, reads it back by student and day, and a refused event rolls the room's row back, verifies **AC-1**, **AC-16**.
- Day edges: events at 03:59:59.999 and 04:00:00.000 India time, at 01:00, on 31 December, on 29 February and across a month end land on the right day, verifies **AC-2**, **AC-3**.
- Retry: the same key and content stored once with its stored day and `late`, different content refused, verifies **AC-4**. Two calls at once store one, checked live on the development deployment.
- Not logged: a missed day, a day before joining, a future day, an all voided day and a bad day answer correctly and write nothing, verifies **AC-5**.
- Time limits: a late event is marked, exactly 5 minutes ahead is allowed and 5 minutes and 1 ms refused, 03:57 with a time of 04:01 is refused, 7 days back is allowed and 8 refused, and a day before the join day is refused, verifies **AC-6**.
- Corrections: a correction keeps the old event and shows only the new one, a void makes the day not logged again, a late fix keeps the first event's `late`, and a correction across students, things, days, rooms or types is refused, verifies **AC-7**.
- Registry and keys: unknown type, wrong payload, oversize payload, a free text field, a bad key and a type missing from the static registry are refused, verifies **AC-8**.
- Who and tenancy: class at the moment is kept after a class move, a removed member and a suspended institute receive nothing, a reinstated member can backfill 7 days, a student recording about another student, a teacher of an unassigned class, a counselor and a staff actor of another institute are refused, an event about a teacher is refused, verifies **AC-9**.
- Append only and no browser access: a scan of the backend sources finds no write to `events` outside the log and its erase path, no public function that reads or writes it, and no public function returning an event document, verifies **AC-10**, **AC-12**.
- Cap: the 501st stored event of a day is refused and the room's row rolls back, verifies **AC-11**.
- Shared rule: the screens import `@dhi/backend/dayRules` and it reads no clock, verifies **AC-13**.
- Logs: a scan of the log's files finds no personal data in log lines or messages, verifies **AC-14**.
- Funnel: the funnel suite passes unchanged and no funnel table or file changes, verifies **AC-15**.
- Ordering and scope: `eventsForDay` sorts ties by time, creation and id, returns at most 500 and never another student's, verifies **AC-16**.

## Build plan

Build approach: Tracer Bullet (from the house scope). The thin thread first: the pure day rule, then one table and the record and read helpers end to end with a test room, then thicken one rule at a time. Everything runs on the development deployment, and nothing real is stored before row 4.

1. [x] **The day rule.** `dayRules.ts` (pure) with its edge tests, and the named package export. Satisfies **AC-2**, **AC-3**, **AC-13**.
2. [x] **The thread.** The `events` table and indexes, the one static event registry with a test type, `recordEvent` for the happy path with the actor rules, `eventsForDay`, a test room that writes its own row and an event together, and the schema pushed to the development deployment and confirmed live. Satisfies **AC-1**, **AC-3**, **AC-9**, **AC-10**, **AC-16**.
3. [x] **Retries and the cap.** The key lookup, same content and different content, the 500 a day cap, and a live check on the development deployment that two calls at once store one. Satisfies **AC-4**, **AC-11**.
4. [x] **Time and not logged.** `late`, the future, 7 day and before joined limits, the removed and reinstated rule, and `dayStatus`. Satisfies **AC-5**, **AC-6**, **AC-9**.
5. [x] **Corrections.** `about`, `replaces`, `void`, `currentFor`, the inherited `late` and the current only reading. Satisfies **AC-7**, **AC-16**.
6. [x] **The payload and key rules.** The registry's refusal of free text, the size, shape and key pattern checks, and the source scans (table named writes, no public function, no public function returning an event, no personal data in log lines, an allowlist for the read helpers). Satisfies **AC-8**, **AC-10**, **AC-12**, **AC-14**.
7. [x] **Proof.** Fixture days for every edge, the access and tenancy cases, the funnel suite run unchanged, and a check that the table and indexes are live on the development deployment. Satisfies **AC-9**, **AC-15**.

## Consequences

**Positive**:
- Every later number can be rebuilt from one log, so a changed formula never loses data.
- The day rule, the retry rule and the "not logged" rule exist once, so no room can drift.
- A room's row and its event are saved together, so the log never disagrees with the room.
- No private writing and no browser access, so the log is safe to keep before the consent rules exist.

**Negative / tradeoffs**:
- Every room row must call the helper and add its types to the static registry, which is a small cost in each.
- Append only with corrections means readers must take the latest event per thing and day, so a read is slightly more work than a plain table, and each write reads that student's day (at most 500 rows), so two writes for the same student and day conflict and one is retried. That is acceptable at this scale.
- A refusal in the log rolls back the room's own write. That is the point, but a bug in a registry entry would show as a room that cannot save, and a room that takes its time from a device clock a few minutes fast would fail every save, so rooms should use server time unless the time is really theirs.
- Convex has no database constraints, so one event per key holds only because `recordEvent` does its lookup, and the in memory test tool cannot show a write race, so that is checked live. A room that wrote events by another route would break it, which is why no public write exists and a test scans for it.
- The 7 day ceiling means a student who was away longer cannot fill in old days. That is intended, and a room may allow fewer.
- Subject and topic are not columns yet, so breakdowns by subject read the payload until the exam and desk rows add them.
- Compliance scope: personal data of students under 18 in India. Row 4 must decide access, retention and erasure before any real student's events exist.

**Neutral**:
- Daily values (row 17) will read `events` by member and day, may add an index by institute and day, and are told that days a member was removed read not logged.
- House spec 0002's `memberId` is the house's `student_id`, so events point at members, not at the funnel's `students`.
- `BACKEND.md`'s events description should read as this table once it is built (done by `/sync`).

## Follow-up

- [ ] House row 4 (consent and privacy) decides who may ever read events, how long they are kept, and how they are erased for `memberId`. It must land before any real student's events exist.
- [ ] Each room row (5, 6, 9, 11, 12, 13, 14, 15, 16) adds its event types and payload shapes to the static registry, names its own `eventKey` and `about` rules, and checks the 7 day limit before it writes its own row.
- [ ] Row 17 may add an index by institute and day, and the Master Spec's `subject_id` and `topic_id` columns once the exam and desk rows define subjects and topics.
- [ ] `BACKEND.md` should describe `events` as this table (`/sync`).
- [ ] Row 7 (sleep) adds the `sleep` room code's first types when it is designed.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
