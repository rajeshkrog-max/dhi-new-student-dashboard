# 0002. People, roles, invites and institutes for the house

**Date**: 2026-10-18
**Status**: In Progress

## Summary

The house gets real accounts. DHI staff create an institute, the institute's admin invites teachers and students, and each person signs in with Google and presses "Join" to enter, but only if their Google email was invited. We build this as our own tables in the shared backend (institutes, classes, members, invites and an access log), and Better Auth stays a plain sign in. Every house function finds the person from the verified session and checks their role, institute and class before it touches any row. A house member is a record of its own and does not create or change anything in the funnel's `students` table. The demo seat leaves the running app.

## Requirements

**User stories**:
- As a DHI admin, I want to create an institute and invite its first admin so that a school can start without me touching its data.
- As an institute admin, I want to upload a class list and invite teachers so that a whole class can join in one go.
- As a teacher, I want to add students to my own classes so that I can run my papers without asking an admin.
- As a student, I want to sign in with my Google account, see which school is inviting me and join it, so that I never see another school's data and nobody moves me into a school without my say.
- As the owner, I want a removed student locked out at once, with their data left alone, so that nothing is lost before the erasure rules are decided.

**Acceptance criteria** (the contract, each one checkable on its own):
- **AC-1**: The owner runs one internal function with a Google email. That person signs in on the development deployment, sees the "Join as DHI admin" step, presses it, and is recognised as a DHI admin with no institute, seeing the staff area.
- **AC-2**: A DHI admin creates an institute and an invite for its first institute admin. When that person signs in with the invited Google email and presses Join, they become that institute's admin and see only that institute.
- **AC-3**: A person who signs in without a pending invite and without a membership sees a "you are not in a house yet, ask your institute" page. No `members` row is made. A funnel student keeps full funnel access. A person with a pending invite sees the institute name and role and a Join button, and nothing is created until they press it.
- **AC-4**: A class list upload (name, Google email, class, under 18 yes or no per row) is checked as a whole. If every row is valid, all invites are created. If any row is bad, none are created and the result lists each bad row with one of the fixed reasons.
- **AC-5**: An invited student who presses Join gets a `members` row and nothing else. No `students`, `checks` or `consents` row is created or changed, and the funnel behaves for that account exactly as for any new signed in person.
- **AC-6**: An invite can be claimed only by a session whose Google email is verified and equals the invited email, and only after the person presses Join. On a test sign in (`TEST_SIGNIN_ENABLED` true) the verified check is waived only for emails ending `@example.test`, and never for a DHI admin or counselor invite. An expired, revoked or already claimed invite is refused. Claiming twice, or from two tabs at once, makes one membership.
- **AC-7**: No function returns or changes a row from another institute. A teacher sees only students of classes currently assigned to them, re-read on every call. A student sees only their own record. An automated matrix of every role against every function proves the allowed and the refused cases, including a teacher who has just been unassigned and a DHI admin acting on a suspended institute.
- **AC-8**: An institute admin cannot create, change or remove a DHI admin or a counselor, and cannot act on another institute. A teacher cannot invite a teacher or an admin. A DHI admin can revoke any invite, including one made by an institute admin.
- **AC-9**: Removing a member locks them out on their next call, leaves every row they own untouched, and reinstating them restores entry. Both are written to the access log.
- **AC-10**: The last active DHI admin and the last active admin of an active institute cannot be removed. Roles never change after an account is created.
- **AC-11**: A student's under 18 flag comes from the class list only and cannot be changed by the student. Only a DHI admin can correct it afterwards, and the correction is logged. The funnel's age is never consulted.
- **AC-12**: Every change to access writes one access log row holding ids and a code from the fixed list in the design, never a name, email or note.
- **AC-13**: The demo gate is gone: `src/lib/dhi/gate.tsx`, `src/lib/session.ts`, the key `dhi-session-v1` and the fixed demo seat no longer exist in the running app, and every house route needs a real member. A seeded demo institute (invites for fixed `@example.test` emails) exists only where `TEST_SIGNIN_ENABLED` is `true`, and the seed refuses to run anywhere else.
- **AC-14**: The funnel is untouched: no funnel function reads or writes a house table, no funnel file changes except the clean up named in AC-15, and the whole funnel suite passes unchanged.
- **AC-15**: The funnel's daily clean up never deletes the sign in account of anyone who has a `members` row.
- **AC-16**: A suspended institute locks out all its members at once, a DHI admin can still see and reinstate it, and invites for it cannot be claimed (`institute_suspended`). An invite to an archived class cannot be claimed (`class_archived`).
- **AC-17**: Claiming an invite is limited to 10 an hour and creating a batch to 10 an hour, each per signed in person, and a refused call returns `rate_limited`.
- **AC-18**: The staff screens reuse the existing house components, work at phone, tablet and desktop widths with no sideways scroll, and every list is paginated at 25 a page.
- **AC-19**: `email_in_use` refusals are capped at 50 a day per institute, after which further invite calls from that institute return `rate_limited` until the next day. The refusal text never says where the email is a member or invited.

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): our own tables in the shared backend, with Better Auth used only to sign in.

