# 0005. Consent, privacy and access record for minors' house data

**Date**: 2026-10-19
**Status**: In Progress

## Summary

Before any real student uses the house, the house needs proof that they agreed, and for a student under 18 proof that the school holds a parent's consent. This spec adds that gate (nobody enters a room without it), a fixed rule for who may see what (students see everything of their own, teachers only academic results, the school only named academic results and class totals of 10 or more, DHI admins no room content), a record of every view by anyone but the student, a setting that keeps a student's feelings from parents unless the student shares them, and export, withdrawal and erasure of a student's house data. The words of the notice are drafts that the owner must approve, and the legal check on the school recording a parent's consent is still owed before any real student enters.

## Requirements

**User stories**:
- As a student, I want to agree for myself and know exactly who can see what, so that I can use the house without being watched in ways I did not choose.
- As a student under 18, I want my parent's consent recorded by my school before I enter, so that my data is handled safely.
- As an institute admin, I want to record that a parent's consent is on file for a student or a whole class, and to record a parent's withdrawal, so that the school stays accountable for what it says.
- As a student, I want to see who has looked at my data, control parent sharing, withdraw, download my data and erase it, so that I stay in control.
- As the owner, I want every staff view recorded, no private writing leaking, and old data removed on a clock, so that I can answer a parent or a regulator.

