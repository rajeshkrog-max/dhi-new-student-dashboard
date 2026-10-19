# Review, house/people-roles-invites (spec house/0002, commits a5348b0 and c21c2fb), 2026-10-19

**Reviewed by**: claude-opus-5-5 (fresh review agent; author on the session that built the change)
**Scope**: 50 files, `git diff a5348b0^..c21c2fb` (the two commits that built house spec 0002), branch vs main. Consent code added later by spec 0005 was not judged. Line numbers are at the branch head.
**Verdict**: Blocked

## Summary

The change adds institutes, classes, members, invites and an access log to the shared backend, with one entry check (`requireMember`), the Join step, the staff area and the end of the demo seat. The tenancy design is sound. Every staff function gets the caller from the session and checks the role, the institute and, for a teacher, the class again on every call. The role by function matrix and the walls between institutes are tested. Two problems in the invite code defeat things the spec promises. First, the daily `email_in_use` cap (AC-19) can be bypassed through `createBatch`, so a hostile staff member can probe addresses in bulk, and a list with more than 50 addresses already in use crashes. Second, `pendingInviteFor` reads only the oldest 20 unclaimed invites, so any institute can stop an address from ever joining any school.

## Blockers

### 🔴 The `email_in_use` daily cap (AC-19) can be bypassed through a class list, `packages/backend/convex/invites.ts:103`, `:120-123`, `:138` (with `limits.ts:53`)

**Problem**: `createBatch` checks the cap once before the loop (`inUseExhausted`, a `check` with count 1). It then checks up to 300 addresses with `emailTaken`, returns a per row `email_in_use` verdict, and only at the end calls `countInUse(ctx, key, inUse)`, which is `rateLimiter.limit(..., { count: inUse, throws: false })`. In `@convex-dev/rate-limiter`, a `limit` whose count is more than the tokens left returns `ok: false` and writes nothing (`returnSingle` returns `updates: []` when not ok). The refusal is ignored, and the `badRows` holding every `email_in_use` row are still returned.