Institutes, classes, members, invites and an access log are ordinary tables checked by one entry function. Better Auth's organization plugin is not used.

**Implementation skills**: `convex` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex/`) · `convex-authz` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-authz/`) · `convex-test` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-test/`) · `convex-reviewer` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-reviewer/`) · `better-auth-best-practices` (`better-auth/skills`, `apps/joining/.claude/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `apps/joining/.claude/skills/better-auth-security-best-practices/`)

**What is decided**:
- **Who sets up whom.** A DHI admin creates an institute and the invite for its first admin. An institute admin invites teachers and students of their own institute. A teacher invites students into the classes assigned to them. A DHI admin also invites counselors (no institute) and other DHI admins. Institutes cannot create themselves.
- **One role, one institute, roles never change.** A person has one role and at most one institute. DHI admins and counselors belong to no institute. A second school means a second Google account. Moving a person between institutes is not built here; it is a later DHI admin only function.
- **The invite is the email, and joining is a tap.** An invite records a Google email, a role and where the person goes. There is no secret code. The "join link" is one plain address (`/join` on the house), the same for everyone. The person signs in with Google, the server finds a pending invite for their verified email, and the page shows the institute name and role with a Join button. Only pressing Join creates the membership. Staff share the link by WhatsApp or in class. No email service is added now.
- **Pending means not claimed and not revoked, expired or not.** An expired invite still blocks a new invite for that email until it is revoked or extended, and claiming it returns `invite_expired`. A DHI admin can revoke any invite, so a squatted invite can be cleared.
- **Class lists.** One upload is checked as a whole and either all rows become invites or none do (cap of 300 rows). The class column is matched to an existing class by grade and section. Classes are never created by an upload. Single adds use the same checks.
- **Under 18.** The class list carries a yes or no per student. It is stored on `members` only. The funnel's age is never read. Only a DHI admin can correct it.
- **Student record.** A house member is a `members` row and nothing more. The funnel's `students` table is left exactly as it is, so the funnel does not change. The student's own `members` row is the key that room tables point at (a `memberId`, together with `instituteId`; this is the house's `student_id`). The funnel profile and the house membership share one Better Auth user, so they are one account but two records. Linking the two, if ever wanted, is a later decision and must link by `authUserId` only, never by email, after the student's own tap and guardian consent (row 4).
- **Classes.** A `classes` table (grade and section) and teacher assignments live here, so teacher access is scoped to classes from day one.
- **Entry check.** One function, `requireMember`, finds the person from the session, finds their `members` row, refuses removed members and suspended institutes, re-reads a teacher's class assignments, and returns the role, institute and class. Every house function starts with it. Row 4 (consent) adds one more reason to refuse later, through the same function.
- **Entry states.** `members.me` returns one of `signedOut`, `noHouse`, `invitePending`, `active`, `removed`, `suspended`, so the page never has to guess.
- **First DHI admin.** An internal function the owner runs with a Google email. It creates a DHI admin invite with no institute, claimed through the same Join step. No list of powerful emails is kept in the environment. Run twice for the same email it returns `email_in_use`.
- **Leaving.** Removal sets the member to `removed` and leaves their rows alone. Deleting data follows the export and erasure rules decided in row 4.
- **Staff screens.** An area under `/staff` in the house, built from the existing components. The menu shows it only to staff roles. No new design.
- **Demo.** A seeded demo institute created as invites for fixed `@example.test` emails, claimed with the test sign in on development and preview. Sales demos use a screen share of that. Production has no demo seat.
- **Scope of DHI admin.** A DHI admin manages institutes, classes, members and invites in every institute. Whether and how they may read a student's room data is decided in row 4 and the room rows, not here.
- **Real students wait for row 4.** Until the consent step exists inside `requireMember`, only synthetic people are loaded on any deployment. No real class list of students is uploaded.

## Feature design

**Data model sketch** (all new tables are additive; names in camelCase to match the shared backend):

| Table | Key fields | Notes |
|---|---|---|
| `institutes` | `name` (string, required), `nameKey` (lowercase, for the duplicate check), `status` (`active` or `suspended`), `plan` (optional string label) | Created by a DHI admin only. |
| `classes` | `instituteId` (required), `grade` (the funnel's class union), `section` (string, required), `archivedAt` (optional) | Unique on institute, grade and section. Archived, never deleted, while members point at it. |
| `members` | `authUserId` (string, required), `role` (`student`, `teacher`, `institute_admin`, `dhi_admin`, `counselor`), `instituteId` (optional), `classId` (optional, students only), `name`, `email` (lowercase snapshot), `under18` (boolean, students only), `status` (`active` or `removed`), `joinedAt`, `removedAt` (optional) | One row per person. Identity is always `authUserId`, never `email`. Shape rules below. |
| `teacherClasses` | `memberId`, `classId`, `instituteId` | Many to many between teachers and classes. |
| `invites` | `instituteId` (optional), `role`, `email` (lowercase), `name`, `classId` (optional), `under18` (optional), `createdBy` (member id or `owner`), `expiresAt`, `claimedAt`, `claimedBy`, `revokedAt` (all optional) | No secret code. Found by verified email. |
| `accessLog` | `at`, `actor` (member id or `owner`), `action` (code from the list below), `instituteId` (optional), `targetMemberId` (optional), `inviteId` (optional) | Only ever added to. Ids and codes only. |

The funnel's `students` table is not changed.

Relationships: `institutes` 1:N `classes`; `institutes` 1:N `members`; `classes` 1:N student `members`; teachers N:M `classes` through `teacherClasses`; `invites` N:1 `institutes` and optionally `classes`. Indexes: `members` by `authUserId`, by `instituteId` and `role`, by `classId`, by `email`; `invites` by `email` and `claimedAt`, by `instituteId`; `classes` by `instituteId`, `grade`, `section`; `accessLog` by `instituteId` and `at`. Uniqueness holds only because mutations look rows up by index first, as in the rest of the backend.

Member shape rules, checked in code on every write: `student`, `teacher` and `institute_admin` must have an `instituteId`; `dhi_admin` and `counselor` must not. Only a `student` has `classId` and `under18`, and a student's `classId` must belong to the same institute and not be archived.

**State transitions**:
- Invite: pending (not claimed, not revoked, whether expired or not), then claimed or revoked. Expiry is read from `expiresAt` (14 days from creation or from the last extend), not stored as a state.
- Member: active, then removed, then active again on reinstate. Roles do not change.
- Institute: active, then suspended, then active again.

**API surface** (Convex functions; every one starts with `requireMember` unless it says otherwise; errors use the existing `fail(code)` helper, except a batch, which returns its bad rows so the rate limit count still holds, as `leads.submit` does):

| Function | Kind | Key inputs | Key outputs | Who | Key errors |
|---|---|---|---|---|---|
| `members.me` | query | none | entry state, and role, institute name, class, name when relevant; for `invitePending` the institute name and role | anyone, signed in or not | none (a signed out caller gets `signedOut`) |
| `members.claimInvite` | mutation | none (reads the verified session email) | the new membership | a signed in person with a pending invite, pressing Join | `no_invite`, `invite_expired`, `email_not_verified`, `institute_suspended`, `class_archived`, `rate_limited` |
| `members.list` | query, paginated (25) | `classId` (required for teachers), pagination | members in the caller's scope | staff | `forbidden`, `class_not_in_scope` |
| `members.remove`, `members.reinstate` | mutation | `memberId` | updated status | institute admin (own institute), DHI admin | `forbidden`, `last_admin`, `not_found` |
| `members.setClass` | mutation | `memberId`, `classId` | updated member (`members.classId` only) | institute admin, DHI admin | `class_not_in_scope`, `class_archived`, `forbidden` |
| `members.setUnder18` | mutation | `memberId`, `under18` | updated member | DHI admin | `forbidden` |
| `institutes.create`, `institutes.update`, `institutes.list` | mutation, query | `name`, `status`, `plan` | institute | DHI admin | `name_taken`, `forbidden` |
| `classes.create`, `classes.archive`, `classes.list` | mutation, query | `grade`, `section` | class | institute admin (own), DHI admin | `class_exists`, `class_in_use` |
| `classes.assignTeacher`, `classes.unassignTeacher` | mutation | `classId`, `memberId` | assignment | institute admin, DHI admin | `forbidden`, `not_a_teacher` |
| `invites.create` | mutation | `role`, `email`, `name`, `classId` (opt), `under18` (opt), `instituteId` (DHI admin only) | invite | per the hierarchy above | `email_in_use`, `bad_name`, `bad_email`, `forbidden`, `rate_limited` |
| `invites.createBatch` | mutation | up to 300 rows of name, email, class, under18 | `{ok:true, count}` or `{ok:false, badRows:[{row, reason}]}` | institute admin, teacher (own classes), DHI admin | `too_many_rows`, `rate_limited` |
| `invites.update`, `invites.revoke`, `invites.extend` | mutation | `inviteId` (`email` for update) | invite | anyone who could create that invite now, and a DHI admin for any invite | `invite_not_pending`, `email_in_use`, `forbidden` |
| `invites.list` | query, paginated (25) | status filter | invites in scope | staff | `forbidden` |
| `bootstrap.dhiAdmin` | internal mutation | `email`, `name` | invite | the owner, from a terminal | `email_in_use` |
| `demo.seed` | internal mutation | none | demo institute and invites | refuses unless `TEST_SIGNIN_ENABLED` is `true` | `demo_disabled` |

Batch row reasons: `bad_name` (checked with the existing `cleanName`), `bad_email`, `duplicate_in_file`, `email_in_use`, `class_not_found`, `class_not_in_scope`, `under18_missing`.

Staff functions that act on another person take a Convex `memberId` or `inviteId` and re-check inside the function that the target is in the caller's scope. They never take an auth user id or an email as an identity (except the invite's own email field, which is data, not identity). This is the same exception the funnel allows for its team functions.

**Access log codes** (the whole list): `invite.create`, `invite.claim`, `invite.revoke`, `invite.extend`, `invite.update`, `member.remove`, `member.reinstate`, `member.class`, `member.under18`, `class.create`, `class.archive`, `class.assign`, `class.unassign`, `inst.create`, `inst.suspend`, `inst.reinstate`.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Any call | Who is acting | The verified session, read by `getSignedInUser` (never an argument) |
| Any call | Role, institute, class, entry state | The caller's `members` row, its institute's `status`, and for a teacher the current `teacherClasses` rows (read on every call) |
| Claim | The email to match | The session's Google email, lowercased, and its `emailVerified` flag. On a test sign in the flag is waived only for `@example.test` and never for a DHI admin or counselor invite |
| Claim | Pending invite | `invites` by that email, not claimed, not revoked |
| Claim | `members.name`, `classId`, `under18` | The invite row |
| Claim | `members.email` | The session email, lowercased. A snapshot only |
| Create invite | `expiresAt` | Server time plus 14 days |
| Create invite | `createdBy` | The caller's member id, or `owner` for the internal function |
| Batch | Row limit | The constant 300 |
| Batch | Class of a row | An existing class in the caller's scope matched by grade and section |
| Every list | Page size | The constant 25 |
| Rate limits | Key and numbers | The caller's `authUserId` for claim and batch (10 an hour each), the institute for `email_in_use` refusals (50 a day) |
| Access log | `at`, `actor` | Server time and the caller |

**Key invariants**:
- One `members` row per `authUserId`. One pending invite per lowercase email across all institutes. A person with any `members` row cannot be invited, including a removed one, who can only be reinstated. The refusal is the same neutral `email_in_use` everywhere.
- Member shape rules above hold on every write. Roles never change after creation.
- No function trusts a client supplied identity. No staff function crosses an institute, except for DHI admins.
- Institute admins and teachers can never create, change or remove a DHI admin or a counselor.
- The last active DHI admin, and the last active admin of an active institute, cannot be removed.
- A student cannot change their own `under18`, class or role.
- Removal never deletes or edits a row the member owns.
- No personal data in any log line or access log row. Counts and ids only.
- Tables and fields are added in one release and removed in a later one (the shared backend rule).
- Each new table gets an erase class (`erased`, `kept`, `patched` or `system`) in the same release, as spec 0002 of the platform requires: `members` and `invites` are `erased` or `patched` per row 4's rules; `accessLog` is `kept` with ids only.
- The funnel's `purgeAbandoned` skips any sign in account that has a `members` row. An invited person who never presses Join may have their sign in account purged after 7 days, which is harmless because they can sign in again.

**Security model**: the browser is untrusted. Roles:

| Role | Can | Cannot |
|---|---|---|
| `dhi_admin` | Create and suspend institutes. Manage classes, members and invites in any institute, and revoke any invite. Invite counselors and DHI admins. Correct `under18`. | Anything in the rooms is decided in later rows. |
| `institute_admin` | Manage classes, teachers, students and invites in their own institute. | Touch another institute, a DHI admin or a counselor. Correct `under18`. |
| `teacher` | See and invite students of classes assigned to them. | See other classes, invite staff, change roles. |
| `student` | Read their own membership. | Anything about anyone else. |
| `counselor` | Sign in and see their own membership. | Everything else in this spec. Counseling is deferred. |

Compliance scope: personal data of students under 18 in India. Verifiable parental consent is row 4, so no real class list is loaded before it. Access control changes are audit logged. Rate limits use the existing rate limiter. Sign in is Google only and the house reads the same session as the funnel (spec 0003). A hostile institute admin cannot probe emails in bulk (the daily cap and the neutral refusal) and cannot move a person into a school (the Join step).

**Configuration required**: none new. `TEST_SIGNIN_ENABLED` (existing) gates the demo seed and the `@example.test` allowance, and must stay unset in production. The first DHI admin is set with `npx convex run bootstrap:dhiAdmin '{"email":"…","name":"…"}'` on the target deployment, using the funnel's deploy guard for production.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: bootstrap a DHI admin, claim, create an institute and its admin invite, claim it, upload a class list, a student presses Join and lands in their class, verifies **AC-1**, **AC-2**, **AC-4**, **AC-5**.
- Failure case: a class list with one bad row creates nothing and lists that row with its reason, verifies **AC-4**. Two tabs claim at once and one membership results, verifies **AC-6**.
- Failure case: an unverified Google email, an expired invite, a revoked invite, a different email, and a test account claiming a DHI admin invite are each refused, verifies **AC-6**.
- Failure case: a signed in person with a pending invite sees the Join step and nothing is created until they press it, verifies **AC-3**.
- Auth and permission: the role by function matrix, including a teacher reading another class, an unassigned teacher, an institute admin touching another institute or a DHI admin, a student calling a staff function, and a DHI admin acting on a suspended institute, verifies **AC-7**, **AC-8**.
- Lock out: a removed member and a member of a suspended institute are refused on the next call and their rows are unchanged, verifies **AC-9**, **AC-16**.
- Last admin guards, and a role that cannot be changed, verifies **AC-10**.
- Under 18 comes only from the list, verifies **AC-11**.
- Access log rows exist for each change from the code list and contain no name or email, verifies **AC-12**.
- Purge test: a teacher account older than 7 days with no `students` row survives `purgeAbandoned`, verifies **AC-15**.
- Funnel untouched: the whole funnel suite passes with no funnel file changed except the clean up, and a house member signing in to the funnel behaves as a new student, verifies **AC-14**.
- Rate limits: the first attempt over the claim limit and the first over the batch limit are refused with `rate_limited`, and the 51st `email_in_use` refusal in a day for one institute is too, verifies **AC-17**, **AC-19**.
- Demo: the seed refuses where `TEST_SIGNIN_ENABLED` is not `true`, verifies **AC-13**.

## Build plan

Build approach: Tracer Bullet (from the house scope). One thin real thread first, the owner's own DHI admin account, then thicken one strand at a time. Everything runs on the development deployment with synthetic people only. Nothing deploys to production before the funnel board freezes on 2026-10-30 23:59 IST (spec 0001 phase 5), and the house stays off the live domain.

1. **The thread.** Add `institutes`, `members`, `invites` and `accessLog` tables, the `requireMember` entry function, `members.me` with its entry states, `bootstrap.dhiAdmin`, and `members.claimInvite` for a staff invite. House side: a `/join` page with the Join step and a route guard that reads `members.me`, showing the "not in a house" page for a signed in stranger. Run it end to end for the owner as a DHI admin. Satisfies **AC-1**, **AC-3**, **AC-6**, **AC-12**.
2. **Institutes and the staff area.** `institutes.create`, `institutes.update`, `institutes.list`, the `/staff` shell with role based menu, and the institute admin claim. Satisfies **AC-2**, **AC-8**, **AC-16**, **AC-18**.
3. **Classes and teachers.** `classes` table and functions, `teacherClasses`, teacher assignment, and the teacher's class scope in `members.list`. Satisfies **AC-7**, **AC-8**.
4. **Invites for teachers and students.** The `under18` rules, single and batch invites with all or nothing validation and the fixed bad row reasons, revoke, update and extend, the neutral `email_in_use` with its daily cap, and the class list upload screen. A student's Join creates the `members` row only. Satisfies **AC-4**, **AC-5**, **AC-6**, **AC-11**, **AC-17**, **AC-19**.
5. **Keeping it safe.** Member removal and reinstate, the last admin guards, `setClass`, `setUnder18`, and the `purgeAbandoned` change. Satisfies **AC-9**, **AC-10**, **AC-11**, **AC-15**.
6. **Retire the demo gate.** Remove `gate.tsx`, `session.ts` and the fixed demo seat, put every house route behind `members.me`, and add `demo.seed` for development and preview. Satisfies **AC-13**.
7. **Proof.** The role by function test matrix, the claim race test, the purge test, the funnel suite run unchanged, and an end to end browser run of the join flow on the development deployment. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-14**, **AC-16**, **AC-17**.

## Consequences

**Positive**:
- Tenancy and roles exist before any room, so no room has to be reworked later.
- No change to the live sign in component or to the funnel's tables, so no risk to funnel accounts or to the challenge before it ends.
- One entry function means one place to add consent (row 4) and one place to audit.
- No secret code and no email service to run or leak. Nobody is moved into a school without pressing Join.

**Negative / tradeoffs**:
- We build and maintain institutes, invites and membership ourselves, where a plugin would have supplied some of it. The cost is the staff screens and the test matrix.
- Convex has no database constraints. Uniqueness and tenancy rely on every mutation doing its lookup. A missed check is a real bug, which is why the role by function matrix is required.
- A house student and a funnel student are two records for one account. Anything that wants both (for example showing a funnel result in the house) needs a later, deliberate link made by `authUserId` with consent.
- Room tables point at `members`, not at the funnel's `students`, so the platform's erase map for house tables is keyed by `memberId`, and `BACKEND.md`'s `student_id` becomes a member id in the house.
- Matching an invite by Google email means a student whose school email is not a Google account cannot join until staff correct the email, or until another sign in method is added (spec 0003 would then need a decision).
- Until the room rows ship, a real member sees the old demo data inside the house. The house must stay on development, with synthetic people, until rows 5 onward and row 4 are built.
- A removed member's sign in account lives on until row 4's erasure rules decide otherwise.
- Compliance scope: personal data of students under 18 in India. Access control changes are audit logged and that is not negotiable.

**Neutral**:
- Repo wide row 4 (one account across both parts) shrinks to the consent and erasure side, because one Better Auth user per person already holds. Run `/scope` to reconcile it.
- The Convex code lives in `apps/joining/convex/` today and moves to `packages/backend/` under spec 0001. This spec names functions, not paths, so it holds before and after the move.

## Follow-up

- [ ] Run `/scope` to reconcile repo wide row 4 with this spec, and to note that room rows point at a member id.
- [ ] Accept spec 0001 and its children 0002 and 0003 before building, since this spec depends on them. The shared backend package must exist before the house tables land in it.
- [ ] Row 4 adds the consent reason to `requireMember`, decides how `members` and `invites` rows are erased or patched, and decides whether and how a funnel profile may ever be linked to a house member (by `authUserId`, with consent).
- [ ] Update `BACKEND.md` so the house's `student_id` reads as the student's member id, and the `users` and `invites` tables match this spec.
- [ ] Decide later whether students without a Google account need another sign in method (spec 0003 currently says Google only).
- [ ] A later function for DHI admins to move a person between institutes, if it is ever needed.
- [ ] The Convex, Better Auth and Cloudflare skills sit under `apps/joining/.claude/skills/`, so they do not reach house work at the repo root. Put them where both parts see them and add an `## Agent skills` section to root `AGENTS.md` (also listed in spec 0001).
- [ ] When the backend package exists, add the `members` rules to its `AGENTS.md`, and note the new sign in wiring in `src/lib/auth/AGENTS.md` (the house's own Better Auth server is removed under spec 0003).

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