**Acceptance criteria** (the contract, each one checkable on its own):
- **AC-1**: A member whose role is student can reach no room function until the current house notice is agreed and, if they are under 18, the school has recorded the parent's consent on file. A missing `under18` flag counts as under 18. `members.me` answers `consentNeeded` with the list of what is missing (`self`, `parent`) or `withdrawn` with the sides that withdrew (`self`, `school`), and every room function refuses with `consent_required` or `consent_withdrawn`. When both apply, `withdrawn` is answered first. Teachers, institute admins, DHI admins and counselors are not gated.
- **AC-2**: The house notice has versions held in `consentTexts` with their exact lines and a fingerprint, as the funnel does, and the kinds `house` (the student notice) and `house_parent` (the wording the school relies on) are added to `ConsentKind` and `CONSENT_KINDS`. `HOUSE_NOTICE_VERSION` names the current version, and `HOUSE_ACCEPTED_VERSIONS` is the set of versions whose agreement still counts; versions are never compared by order, so a version dropped from the set needs a fresh agreement. `HOUSE_PARENT_ACCEPTED_VERSIONS` does the same for parent records. The agree call refuses an unknown version or a wrong fingerprint by returning `consent_text_changed`, appends one `self` record, and a repeat for the same version changes nothing. The first agree call stores the `house` text if it is missing, and the first parent record stores the `house_parent` text.
- **AC-3**: Only an institute admin of the student's own institute can record that a parent's consent is on file, for one student or for a class (in pages of at most 50), and only for a student marked under 18. One student that cannot be recorded answers its error (`not_under18`, `not_found`, or `institute_suspended`); a class or a list answers a skip reason per student (`adult`, `other_institute`, `already_on_file`, `removed`). It records who, when, the wording version and that the student was under 18, never a parent's name, phone or form, and writes one access log row per student. A DHI admin cannot record a parent's consent, and a suspended institute's admin cannot use the screen.
- **AC-4**: A parent record, once made, counts while it is not withdrawn, including after the flag goes to 18 or over and back. When a DHI admin corrects a student to under 18, entry locks until a parent record exists. Correcting to 18 or over needs nothing more, and a parent withdrawal binds only while the flag is under 18. A student's own agreement stays valid when the flag changes and is never asked again for that reason.
- **AC-5**: A student can withdraw their own consent, and an institute admin can record that a parent withdrew. Each side's state is the latest `withdrawn` or `restored` record on that side, in creation order, and the student is withdrawn if either side is. From that moment every room refuses with `consent_withdrawn` and the data is kept. A student restores only their own side (`not_withdrawn_by_you` otherwise), and only an institute admin restores the school's side.
- **AC-6**: A student who is locked (consent needed or withdrawn), removed, or in a suspended institute can still reach Your data for their consent state, export and erase (they are data rights), and a locked or withdrawn student can also agree, withdraw, restore, and use the sharing setting and the access record. Exactly these functions use the lock tolerant entry check: `members.me`, `consent.notice`, `consent.state`, `consent.agree`, `consent.withdraw`, `consent.restore`, `sharing.get`, `sharing.set`, `access.mine`, `dataRights.exportMine` and `dataRights.eraseMine`. A source scan asserts no other function uses it, and every route other than the consent screen and Your data sends a locked student to the dashboard.
- **AC-7**: Who may see which kind of a student's data is one pure function, `canView`, that takes the viewer, their relation to the student, the kind, and the target's consent state. The result is exactly the table in the design: the student sees all of their own; a teacher of an assigned class sees named academic results only; an institute admin sees named academic results and, for mood, meals, habits, sleep, study hour and modules, class totals only; a DHI admin and a counselor see no room content; writing and desk chats are seen by the student alone. A target who is withdrawn, removed, erased or not yet through consent is invisible to staff, and counts for no total. A parent row is reserved in the rule for a later parent report and has no function or test in this row.
- **AC-8**: Mood, meals, habits, sleep, writing, desk chats, study hour and module data are never returned by name to a teacher, an institute admin, a DHI admin or a counselor. Every room registers the kind codes its data uses, and a code to room table says which kinds are `academic` and which are wellbeing.
- **AC-9**: Parent sharing is a student's own setting, `none` or `summary`, off until the student turns it on, changeable only by that student, and each change writes one access log row. This row builds the setting and its record only; no parent account, screen or report exists yet.
- **AC-10**: Every staff read of a student's personal data is one public mutation built by a single wrapper, `staffRead`, that checks `canView`, writes one `viewLog` row (viewer, viewer role, student, institute, the kind, time) per student per kind per call, and then reads. Rows hold ids and codes only. The roster (name, email, class, under 18) is how staff run access and is not a view. A source scan proves every staff read of personal data goes through the wrapper, and a test lists every public function that returns room tables.
- **AC-11**: A student sees their own access record, 25 a page: the role and the India date (no time) of each view, never a name. A view by the DHI team appears as "DHI team".
- **AC-12**: A student downloads one versioned JSON file of their house data: `{ schema, exportedAt, profile, consent, sharing, events: [{ type, day, id }], rooms: { <room>: ... } }`, built in pages (not one read) and holding nothing about anyone else. Each room registers an entry `{ table, kinds, exporter, eraser }`. At most 5 exports an hour for each person.
- **AC-13**: A student's erase (after a two step confirm), or the team's erase on a parent's request, is invisible at once and complete eventually. Step one is atomic: the `members` row becomes a tombstone (`status` removed, `erasedAt` set, name and email empty, `authUserId` replaced by `erased:<id>`, the role, institute, class and under 18 flag kept as consent proof), the sharing setting goes, their sessions end, invites for that email are cleared (pending ones revoked, name and email emptied), and the receipt is queued. Step two deletes their events and every room's rows in self scheduled pages through the registered erasers, then writes one receipt of counts only. The consent records, view record and access log (ids only) stay. The sign in account is deleted only when the person has no funnel profile and no other live membership. The team's command needs the Google email, the school and the class (the school's name and the class as "grade section") to match, only for a student marked under 18, and answers `no_match` the same whatever was wrong, including a student who changed class. After a student's own erase the same email is blocked for 30 days with the same neutral refusal as any address that cannot be invited, then can be invited as a new person.
- **AC-14**: A data map lists every house table with exactly one class (`erased`, `kept`, `patched` or `system`) and a retention note, and a test fails if a table in the schema has no entry. A test erases a student who has more rows than one page and proves nothing personal remains except the `kept` classes.
- **AC-15**: A daily job deletes view records older than 3 years, erases (as AC-13) every member, staff included, who has been removed for 12 months and not reinstated and does not belong to a suspended institute, and deletes expired erase blocks. It works in pages, is idempotent, and logs counts only.
- **AC-16**: Nobody but server code reads events, and the only ways a person's events leave or go are their own export and erase. No staff screen, report or API returns an event.
- **AC-17**: Limits, each keyed by the person: `consentAgree` 10 an hour, `consentWithdraw` (withdraw and restore together) 10 an hour, `dataExport` 5 an hour, and `parentRecord` 20 calls an hour for each institute admin. A refused call answers `{ ok: false, code: "rate_limited" }` so the count stays.
- **AC-18**: The house notice and the parent wording are drafts in code, marked as not approved, and the screen shows them as written. They cannot be treated as final until the owner approves the exact words.
- **AC-19**: No personal data is logged: log lines, receipts, the view record and the access log hold counts, codes and ids only (proven by a source scan of these files). Receipts are readable by internal code only.
- **AC-20**: The consent screen, Your data and the institute admin's parent consent screen work at 360, 768, 1024 and 1280 px with no sideways scroll, tap targets of at least 44 px and text of at least 12 px on touch, use the house kit, and the notice's "I agree" stays locked until the notice has been scrolled to the end, as in the funnel. The parent consent list shows only the school's own side of a withdrawal, never a student's own withdrawal.
- **AC-21**: This build changes no funnel table and no funnel file, the funnel's `consents` and `consentTexts` rows are only added to (new kinds), and the whole funnel suite passes unchanged. The funnel's own erase, when it is built, follows the same account deletion rule.
- **AC-22**: The demo seed records consent for its demo students so the browser scripts keep working, and it still refuses to run anywhere the test sign in is off.
- **AC-23**: A class total for any kind other than named academic results comes from one shared helper, `classTotal`, that counts distinct active students of one current class who have consent in good standing and data of that kind in a fixed period, returns nothing when fewer than 10 stand behind it, allows only fixed periods and no overlapping or narrower cuts, and writes one access log row per call.
- **AC-24**: Rights over a student's named academic results follow the student's current class and their teacher's current assignments, so a student who changes class is seen by the new teacher and no longer by the old one.

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): one consent gate inside the existing entry function, one fixed access rule, a logged view wrapper, and an erase that follows the funnel's pattern in pages.

