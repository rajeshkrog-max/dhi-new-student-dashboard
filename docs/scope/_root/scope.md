# Scope: DHI, one app (repo wide: combine the funnel and the house)

DHI is one product for students in India, many of them under 18. The DhiRise student funnel is already live at dhirise.com/dhiinterviews and brings students in. The student house (the dashboard) is being built in this repo and is where they will live afterwards. This scope covers only the work that joins the two onto the same database, sign in, host and dependencies, while the live interviews keep working. Dashboard work runs beside this on the development deployment (see the [house scope](../house/index.md)) and stays off the live domain until after the cutover.

**Build approach:** Tracer Bullet (vertical slices, each built end to end through every layer, working). Prove one thin real thread on the shared platform first (sign in, save an answer, read it back). Spec 0001 keeps every student record where it is, so the funnel then moves across in one staged switch (the backend into a shared package, the funnel onto Workers at a staging address, then the live route), and each strand is verified on staging rather than rebuilt. (basis: tracer bullet practice; strangler fig, spec 0001)
**Workflow:** GA (after develop: `/check verify`, `/test`, a fresh model `/check review`, then `/document`). The project default level of rigor, chosen because this moves live sign in and the personal data of minors between systems. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less. (basis: your `AGENTS.md` rules on student data and the funnel's consent rules)
**Deadline:** the live funnel is to move onto the shared platform as soon as it is ready, before the Founding Circle Challenge ends on 2026-10-30 23:59 IST. (your call, 2026-10-17)

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

This file plans the repo wide work. The funnel's own detailed scope stays at `apps/joining/docs/scope/scope.md`; this one links to it and does not copy it. See [index.md](../index.md).

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Student funnel, live at dhirise.com | Existing | in-progress |
| B | Student house screens on demo data | Existing | existing |
| 1 | Funnel moved into this repo with its history | Foundation | done |
| 2 | One platform: database, sign in, host and dependencies | Foundation | done |
| 3 | Shared workspace and tooling | Foundation | in-progress |
| 4 | One account across both parts | Foundation | planned |
| 5 | Environments, secrets and alerts on the shared platform | Foundation | planned |
| 6 | Sign in, save an answer, read it back, on the shared platform | Slice 1 | planned |
| 7 | The full check and its saved result | Slice 2 | planned |
| 8 | Leads, feedback, consents and the Sheet copy | Slice 3 | planned |
| 9 | Reports, files, share links, team view and pictures | Slice 4 | planned |
| 10 | Founding Circle Challenge | Slice 5 | planned |
| 11 | Interviews keep working: checks before and after | Go live | planned |
| 12 | Live data copy, rehearsal and rollback | Go live | planned |
| 13 | Cutover before 2026-10-30 | Go live | planned |
| 14 | One set of project docs, old folder archived | Close out | planned |
| 15 | Staging address and deploy credentials | Foundation | planned |
| 16 | Backend and shared code moved into packages | Foundation | done |
| 17 | Funnel built as a Worker, served at the staging address | Foundation | planned |
| 18 | Production backend deployed from the new package | Go live | planned |

## Already built (for context)

### A. Student funnel, live at dhirise.com · in-progress
The self check, report, Founding Card, leads, report copies, team view and the Founding Circle Challenge. It is live and students use it today, and its own rows keep moving. code in `apps/joining/`, its scope in `apps/joining/docs/scope/scope.md`

### B. Student house screens on demo data · existing
All nine rooms (home, exams, meals, mood, habits, modules, blog, DHI desk, study hour) as screens, with local demo data for one seat. No real backend yet, and that stays true in this scope. code in `src/`, the backend brief in `BACKEND.md`

## Foundations

### 1. Funnel moved into this repo with its history · done
The funnel's code arrives here under `apps/joining/` together with its full commit history, so this repo is the one home. A copy of today's files is already here without history. The old folder keeps serving the live site until the cutover, so fixes made there meanwhile are brought across.
**Done when:** `apps/joining/` holds the funnel with its commit history intact, builds and passes its own tests from this repo, and nothing about the live site has changed.
- [x] Bring the history in and reconcile the copy: `/develop funnel moved into this repo` (basis: git-filter-repo can place a repo's history under a subdirectory)
code in `apps/joining/`, on branch `import/funnel-history` (not merged to `main`, not pushed)

### 2. One platform: database, sign in, host and dependencies · done
The one decision both parts depend on: a single database, a single sign in system, a single host and a shared set of dependencies. It has to weigh what is already live and what it costs to move it, and keep the funnel's public addresses under dhirise.com/dhiinterviews working.
**Done when:** a spec names the one database, the one sign in, the one host and the shared dependencies, shows how today's two systems reach it, and says what each dependent feature below must follow.
- [x] Design it (spec): `/architect one platform: database, sign in, host and dependencies`
Spec [0001](../../specs/_root/0001-one-platform/index.md) (an umbrella, with children 0002 to 0005), accepted 2026-10-18. A decision only spec: the steps that carry it out are rows 1, 3, 6, 11 to 13 and 15 to 18, and rows 4 and 7 to 10 verify the result.

### 3. Shared workspace and tooling · in-progress
One way to install, build, test, lint and format both parts, without one part's rules reaching into the other. Today root `lint` and `format` also reach `apps/joining/`.
**Done when:** one command set runs per part from a clear place, install and build work for both, lint and format cannot rewrite the other part, and a spec records the choice.
- [x] Design it (spec): `/architect shared workspace and tooling`
- [x] Build it: `/develop shared workspace and tooling`
   - [x] Workspace skeleton: one lockfile, both parts start, pins and release age rule (AC-1, AC-2, AC-7, AC-8)
   - [x] Root commands and tests that pass on a clean checkout (AC-3, AC-4, AC-11)
   - [x] Lint and format scoped to the house only (AC-5)
   - [x] Shared version list and its check (AC-6, AC-10)
   - [x] CI workflow and the sandbox startup script (AC-9, AC-12)
- [ ] Verify it: `/check verify shared workspace and tooling`
- [ ] Test it: `/test shared workspace and tooling`
- [ ] Review it (fresh model): `/check review shared workspace and tooling`
- [ ] Document it: `/document shared workspace and tooling`
Spec [0006](../../specs/_root/0006-shared-workspace-and-tooling/index.md) · code in `pnpm-workspace.yaml`, `package.json`, `scripts/`, `.github/workflows/ci.yml`, `startup.sh` (branch `import/funnel-history`, pull request #1). Still open from the spec: the sandbox run of `startup.sh` (AC-12) and branch protection on `main`

### 16. Backend and shared code moved into packages · from spec 0001
Phase 1 of the move. The funnel's `convex/` folder becomes `packages/backend/` and its shared pure code (the scoring engine and the saved result code) becomes `packages/engine/`, so the funnel and the house both use one backend. Development deployment only, no live change, and the old `convex/` folder goes in the same change so nothing can push a stale tree to production. The house build (house row 2) cannot start until this exists, because its tables land in this package.
**Done when:** `packages/backend/` and `packages/engine/` exist with the funnel's tests passing unchanged, only the backend package runs `convex dev` and `convex deploy`, the funnel imports its generated API through a named package export, the funnel's engine scripts are served at the same public addresses, and nothing is deployed to production.
- [x] Build it: `/develop backend and shared code moved into packages`
Spec [0001](../../specs/_root/0001-one-platform/index.md) (migration plan phase 1) and its child [0002](../../specs/_root/0001-one-platform/0002-shared-database.md). Needs row 3 (done building) for the workspace. Built 2026-10-18 · code in `packages/backend/`, `packages/engine/`, `apps/joining/scripts/sync-engine.mjs` · one push to the development deployment done, nothing deployed to production · verify steps in [verify.md](../../specs/_root/0001-one-platform/verify.md)

### 5. Environments, secrets and alerts on the shared platform · needs a decision
Where each setting and secret lives per environment (development, preview, production), who can see them, and how errors are noticed, so the funnel's sign in, share link and report copy secrets move without being exposed.
**Done when:** every setting the funnel uses has one named home per environment, no secret is in the browser or in git, and an error in the shared platform reaches the team.
- [ ] Design it (spec): `/architect environments, secrets and alerts`

### 15. Staging address and deploy credentials · from spec 0001
A private staging address for the funnel and house builds, and the deploy credentials the move needs. `staging.dhirise.com` becomes a Worker custom domain for the staging environment. It is added to the Google OAuth client and the trusted origins list. A Cloudflare token limited to Workers scripts and zone routes, and a production Convex deploy key, are created with their own scopes and kept outside the repo.
**Done when:** `staging.dhirise.com` serves a test build of the funnel against the development deployment, real Google sign in works there, and both deploy credentials exist with narrow scopes and are not in the repo.
- [ ] Set it up: `/develop staging address and deploy credentials`

### 17. Funnel built as a Worker, served at the staging address · from spec 0001
Phase 2 of the move. The funnel is built as a Cloudflare Worker with static assets and the `/api/*` forwarders, with its headers and redirects carried over, and served at `staging.dhirise.com` against the development deployment. It opens with the spike from the spec: Worker routes beat the Pages custom domain, deleting the route restores Pages, `_headers` and `_redirects` work on assets, and `/page` and `/page.html` both resolve. The Pages project is not touched.
**Done when:** the spike's four answers are written down, the funnel runs as a Worker at the staging address with every public address under `/dhiinterviews` unchanged, real Google sign in works there, and the Pages deploy still works on its own as the fallback.
- [ ] Build it: `/develop funnel built as a Worker, served at the staging address`
Spec [0001](../../specs/_root/0001-one-platform/index.md) (phase 2) and its child [0004](../../specs/_root/0001-one-platform/0004-shared-host-and-routing.md). Needs rows 15 and 16.

## Slice 1: the thin thread (the walking skeleton)

### 6. Sign in, save an answer, read it back, on the shared platform
The thinnest real path: a test student signs in, answers one question, and reads it back, from the shared database, on a private preview address. Real sign in, real database, real page. No live student is touched. This is also where the house moves onto the shared platform (spec 0001 phase 3): it drops Postgres, PGLite and the Grok sign in broker, reads the shared session, and builds for Workers on the development deployment only. The same pass adds the trusted origins list to the sign in, adds the house's localhost and staging addresses to the Google client, and settles the TypeScript version.
**Done when:** on a private address a test student can sign in, save an answer and see it after a reload, from the shared database, the house signs in through the same session as the funnel with its own database and broker code gone, and the live site is unchanged.
- [ ] Build it: `/develop sign in, save an answer, read it back`
Spec [0001](../../specs/_root/0001-one-platform/index.md) (phase 3) with children [0003](../../specs/_root/0001-one-platform/0003-shared-sign-in.md) and [0005](../../specs/_root/0001-one-platform/0005-shared-dependencies.md). Needs row 16. The house's first build (house row 2) waits for this row.

### 4. One account across both parts
Spec 0003 and the house spec 0002 already settle the account: one sign in user per person, and the house's member record is keyed to that user. Nothing is left to decide here, and the consent and erasure side moved to house row 4. This row proves the result.
**Done when:** a student who signed in on the funnel and is then invited to the house arrives with the same account and no second sign in, the funnel student keeps their sign in and saved check, and no person ends up with two accounts.
- [ ] Verify it: `/check verify one account across both parts`
Needs row 6 and house row 2.

## Slice 2: the full check

### 7. The full check and its saved result
The 18 answers, finishing, the server side score, the saved result and its flags, on the shared platform. Scoring stays exactly as it is, and a saved result still never changes. The data layer is already Convex and nothing is rebuilt (spec 0001), so this row proves the strand on the staging address against the funnel's own specs.
**Done when:** a test student can finish all 18 questions and open the same result as on the live funnel, the scoring lock test passes, and flags are still returned only to their owner.
- [ ] Verify it: `/check verify the full check and its saved result`
Needs row 17.

## Slice 3: leads and consent

### 8. Leads, feedback, consents and the Sheet copy
The phone step, report feedback, the versioned consent texts and parent consent for students under 18, and the queue that copies leads and feedback to the team's Google Sheet. Nothing is rebuilt (spec 0001): this row proves the strand on the staging address.
**Done when:** a lead and a feedback note save with their consent record on the shared platform, they appear in the Sheet within the usual time, and no personal data is in any log.
- [ ] Verify it: `/check verify leads, feedback, consents and the Sheet copy`
Needs row 17.

## Slice 4: reports and the team

### 9. Reports, files, share links, team view and pictures
The saved report PDF copy and its files, the private report link, the team view, and the Google profile picture, all on the shared platform with the same rules for what a stranger or the team may see. Nothing is rebuilt (spec 0001): this row proves the strand on the staging address.
**Done when:** a report copy is made and downloaded, a private link opens for a stranger without flags or contact details and stops when switched off, the team view lists copies for named accounts only, and pictures show only through the one safe path.
- [ ] Verify it: `/check verify reports, files, share links, team view and pictures`
Needs row 17.

## Slice 5: the challenge

### 10. Founding Circle Challenge
Joining with parent consent (basis: verifiable parental consent for a child's data), referral codes and counting, the live leaderboard and its board job, and the winner review tools, on the shared platform. This is the part with a live ranking, so counts and ranks must be identical after the move. Nothing is rebuilt (spec 0001): this row proves the strand on the staging address. The funnel's own challenge rows keep moving in the funnel scope.
**Done when:** a test join and referral count and rank the same as on the live funnel, the board still freezes after the deadline, and the leaderboard row never carries an id, email, phone, age, flag or last name.
- [ ] Verify it: `/check verify Founding Circle Challenge`
Needs row 17.

## Go live

### 11. Interviews keep working: checks before and after
A written and automated guard that the live interviews behave the same: landing, sign in, the check, the report, the share link, the leaderboard and the team view, with every public address under dhirise.com/dhiinterviews unchanged.
**Done when:** the end to end tests for every funnel path pass against the shared platform and again against the live site right after the move, and the list of public addresses is unchanged.
- [ ] Build it: `/develop interviews keep working checks`

### 12. Production export, counts check and rollback rehearsal
Spec 0001 keeps every student, check, result, lead, consent and challenge row where it is, so there is no data copy and no decision left. What remains is a dated export of production taken before the switch and handled as the spec says (an encrypted disk, outside the repo, never opened in an AI session), a counts check that proves every table has the same row count before and after the switch, and one rehearsed rollback (delete the Worker route and traffic returns to Pages). (basis: parallel change, so old and new stay side by side until the new is proven; the funnel's rule that tables and fields are additive)
**Done when:** a script lists the row count of every table and the before and after counts match, an export of production exists and is stored as the spec says, and the rollback has been run once on staging.
- [ ] Build it: `/develop production export, counts check and rollback rehearsal`
Spec [0001](../../specs/_root/0001-one-platform/index.md) (cutover day controls). Needs row 17.

### 13. Cutover before 2026-10-30
Switch the live funnel to the shared platform on the same address, with the rollback ready, while the challenge is still running. The only live change is adding the Worker route for the funnel: the production backend is not redeployed that day, because the 5 minute board job is running. Target a weekday morning in IST on or before 2026-10-27, with no merges to the funnel or the backend from 24 hours before until 24 hours after. A synthetic check script (all eight forwarders, the referral header, the root redirect and a share page, never a real student) runs before and right after the switch, and the owner decides on rollback within 15 minutes. (basis: strangler fig, move the live thing across without a big bang)
**Done when:** live traffic is served from the shared platform at the same addresses, the synthetic check passes, the leaderboard and entry counts are unchanged across the move, and the rollback stays ready until the team calls the move stable.
- [ ] Build it: `/develop cutover`
Spec [0001](../../specs/_root/0001-one-platform/index.md) (phase 4 and the cutover day controls). Needs rows 11, 12 and 17.

### 18. Production backend deployed from the new package · from spec 0001
Phase 5 of the move. After the board freezes (after 2026-10-30 23:59 IST), the first production deploy of the backend comes from `packages/backend/`. It is a normal additive release with the deploy guard's fresh explicit consent.
**Done when:** the production backend is deployed from `packages/backend/` after the freeze, the funnel keeps working, and the old `convex/` path is gone from every deploy script.
- [ ] Build it: `/develop production backend deployed from the new package`
Spec [0001](../../specs/_root/0001-one-platform/index.md) (phase 5). Not before 2026-10-31.

## Close out

### 14. One set of project docs, old folder archived
After the move is stable, the funnel's docs, specs and scope are linked from one place, `AGENTS.md` files are brought in line, and the old `Joining url` folder and its old deployments are archived or retired according to the data retention rules.
**Done when:** this repo's docs describe one app, nothing still points at the old folder, and old deployments are switched off only after their data is confirmed moved.
- [ ] Do it: `/sync`

## Deferred

Out of scope for this pass. The dashboard work is planned in the house scope and builds on the shared platform.

- **Student house backend (Master Spec phases 0 to 6)**: now planned in the [house scope](../house/index.md) (rows 2 to 24: logins, consent, room events, daily values, the Brain and the student report). Still deferred: parent and school reports, care rules, counseling and the 21 day trial · needs a decision · GA
- **DHI desk build (steps D1 to D6)**: knowledge map, library, gateway and cache, question bank, learning modes, uploads · needs a decision
- **Other houses**: teacher, institute admin, counselor and DHI master admin · needs a decision
- **Browser tests and the auth check in CI**: needs a development deployment and scoped secrets · from spec 0006
- **Move the house into `apps/house`**: once the dashboard build starts · from spec 0006
- **Convex Pro plan for scheduled backups**: take it before the first institute's real data arrives · from spec 0001
- **Convex region and the privacy notice**: confirm the production region and plan, and write the region into the privacy notice (funnel spec 0021 and the privacy page). Convex has no India region, so students' data may live outside India · needs a decision · from spec 0001
- **Format the whole house once**: 53 house files are not Prettier formatted today, left out of spec 0006 on purpose · from spec 0006
- **Eight house tests that guard sandbox only files**: rewrite or remove them, since they skip on a clean checkout · from spec 0006
- **Open decisions already named in the Master Spec**: parent sharing default, trial start date, who tags questions, calories for under 18s, counseling record

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

**Feature lifecycle**: the scope updates as a feature moves; each row is what it shows and who sets it:

| State | Set by | The feature shows |
|---|---|---|
| `planned` · needs a decision | `/scope` | one box: `Design it (spec): /architect <feature>` |
| `in-progress` (designed) | **`/architect` at spec capture** | `Design it` ticked; spec linked; `Build it: /develop <feature>` + 2 to 5 milestones; the tier's closing boxes (`Verify it`, `Test it`, `Review it`, `Document it`) |
| `in-progress` (building) | `/develop` | milestone sub boxes tick one by one; code pointer filled |
| `in-progress` (verified) | `/check verify` | `Build it` and milestones ticked; `Verify it` ticked |
| `done` | **you, when you decide it is**; `/sync` reconciles | boxes you ran ticked, skipped ones marked skipped |

- **Next step** = the first unticked box (always a command or a tracked milestone).
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`. The tag drops once the spec is captured.
- **Status** `planned`, `in-progress`, `done`, plus `existing` (before the workflow) and `dropped` (de scoped, kept for history).
- **Workflow** (header line) is the project default, what runs after `/develop`: GA = `/check verify`, `/test`, a fresh model `/check review`, then `/document`.
- **Pointer line** (`spec <n> · code in <path>`): the spec link added by `/architect`, the code path by `/develop`.

## References

**Project sources**
- `AGENTS.md` (root) and `apps/joining/AGENTS.md`: the two stacks, the rules on student data, and the funnel's consent rules
- `apps/joining/docs/scope/scope.md` and `apps/joining/docs/specs/` (especially 0014 data export and erasure, 0015 live challenge, 0023 data model map): what is already built and how its data is kept
- `docs/DHI Master Spec - Metrics Storage Insights and Build Roadmap v1.pdf` and `docs/DHI Desk Design v1.pdf`: the dashboard work that is deferred here
- `BACKEND.md` (root): the house's backend brief

**Practices and standards**
- Tracer bullets: build one thin working path through every layer first
- Strangler fig: move a live system piece by piece while it keeps serving
- Parallel change (expand, migrate, contract): change data and interfaces without breaking live users
- Verifiable parental consent before processing a child's personal data

**Links** (each page was fetched and checked)
- [Strangler Fig Application, Martin Fowler](https://martinfowler.com/bliki/StranglerFigApplication.html): gradual replacement of a live system, new pieces beside the old
- [Parallel Change, Martin Fowler](https://martinfowler.com/bliki/ParallelChange.html): expand, migrate and contract phases
- [Tracer bullets, a summary of The Pragmatic Programmer](https://www.barbarianmeetscoding.com/notes/books/pragmatic-programmer/tracer-bullets/): a secondary summary, not the book itself
- [git-filter-repo](https://github.com/newren/git-filter-repo) and its [manual page](https://manpages.ubuntu.com/manpages/jammy/man1/git-filter-repo.1.html): moving a repo's history under a subdirectory
- [Digital Personal Data Protection Act, 2023, section 9 (children)](https://indiankanoon.org/doc/98869575/): an unofficial mirror of the text. The official PDFs on meity.gov.in and egazette.gov.in could not be fetched, so check the official text and whether the Act is in force before relying on it
