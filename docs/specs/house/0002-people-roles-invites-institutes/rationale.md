# 0002 rationale: People, roles, invites and institutes for the house

## Context

> ⚠️ Premise note: this spec stands on three things that are not built or not accepted yet. (1) Spec 0001 and its children 0002 and 0003 (one database, one sign in) are still `Proposed`, and the shared backend package they describe does not exist, so the Convex code still lives in `apps/joining/convex/`. (2) The funnel's `students` table requires an age, and the funnel's profile code assumes a `students` row always comes with a check and a consent, so a house member must not create one. (3) Repo wide row 4 (one account across both parts) leaves open how house roles and `institute_id` attach to the Better Auth user, and this spec settles that. The assumptions are stated as constraints below, and the follow-ups are in `index.md`.

The house is a B2B product: an institute pays, DHI runs it, and teachers and students use it. Today it has no accounts at all. Any email opens a fixed demo seat, and the roles in `BACKEND.md` (student, teacher, institute admin, DHI admin, counselor) exist only as a table in a document. Every later room, and the DHI Brain on top, needs to know who a person is, which institute they belong to, which class they are in, and what they may see. Getting this wrong is expensive to repair, because `student_id` and `institute_id` end up on every row and in every query.

Constraints that shaped the choice:
- The sign in is Better Auth inside Convex with Google only (spec 0003). It is live for the funnel and must not be disturbed before the challenge board freezes on 2026-10-30 23:59 IST.
- Convex has no database level constraints or row level policies. Tenancy and uniqueness live in code, so the design must make the checks few, central and testable.
- The users are largely under 18. Entry is invite only, personal data is sensitive, and access changes must leave a record.
- The funnel already has a `students` table keyed to the Better Auth user, a rate limiter component, an error helper and a daily clean up of unused accounts.
- There is no email service, and adding one for the first row is extra weight.
- The team is very small, so the design must be understandable and operable by one person.

A finding during design: the funnel's daily clean up (`purgeAbandoned`) deletes any sign in account older than 7 days that has no `students` row and no session in the last 24 hours. Teachers, admins and counselors have no `students` row, so without a change they would be deleted. This is covered by AC-15.

## Options considered

### Option 1: Our own tables in the shared backend, Better Auth only signs in

Institutes, classes, members, invites and an access log are plain Convex tables. One entry function, `requireMember`, checks them. Invites are matched by the verified Google email.

**Pros**:
- No change to the live auth component, so no risk to funnel accounts.
- Tables are indexed and joinable with room data, which every later query needs for institute and class scoping.
- Fits the DHI shape: bulk class list, DHI wide admin, teacher scope by class, no email needed.
- Easy to test as a role by function matrix with the existing Convex test tooling.

**Cons**:
- We write and maintain institutes, invites and membership ourselves, plus the staff screens.
- Authorization lives in code, so a missed check is a real bug.

### Option 2: Better Auth organization plugin, via a local install of the auth component

Use the plugin for organizations, members, roles and invitations.

**Pros**:
- Organizations, members, roles and invitations come ready made, with a known data shape.
- A well known library path rather than hand made tables.

**Cons**:
- The Convex Better Auth docs list the supported plugins as Anonymous, Email OTP, Generic OAuth, JWT, Magic Link, One Tap, Phone Number, Two Factor and Username. The organization plugin is not among them. Plugins outside the list need a local install, which moves the auth component into this repo with its own generated schema. (as of the docs fetched 2026-10-18)
- That reshapes the live sign in component. Nothing read confirms that live funnel accounts carry over unchanged, so it would need a rehearsal and cannot touch production until after 2026-10-30.
- Its data sits inside the auth component, which is harder to join with room tables. Class scoping, bulk class list import and a DHI wide admin would still be ours to build, and its invitations assume email delivery.

### Option 3: Roles as fields on the Better Auth user, no institute tables

Store `role` and `instituteId` as extra fields on the auth user, or use a roles plugin that adds only a role field.

**Pros**:
- Smallest build. No new tables for membership.

**Cons**:
- No place for classes, teacher assignments, invites or an access log, so those become extra tables anyway.
- The auth user lives in the component and cannot be indexed by institute from app tables.
- Mixes identity (who you are) with membership (where you belong), which makes moving or removing a person harder.

## Rationale

Option 1 wins on the forces above. The strongest one is the live funnel: the sign in component is serving real minors and a ranked challenge until 2026-10-30, and the cheapest way to protect it is to leave it alone. Own tables also give the indexes the rooms need (find a student's institute and class in one lookup) and keep authorization in one function that is easy to test against every role. The plugin would have saved some code but not the parts that are hard here (class scope, bulk import, DHI wide admin), and it cost a risky change to the auth component.

The engineer first chose the organization plugin, then switched to own tables after seeing that it is outside the supported plugin list and needs a local install. This record keeps that so the choice is not reopened without the new facts.

Matching an invite by verified Google email, with no secret code, is simpler and safer than a link carrying a token: there is nothing to leak or guess, and the join address can be the same for everyone. The runner up was a per invite code in the link, rejected because the email match is needed anyway and the code adds a secret to store and rotate.

A house member is a `members` row and nothing else. The first draft also created a `students` row at claim and made `students.age` optional. An independent cross check showed that breaks the funnel: its `createProfile` returns early when a `students` row exists, so the student would never get a check or consent, and a missing age fails the funnel's own return validators and `consents.ageAtConsent`. Leaving `students` alone removes that risk and any change to live funnel code. The cost is that room tables point at the member and not at `students`, which is recorded as a consequence. Linking a funnel profile to a house member is a later decision for row 4, by `authUserId` only and with consent, because linking by email would let a test account with the same email reach a real student's funnel data.

The Join step (nothing is created until the person presses it) and the `@example.test` limit on the test sign in come from the same cross check: without them an admin could silently move any signed in person into a school, and anyone with the test sign in on could claim an invite for an email they do not own.

## References

**Project sources**:
- Root `AGENTS.md` and `BACKEND.md`: the roles, tenancy rule (`student_id` and `institute_id` on every owned row) and the room rules
- Spec 0001 (one platform) and children 0002 (shared database) and 0003 (shared sign in): Convex, Better Auth with Google only, tenancy in code, the additive rule and the erase classes
- `apps/joining/convex/auth.ts`, `schema.ts`, `helpers.ts` and `purge.ts`: the live sign in, the `students` table, the `fail` and `requireStudent` helpers and the daily clean up
- `apps/joining/convex/AGENTS.md`: no function takes a student id, email or auth user id as input
- The installed skills `convex-authz`, `convex-test` and `better-auth-security-best-practices`
- `docs/scope/house/platform.md`, row 2, and `docs/scope/_root/scope.md`, row 4

**Practices & standards**:
- Tenant isolation designed on day one, not added after launch
- Least privilege and a role by function test matrix
- Allowlist entry by verified email; no shared secret in a link
- Audit logging of access control changes, with ids only and no personal data
- All or nothing validation for bulk imports
- Additive schema changes: add in one release, remove in a later one

**Links** (web verified 2026-10-18):
- [Local install, Convex + Better Auth](https://labs.convex.dev/better-auth/features/local-install): says a local install makes it possible to use plugins beyond those supported, and gives full control of the schema
- [Supported plugins, Convex + Better Auth](https://labs.convex.dev/better-auth/supported-plugins): the list of plugins that work without schema changes, which does not include the organization plugin