Consent is checked where every house call already starts (`requireMember`), the school records the parent's consent, who may see what is one pure function, views go through one wrapper that records them, and export, withdrawal and erasure are built for house data the way the funnel designed them for the funnel, but paged because a house student's rows grow every day.

**Implementation skills**: `convex` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex/`) · `convex-authz` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-authz/`) · `convex-test` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-test/`) · `convex-reviewer` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-reviewer/`)

**What is decided**:
- **Parent consent.** The school records it: an institute admin says the parent's written consent is on file. Only an institute admin can, for one student or a class. The house stores who, when and the wording version, never anything about the parent. A stronger parent confirmation (a link or code) can be added later as another kind of record without a rebuild.
- **The student agrees too.** Every student, adult or under 18, presses "I agree" on a versioned house notice. For an under 18 this is in addition to the parent record.
- **The gate.** A student joins first. Until consent exists, `members.me` says `consentNeeded` and every room refuses, as spec 0002 planned. Staff are not gated.
- **Who sees what.** The student all of their own. A teacher: named academic results of their class only. The institute admin: named academic results, and class totals only of 10 or more for wellbeing kinds. A DHI admin and a counselor: no room content. Writing and desk chats: the student alone. A withdrawn, removed or erased student is invisible to staff.
- **Parent.** There is no parent account, role or screen yet. The rule keeps a reserved place for a later parent report, and this row builds only the student's sharing setting.
- **The access record.** Every staff view of named student data writes a row through one wrapper. Because a Convex query cannot write, these staff screens are mutations and load on open or refresh, not live. The roster is not a view. Kept 3 years. Students see role and an India date, never a name.
- **Withdrawal.** Pauses everything at once and keeps the data until erase. A student restores their own side, only an institute admin restores the school's side.
- **Erase.** The student, or the DHI team on a parent's request for an under 18 after three matching facts. The school can pause a student but cannot erase their data. It is invisible at once and complete eventually (the member is tombstoned first, rows are deleted in pages, the receipt comes last). The same email waits 30 days after a student's own erase.
- **Retention.** Until erase is requested, and automatic erase 12 months after a member is removed and not reinstated (staff too, and never for a suspended institute).
- **Age corrections.** Only a DHI admin changes the flag (spec 0002). Under 18 locks entry until a parent record exists. Adult needs nothing more.
- **Rights follow the current class** for named academic results.
- **Words.** The notice and the parent wording are drafts for the owner to approve, and the legal check on a school recording a parent's consent as the parent's verifiable consent is owed before any real student enters.