**Failing scenario**: An institute admin (or any teacher of the institute) spends the day's window down to 1 left, for example with 49 addresses of their own members. From then on, every class list they send passes the "1 left" pre check. Each list holds up to 299 addresses to probe plus 1 address known to be taken, so the in use count is always at least 2, the `limit` is refused, nothing is counted, and the full per row answer comes back. That is 10 lists an hour × 299 addresses for each staff account (`inviteBatch` is keyed per person, the cap per institute), every hour, with no daily end. The spec's promise ("A hostile institute admin cannot probe emails in bulk (the daily cap and the neutral refusal)") does not hold. What leaks is whether a given address (often a minor's) is a member or invited anywhere in DHI.

**Why it matters**: AC-19 is the one control against enumeration across tenants, and a class list is exactly the bulk tool it was meant to stop. The batch counting path has no test: `houseInvites.test.ts:172-187` covers only single `create`.

**Suggested fix**: Charge the cap for each row as you go, and stop answering when it runs out. Before each `emailTaken` row check, take one token (`limit` with count 1). If the token is refused, end the batch with `rate_limited` and no `badRows`. Otherwise, take `min(inUse, tokensLeft)` and refuse the whole list when the in use count is more than what is left. Either way, never return a per row `email_in_use` that was not charged. Add a convex-test that burns the window to 1 and then sends a list with 2 or more in use rows.

## Major

### 🟠 A class list with more than 50 addresses already in use throws a plain server error, `packages/backend/convex/invites.ts:138`

**Problem**: `countInUse(ctx, key, inUse)` passes `count: inUse`. The rate limiter's `validateRequest` throws a plain `Error("Rate limit emailInUse count N exceeds 50")` whenever the count is more than the capacity (50), and it does this whatever `throws` is set to. The whole mutation rolls back, including the `inviteBatch` token, and the page gets a generic server error with no `code`.

**Failing scenario**: An admin uploads a 300 row class list. It succeeds. Later they upload the same file again, for example after editing one row. All 300 rows are `email_in_use`, so the count is 300 and the server throws. `ClassListSection` shows the generic refusal words and no bad rows. A plain `Error` also bypasses the project's `fail(code)` contract and lands in the Convex error logs.

**Why it matters**: This is a normal admin action, and it fails with an unexplained error. It also makes refused lists free, because the batch token rolls back too.

**Suggested fix**: This is covered by the fix above (charge per row, with a count no greater than what is left). At minimum, clamp the count to the capacity, and return `rate_limited` when the in use count is more than the tokens left.

### 🟠 `pendingInviteFor` sees only the oldest 20 unclaimed invites, so one institute can stop an address from ever joining, `packages/backend/convex/inviteCore.ts:13-19`

**Problem**: The query is `by_email_and_claimedAt` with `claimedAt == undefined`, then `.take(20)` in ascending creation order, and only after that drops revoked rows. Revoked invites stay unclaimed forever. Once an address has 20 revoked invites, a newer pending invite is never found.

**Failing scenario**: An institute admin of Alpha School creates an invite for `student@gmail.com` and revokes it, 20 times. Neither `create` nor `revoke` is rate limited when the address is free. After that:
- `emailTaken` answers false for that address in every institute, so Beta School (or several institutes at once) can each make a "pending" invite. This breaks the "one pending invite per lowercase email across all institutes" invariant.
- `members.me` answers `noHouse` and `claimInvite` answers `no_invite`, so the student can never join any school.
- Nobody can repair it, because revoked invites cannot be un-revoked. Only a database edit fixes it.

The same thing happens by accident to an admin who fixes typos by revoking and making the invite again.

**Why it matters**: Any tenant can deny service to a person in another tenant, permanently. The uniqueness rule the spec relies on ("Uniqueness holds only because mutations look rows up by index first") is silently broken.

**Suggested fix**: Put `revokedAt` in the index range, for example a new index `by_email_and_claimedAt_and_revokedAt` with `eq(email).eq(claimedAt, undefined).eq(revokedAt, undefined)` and `.first()`. Keep the old index for now, per the additive rule. Alternatively, iterate with `for await` until a row that is not revoked is found. Add a test that revokes 21 times and then makes a pending invite.

## Minor

### 🟡 `members.me` shows the inviting institute's name and role to a session whose email is not verified, `packages/backend/convex/members.ts:64-67`

`claimInvite` refuses an unverified session, but `me` answers `invitePending` with `instituteName` and `role` for any session whose email matches. On every deployment with `TEST_SIGNIN_ENABLED`, email and password sign up is open with `requireEmailVerification: false` (`auth.ts:46-49`). Anyone can sign up as `someone@gmail.com` and learn which school invited that address, and as what role. In production this needs a Google account whose `email_verified` is false, which is rarer but not impossible. Fix: answer `invitePending` only when `user.emailVerified` is true or `mayClaimUnverified(...)` holds; otherwise answer `noHouse`. Add the case to `houseEntry.test.ts`.

### 🟡 A DHI admin's `email_in_use` refusals use up the institute's daily cap, `packages/backend/convex/invites.ts:50`, `:102` (`inviteCore.ts:32`)

`inUseKey(mc, plan.draft.instituteId)` keys a DHI admin acting inside institute X on X. A DHI admin's 50 mistakes, for example while uploading lists for a school, lock X's own admin and teachers out of every invite call until the next day. Key a DHI admin on their own member id. Then the institute cap measures only that institute's own staff.

### 🟡 `invites.list` filters by status after it paginates, `packages/backend/convex/invites.ts:263`

The staff Invites screen defaults to `status: "pending"`. When the 25 newest invites in scope are all claimed or revoked, the first page is empty while `isDone` is false. The screen then says there are no invites (`ListEmpty`) next to a "Show more" button. A DHI admin's "all invites" view hits this as soon as the platform has a few claimed lists. Add a status field or an index that holds `claimedAt` and `revokedAt`, or filter inside the query before `.paginate`.

### 🟡 Reinstating a student can put them back in an archived class, `packages/backend/convex/members.ts:254` (with `classes.ts:74-75`)

`classes.archive` refuses only while an active student points at the class, so a class whose students are all removed can be archived. `reinstate` then sets the student back to active with `classId` still pointing at the archived class. This breaks the shape rule ("a student's `classId` must ... not be archived"). Refuse the reinstate with `class_archived` (the admin moves the student with `setClass` first), or let `archive` also count removed students.

### 🟡 A DHI admin's "everyone" list and "everyone by role" scan the whole members table, `packages/backend/convex/members.ts:195-196`

`.filter(role)` after a full table scan means a page for a rare role (counselor, dhi_admin) reads every member until 25 match. Use `by_instituteId_and_role` with `instituteId: undefined` for the two roles without an institute, which is what `isLastAdmin` already does. For the others, require an institute.

## Nits

- ⚪ `packages/backend/convex/members.ts:162` (also `invites.ts:238`, `classes.ts:89`, `:110`, `institutes.ts:77`): the code rebuilds `paginationOpts` to clamp `numItems`. The Convex guidelines say to pass it through unchanged. The spread keeps the other fields, so this is harmless today, but a fixed `numItems: PAGE_SIZE` on the client plus a check would match the guideline.
- ⚪ `packages/backend/convex/members.ts:209-210`: an institute admin gets `forbidden` for a DHI admin's or counselor's member id, but `not_found` for another institute's member. That tells them which role an id belongs to. Ids are not guessable, so this is cosmetic. Check the institute first.
- ⚪ `packages/backend/convex/inviteCore.ts:42-43`: stray blank lines with trailing whitespace.
- ⚪ `packages/backend/convex/houseAuth.ts:32` and `members.ts:217`, `:224`: `take(200)` silently caps teacher assignments and the admin lists for the last admin check. That is fine at current sizes; a comment saying the bound is deliberate would help.

## Strengths

- One entry check (`requireMember`) re-reads the member, the institute's status and the teacher's `teacherClasses` on every call. No function takes an identity argument. `targetFor` and `classInScope` answer `not_found` for another institute's rows, so ids learn nothing.
- `claimInvite` gets the claim right. The verified session email is matched to the invite. The test inbox waiver is narrow and excludes DHI admins and counselors. It is idempotent for an existing member. OCC makes the two tab race safe, because both calls read the same `by_authUserId` range. Every expected refusal returns a result object, so the claim rate limit really counts.
- The class list is all or nothing, with fixed reasons and a server side class match that never creates classes. The role by function matrix and the tests of the walls between institutes (`houseAccess.test.ts`) are real behavioural tests, not mocks. The purge change (AC-15) is minimal and tested.

## Test coverage

Most acceptance criteria are covered (AC-1 to AC-19) by `houseAccess`, `houseEntry`, `houseInvites` and `houseCore` tests, including the unassigned teacher, the suspended institute, the last admin guards and the access log contents. Gaps that matter:
- The `email_in_use` counting inside `createBatch` is untested: no test shows that a list's in use rows count against the cap, that a list over the remaining cap is refused, or what happens with more than 50 in use rows. This is how both the Blocker and the first Major slipped through.
- No test for an address with many revoked invites (the `take(20)` window).
- No test that `members.me` hides `invitePending` from an unverified session.
- No test that reinstating a student whose class was archived is refused.
- The two tab claim test runs serially in convex-test, so the real race is covered only by OCC reasoning. That is acceptable, but noting it in the test name would be clearer.

## Resolution (same day, by the author)
The blocker and both majors are fixed, with tests in `packages/backend/convex/houseReviewFixes.test.ts`:
- A class list is charged for its refused addresses before any answer goes out, capped at one day's worth, and answers `rate_limited` when the day's window cannot take the charge (`invites.ts`, `houseCore.ts`).
- A list with more than 50 refused addresses now answers its bad rows instead of failing with a plain error.
- The pending invite of an address is read through a new index on email, claimed and revoked, so any number of revoked invites cannot hide it (`inviteCore.ts`, `invites.by_email_and_claimedAt_and_revokedAt`).
Left open (minor): the invite institute name shown to an unverified session in `members.me`; a DHI admin's refusals using the institute's cap; `invites.list` filtering after it pages; reinstating a student into an archived class; a DHI admin's role list scanning the members table.