## Feature design

**Data model sketch** (all new tables are additive; the funnel's tables are not changed):

| Table | Key fields | Class and notes |
|---|---|---|
| `consentRecords` | `memberId` (required) · `instituteId` · `kind`: `self`, `parent`, `withdrawn`, `restored` · `by`: `self` or `school` · `byMemberId` (id of `members`) · `textVersion` · `under18AtTime` (boolean) · time (creation order is the order) | `kept`. Append only. No parent name, phone or form. |
| `sharingSettings` | `memberId` · `parentLevel`: `none` or `summary` · time | `erased`. One row per member; no row means `none`. |
| `viewLog` | `viewerId` (id of `members`, absent for the team) · `viewerRole` (a role or `team`) · `targetMemberId` · `instituteId` · `kind` (a data kind code) · time | `kept` for 3 years, then deleted by the daily job. Ids and codes only. |
| `houseErasures` | time · `by`: `self` or `team` · counts per kind of data | `kept`. The receipt, readable by internal code only. No student id, name or email. |
| `houseErasedEmails` | `hash` (keyed hash of the lowercase email) · `until` | `system`. The 30 day block. |

Changes to existing tables: `members` gets an optional `erasedAt`; an erased member is a tombstone as AC-13 says. `accessLog` gains the codes `consent.parent`, `consent.parentWithdrawn`, `consent.parentRestored`, `sharing.set`, `data.erase` and `totals.read`. `consentTexts` gains the kinds `house` and `house_parent` (in `ConsentKind` and `CONSENT_KINDS`), as new versions only.

Indexes: `consentRecords` by `memberId` and kind; `viewLog` by `targetMemberId` and time, and by time (for the sweep); `sharingSettings` by `memberId`; `houseErasedEmails` by `hash`, and by `until`. Uniqueness holds only because the mutations look rows up by index first.

Data kinds (codes): `profile`, `academic`, `mood`, `meals`, `habits`, `sleep`, `writing`, `desk`, `hour`, `modules`. `profile` (the roster) is not viewed through the wrapper. Each room registers the kind codes it uses, and a code to room table fixes which are `academic`.

**The access rule** (`canView(viewer, relation, kind, targetConsent)`, one pure function; "named" means by student name, "totals" means class totals of 10 or more through `classTotal`; any target who is withdrawn, removed, erased or not through consent is "none" for everyone but themselves):

| Viewer | academic | mood, meals, habits, sleep, hour, modules | writing, desk |
|---|---|---|---|
| The student, of their own | full | full | full |
| Teacher of a currently assigned class | named | none | none |
| Institute admin, same institute | named | totals | none |
| DHI admin | none | none | none |
| Counselor | none | none | none |
| Parent (reserved for a later row) | named | summary only if `parentLevel` is `summary` | none |

**State transitions**: consent for a student, read on every call: `withdrawn` (either side's latest record is `withdrawn`) is checked first; otherwise `consentNeeded` (no `self` record in `HOUSE_ACCEPTED_VERSIONS`, or under 18 with no parent record in `HOUSE_PARENT_ACCEPTED_VERSIONS`); otherwise `ok`. An age correction to under 18 moves `ok` to `consentNeeded` until the parent record exists. A member: active, removed (spec 0002), erased (a tombstone, final).

**API surface** (Convex functions; each starts with `requireMember`, or the lock tolerant twin `requireMemberAllowLocked` for exactly the functions in AC-6; errors use `fail(code)`, and refusals that count against a limit return `{ ok: false, code }`):

| Function | Kind | Key inputs | Key outputs | Who | Key errors |
|---|---|---|---|---|---|
| `members.me` | query | none | adds the states `consentNeeded { missing }` and `withdrawn { by }` to spec 0002's states | anyone signed in | none |
| `consent.notice` | query | none | the current house notice version, its lines and fingerprint | a student | none |
| `consent.state` | query | none | what is missing, who withdrew | a student | none |
| `consent.agree` | mutation | `version`, `hash` | `{ ok }` or `{ ok: false, code }` | a student | `consent_text_changed`, `rate_limited` |
| `consent.withdraw`, `consent.restore` | mutation | none | `{ ok }` or `{ ok: false, code }` | a student, for their own side | `not_withdrawn_by_you`, `rate_limited` |
| `consent.parentList` | query, paginated (25) | `classId` (opt), status filter | under 18 students of the institute with `needed`, `onFile` or `schoolWithdrew` | institute admin | `forbidden`, `institute_suspended` |
| `consent.recordParent` | mutation | `memberIds` (up to 50) or `classId` and a cursor | `{ recorded, skipped: [{ memberId, reason }] }`, or one error for a single student | institute admin | `forbidden`, `not_under18`, `not_found`, `institute_suspended`, `rate_limited` |
| `consent.recordParentWithdrawn`, `consent.recordParentRestored` | mutation | `memberId` | `{ ok }` | institute admin | `forbidden`, `not_found` |
| `sharing.get`, `sharing.set` | query, mutation | `parentLevel` | the setting | a student, their own | none |
| `access.mine` | query, paginated (25) | none | role and India date of each view of me | a student | none |
| `dataRights.exportMine` | mutation or action | page cursor | the next page of the JSON file | a student | `rate_limited` |
| `dataRights.eraseMine` | mutation | `confirm: true` | `{ ok }` | a student | `erase_not_configured`, `erase_failed` |
| `dataRights.adminExport`, `dataRights.adminErase` | internal | Google `email`, `school`, `class`, `note` | counts only | the team from a terminal | `no_match`, `erase_not_configured` |
| `retention.sweep` | internal, daily | none | counts only | the schedule | none |
| `staffRead` (wrapper) | mutation builder | the reading function, `targetMemberId`, `kind` | the data, after `canView` and one `viewLog` row | teachers and institute admins | `forbidden` |
| `classTotal` (helper) | helper | `classId`, `kind`, a fixed period | a total or nothing under 10, and one access log row | institute admin | `forbidden` |

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Any gated call | Whether a student may enter | The student's `consentRecords` in creation order, `HOUSE_ACCEPTED_VERSIONS` and `HOUSE_PARENT_ACCEPTED_VERSIONS` in `consentText.ts`, `members.under18` (spec 0002, missing means under 18), and each side's latest withdrawal, read on every call |
| Agree | The text and fingerprint that count | `HOUSE_NOTICE_VERSION` and its lines in `consentText.ts`, stored in `consentTexts` on first use, hashed with the funnel's `consentHash` |
| Agree | `under18AtTime` | `members.under18` at that moment |
| Record parent | Which students | The caller's own institute (from `requireMember`), the ids or class passed, each re checked to be an under 18 student of that institute |
| Record parent | Who, when, wording | The caller's member id, the server clock, the current parent wording version |
| Withdraw, restore | The actor and side | The caller (self) or the institute admin (school), never an input |
| `canView` | Viewer, relation, kind, target consent | The caller's role and institute from `requireMember`, the teacher's current class assignments, the kind the reading function names, and the target's gate state |
| `classTotal` | The count behind a total | Distinct students of one current class who are active, through consent, not withdrawn, not erased, and have data of that kind in the period; the threshold 10 is a constant |
| `staffRead` | Viewer, role, student, institute, time | The caller's member context, the target's `members` row, the kind, the server clock |
| Access record | The date a student sees | The view's time as an India date (`dayRules`, spec 0004), no time of day |
| Sharing | `parentLevel` | The student's own call only; no row means `none` |
| Export, erase | What belongs to the student | The `memberId` of the caller plus each room's registered exporter and eraser |
| Team erase | Whose data, and the match | The student whose Google email, school (the institute's `nameKey`) and class (the class's "grade section") all match and whose flag says under 18, else `no_match` |
| 30 day block | The hash | HMAC of the trimmed lowercase email with the setting `ERASURE_HASH_SECRET` |
| Rate limits | The keys | The caller's member id for `consentAgree`, `consentWithdraw` and `dataExport`; the institute admin's member id for `parentRecord` |
| Sweep | The cut offs | 3 years for `viewLog`, 12 months from `members.removedAt` (spec 0002), `until` on blocks, and the institute's `status` for the suspended skip |

**Key invariants**:
- A student never reaches a room without a current agreement, a parent record if under 18, and no standing withdrawal. Re checked on every call, so a change takes effect on the next call.
- `consentRecords` and `viewLog` rows are never changed. `consentRecords` are never deleted by app code; `viewLog` rows are deleted only by the 3 year sweep.
- The school records a parent's consent only for its own under 18 students, and the record holds nothing about the parent.
- No function returns a kind of a student's data to a viewer that `canView` does not allow, and every staff read of personal data leaves a `viewLog` row through `staffRead`.
- No room content is ever returned to a DHI admin or a counselor, and a student who is withdrawn, removed or erased is invisible to staff and uncounted in totals.
- Only the student changes their own sharing setting.
- Once an erase starts, the member is locked and invisible at once, the erase always finishes, and the tombstone never holds a name or email.
- No personal data in any log line, receipt, access log row or view record.
- Tables and fields are added in one release and removed in a later one (the shared backend rule).

**Security model**: the browser is untrusted. Consent state comes from the server on every call. The student may read and change only their own consent, sharing setting and access record. An institute admin may record or withdraw a parent's consent only for under 18 students of their own institute, and not while it is suspended. Teachers, institute admins, DHI admins and counselors cannot read room content except as `canView` allows, and their reads of named student data are recorded through one wrapper. A removed, suspended or locked student can still export and erase (data rights). The team's commands run from a terminal and print counts only. Receipts are readable by internal code only. Compliance scope: personal data of children in India under the Digital Personal Data Protection Act, 2023 (consent, children's data and verifiable parental consent, correction and erasure). Whether a school recording the parent's consent satisfies verifiable parental consent is a legal question this spec does not settle, so no real student enters until that check is done. Access control changes and every staff view are audit logged, and that is not negotiable.

**Configuration required**:
- `ERASURE_HASH_SECRET`: keys the 30 day block's email hash (the same name the funnel's erase spec uses, so one secret can serve both). A different value on development and production, declared in `convex.config.ts`. Unset means erase refuses with `erase_not_configured`.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: a student joins, sees `consentNeeded`, agrees, and a room opens; an under 18 also waits for the school's record, which an institute admin makes, and then enters, verifies **AC-1**, **AC-2**, **AC-3**.
- Gate rules: withdrawn is answered before consent needed, a missing flag counts as under 18, a version dropped from the accepted set needs a fresh agreement, a wrong fingerprint is refused, verifies **AC-1**, **AC-2**.
- School record: an adult, another institute, a suspended institute, a DHI admin, a class of more than 50 and a repeat each answer the right skip or error, verifies **AC-3**, **AC-17**.
- Age flag: correcting to under 18 locks, to adult does not, a parent record survives a flip, a parent withdrawal stops binding at 18, verifies **AC-4**.
- Withdrawal: both sides in time order, a student cannot restore the school's side, every room refuses on the next call, verifies **AC-5**.
- Locked reach: exactly the listed functions work for a locked, removed or suspended student, and a scan finds no other user of the lock tolerant check, verifies **AC-6**.
- Access matrix: every viewer against every kind, including a withdrawn target and a class change, returns exactly the table, and a DHI admin and a counselor never get room content, verifies **AC-7**, **AC-8**, **AC-24**.
- Sharing: only the student changes it, default none, each change logged, verifies **AC-9**.
- Staff reads and totals: each staff read leaves one row per student and kind with ids and codes only, the roster does not, a scan finds every staff data read using the wrapper, totals under 10 return nothing and overlapping cuts are refused, the student sees role and India date only, verifies **AC-10**, **AC-11**, **AC-23**.
- Export and erase: an export holds the student's own data only and arrives in pages, an erase with more rows than one page finishes and leaves only the kept classes, the tombstone is locked at once, invites for the email are cleared, the team's facts must all match and an adult is `no_match`, the 30 day block holds with the neutral refusal then lifts, a sign in account with a funnel profile survives, verifies **AC-12**, **AC-13**, **AC-14**.
- Retention: the sweep deletes old view rows, erases a long removed member (staff included), spares a reinstated one and a suspended institute's members, and works in pages, verifies **AC-15**.
- Events: no function returns an event, verifies **AC-16**.
- Logs and words: a scan finds no personal data in logs and receipts, and the notice carries its draft mark, verifies **AC-18**, **AC-19**.
- Screens: the consent screen, Your data and the parent consent screen at four widths, with "I agree" locked until the end of the notice, verifies **AC-20**.
- Funnel and demo: the funnel suite passes unchanged and the demo seed still signs students in, verifies **AC-21**, **AC-22**.

## Build plan

Build approach: Tracer Bullet (from the house scope). The thin thread first: the gate with the student's own agreement end to end (table, notice, agree, the refusal in `requireMember`, the consent screen), then the school's parent record, then the rest one strand at a time. Everything runs on the development deployment with synthetic people only until the legal check and the owner's words are done.

1. [x] **The thread.** The `consentRecords` table, the draft house notice version with `HOUSE_NOTICE_VERSION` and the accepted sets, the new consent kinds, `consent.notice`, `consent.state` and `consent.agree`, the consent check inside `requireMember` with the new `members.me` states, and the consent screen on `/dashboard`. Satisfies **AC-1**, **AC-2**, **AC-18**, **AC-20**.
2. [x] **The school's record.** `consent.parentList`, `consent.recordParent`, the under 18 requirement in the gate, the age correction rules, the new access log codes, and the institute admin's parent consent screen. Satisfies **AC-3**, **AC-4**, **AC-17**, **AC-20**.
3. [x] **Withdrawal and Your data.** `consent.withdraw`, `consent.restore`, the school's withdrawal and restore, `requireMemberAllowLocked` and its scan, and the Your data page shell. Satisfies **AC-5**, **AC-6**, **AC-20**.
4. [x] **Who sees what.** The pure `canView` and its table, the code to room kind table, the `sharingSettings` table with `sharing.get` and `sharing.set`, the `viewLog` table, the `staffRead` wrapper, `classTotal`, `access.mine` and its screen. Satisfies **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**, **AC-16**, **AC-23**, **AC-24**.
5. [x] **Export, erase and the data map.** `dataRights.exportMine` in pages, `eraseMine` with the atomic tombstone and the paged erasers, the team's `adminExport` and `adminErase`, the receipts, the invite clearing and the 30 day block with its neutral refusal in invites and claim, the data map with its guard test, and the room registry. Satisfies **AC-12**, **AC-13**, **AC-14**, **AC-19**.
6. [x] **Retention and seeds.** `retention.sweep` in pages and its schedule, the demo seed's consent, and the rate limit buckets. Satisfies **AC-15**, **AC-17**, **AC-22**.
7. [x] **Proof.** The access matrix tests, the multi page erase test, the source scans (staff reads use the wrapper, the lock tolerant check, no personal data in logs, no event returned), a browser run of the whole flow, and the funnel suite unchanged. Satisfies **AC-6**, **AC-8**, **AC-16**, **AC-19**, **AC-21**.

## Consequences

**Positive**:
- No student can reach a room without recorded consent, and a child's entry needs a record that the school stands behind.
- One rule for who sees what, so every later room and the Brain follow the same wall instead of inventing their own, and a withdrawn student disappears from staff views at once.
- Every staff view is recorded and visible to the student as a role and a date, which builds trust and answers a complaint.
- A student can leave: withdraw, download, erase, and the erase scales as their data grows.

**Negative / tradeoffs**:
- The school's statement is not proof of a parent's consent. It may not meet the Act's rule for verifiable parental consent, which is why a legal check is owed and a stronger parent link may be needed later.
- Staff screens that show named student data are mutations, so they load on open or refresh and not live, and a retried call can write a second view row.
- Erase is invisible at once but finishes in the background, so there is a short window where rows still exist but nobody can see them.
- Every room row must register an eraser, an exporter and its kind codes, and every new house table must be added to the data map, or a test fails.
- A DHI admin cannot read a student's content even to help with support. Any support access is a later decision with its own rules.
- The notice and the parent wording are drafts, and the house stays on synthetic people until the owner approves the exact words and the legal check is done.
- Compliance scope: personal data of children in India. Access control changes and staff views are audit logged, which is not negotiable.

**Neutral**:
- Rooms and the Brain call `canView`, `staffRead` and `classTotal` wherever they show student data to anyone but the student.
- Spec 0002's follow up ("row 4 adds the consent reason to `requireMember`, decides erasure of `members` and `invites`") is settled here: a consent check in the gate, a tombstone for an erased member, invites cleared.
- Spec 0004's follow up ("row 4 decides who may read events and how they are erased") is settled here: nobody reads events, and export and erase are the only ways they leave.
- A parent viewer is a reserved place in the rule only; a parent report is a later feature.

## Follow-up

- [ ] Owner: approve the exact words of the house notice and the parent wording (both are drafts in `consentText.ts`), including where the data is stored (the production Convex region must be confirmed and named; Convex has no India region).
- [ ] Legal check before any real student enters: does a school recording a parent's consent on file meet verifiable parental consent under the Digital Personal Data Protection Act, 2023, and what retention periods apply (the 3 year view record, the 12 month leaver rule).
- [ ] The funnel's privacy page should gain a house section on export, erase, what stays and the access record (a funnel change, outside this spec).
- [ ] The funnel's erase (spec 0014, not built) must apply the same account deletion rule: delete the sign in account only when neither a funnel profile nor a live house membership remains.
- [ ] Each room row registers its eraser, exporter and kind codes, uses `canView`, `staffRead` and `classTotal` for anything it shows to someone other than the student, and adds its tables to the data map.
- [ ] A stronger parent confirmation (a link or code to the parent) can be added later as a new kind of consent record, and a parent report would use the reserved parent row of `canView`.
- [ ] House row 24 (the first class pilot) needs this row built, the words approved and the legal check done.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).
