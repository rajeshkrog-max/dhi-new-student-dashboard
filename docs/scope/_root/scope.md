# Scope: DHI, one app (repo wide: combine the funnel and the house)

DHI is one product for students in India, many of them under 18. The DhiRise student funnel is already live at dhirise.com/dhiinterviews and brings students in. The student house (the dashboard) is being built in this repo and is where they will live afterwards. This scope covers only the work that joins the two onto the same database, sign in, host and dependencies, while the live interviews keep working. Dashboard work is deferred until this is done.

**Build approach:** Tracer Bullet (vertical slices, each built end to end through every layer, working). Prove one thin real thread on the shared platform first (sign in, save an answer, read it back), then move one strand of the funnel across at a time. (basis: tracer bullet practice, the funnel was built the same way)
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
| 2 | One platform: database, sign in, host and dependencies | Foundation | in-progress |
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

### 2. One platform: database, sign in, host and dependencies · in-progress
The one decision both parts depend on: a single database, a single sign in system, a single host and a shared set of dependencies. It has to weigh what is already live and what it costs to move it, and keep the funnel's public addresses under dhirise.com/dhiinterviews working.
**Done when:** a spec names the one database, the one sign in, the one host and the shared dependencies, shows how today's two systems reach it, and says what each dependent feature below must follow.
- [x] Design it (spec): `/architect one platform: database, sign in, host and dependencies`
Spec [0001](../../specs/_root/0001-one-platform/index.md) (an umbrella, with children 0002 to 0005). A decision only spec: the steps that carry it out are rows 1, 3 to 6 and 11 to 15.

### 3. Shared workspace and tooling · in-progress
One way to install, build, test, lint and format both parts, without one part's rules reaching into the other. Today root `lint` and `format` also reach `apps/joining/`.
**Done when:** one command set runs per part from a clear place, install and build work for both, lint and format cannot rewrite the other part, and a spec records the choice.
- [x] Design it (spec): `/architect shared workspace and tooling`
- [ ] Build it: `/develop shared workspace and tooling`
   - [x] Workspace skeleton: one lockfile, both parts start, pins and release age rule (AC-1, AC-2, AC-7, AC-8)
   - [x] Root commands and tests that pass on a clean checkout (AC-3, AC-4, AC-11)
   - [x] Lint and format scoped to the house only (AC-5)
   - [x] Shared version list and its check (AC-6, AC-10)
   - [ ] CI workflow and the sandbox startup script (AC-9, AC-12)
- [ ] Verify it: `/check verify shared workspace and tooling`
- [ ] Test it: `/test shared workspace and tooling`
- [ ] Review it (fresh model): `/check review shared workspace and tooling`
- [ ] Document it: `/document shared workspace and tooling`
Spec [0006](../../specs/_root/0006-shared-workspace-and-tooling/index.md) · code in `pnpm-workspace.yaml`, `package.json`, `scripts/`, `.github/workflows/ci.yml`, `startup.sh` (branch `import/funnel-history`, uncommitted)

### 4. One account across both parts · needs a decision
A student who signs in on the funnel has one DHI account, and the house will reuse it later by invite. This row makes the account one record, with no second sign in and no change a student can see.
**Done when:** each person has one account across both parts, existing funnel students keep their sign in and saved check, and invite only entry for the house is left open for the dashboard work.
- [ ] Design it (spec): `/architect one account across both parts`

### 5. Environments, secrets and alerts on the shared platform · needs a decision
Where each setting and secret lives per environment (development, preview, production), who can see them, and how errors are noticed, so the funnel's sign in, share link and report copy secrets move without being exposed.
**Done when:** every setting the funnel uses has one named home per environment, no secret is in the browser or in git, and an error in the shared platform reaches the team.
- [ ] Design it (spec): `/architect environments, secrets and alerts`

### 15. Staging address and deploy credentials · from spec 0001
A private staging address for the funnel and house builds, and the deploy credentials the move needs. `staging.dhirise.com` becomes a Worker custom domain for the staging environment. It is added to the Google OAuth client and the trusted origins list. A Cloudflare token limited to Workers scripts and zone routes, and a production Convex deploy key, are created with their own scopes and kept outside the repo.
**Done when:** `staging.dhirise.com` serves a test build of the funnel against the development deployment, real Google sign in works there, and both deploy credentials exist with narrow scopes and are not in the repo.
- [ ] Set it up: `/develop staging address and deploy credentials`

## Slice 1: the thin thread (the walking skeleton)

### 6. Sign in, save an answer, read it back, on the shared platform
The thinnest real path: a test student signs in, answers one question, and reads it back, from the shared database, on a private preview address. Real sign in, real database, real page. No live student is touched.
**Done when:** on a private address a test student can sign in, save an answer and see it after a reload, from the shared database, and the live site is unchanged.
- [ ] Build it: `/develop sign in, save an answer, read it back`

## Slice 2: the full check

### 7. The full check and its saved result
The 18 answers, finishing, the server side score, the saved result and its flags, on the shared platform. Scoring stays exactly as it is, and a saved result still never changes.
**Done when:** a test student can finish all 18 questions and open the same result as on the live funnel, the scoring lock test passes, and flags are still returned only to their owner.
- [ ] Build it: `/develop the full check and its saved result`

## Slice 3: leads and consent

### 8. Leads, feedback, consents and the Sheet copy
The phone step, report feedback, the versioned consent texts and parent consent for students under 18, and the queue that copies leads and feedback to the team's Google Sheet.
**Done when:** a lead and a feedback note save with their consent record on the shared platform, they appear in the Sheet within the usual time, and no personal data is in any log.
- [ ] Build it: `/develop leads, feedback, consents and the Sheet copy`

## Slice 4: reports and the team

### 9. Reports, files, share links, team view and pictures
The saved report PDF copy and its files, the private report link, the team view, and the Google profile picture, all on the shared platform with the same rules for what a stranger or the team may see.
**Done when:** a report copy is made and downloaded, a private link opens for a stranger without flags or contact details and stops when switched off, the team view lists copies for named accounts only, and pictures show only through the one safe path.
- [ ] Build it: `/develop reports, files, share links, team view and pictures`

## Slice 5: the challenge

### 10. Founding Circle Challenge
Joining with parent consent (basis: verifiable parental consent for a child's data), referral codes and counting, the live leaderboard and its board job, and the winner review tools, on the shared platform. This is the part with a live ranking, so counts and ranks must be identical after the move.
**Done when:** a test join and referral count and rank the same as on the live funnel, the board still freezes after the deadline, and the leaderboard row never carries an id, email, phone, age, flag or last name.
- [ ] Build it: `/develop Founding Circle Challenge`

## Go live

### 11. Interviews keep working: checks before and after
A written and automated guard that the live interviews behave the same: landing, sign in, the check, the report, the share link, the leaderboard and the team view, with every public address under dhirise.com/dhiinterviews unchanged.
**Done when:** the end to end tests for every funnel path pass against the shared platform and again against the live site right after the move, and the list of public addresses is unchanged.
- [ ] Build it: `/develop interviews keep working checks`

### 12. Live data copy, rehearsal and rollback · needs a decision
How the live students, checks, results, leads, consents and challenge entries move to the shared database, in what order, what happens to writes during the move, how counts are proven equal, and how to go back. It is rehearsed on a copy first.
**Done when:** a spec records the move plan, a rehearsal on a copy matches every row count and a sample of rows, consents are carried across unchanged, and a rollback has been run once. (basis: parallel change, so old and new stay side by side until the new is proven; the funnel's rule that tables and fields are additive)
- [ ] Design it (spec): `/architect live data copy, rehearsal and rollback`

### 13. Cutover before 2026-10-30
Switch the live funnel to the shared platform on the same address, with the rollback ready, while the challenge is still running. (basis: strangler fig, move the live thing across without a big bang)
**Done when:** live traffic is served from the shared platform at the same addresses, the leaderboard and entry counts are unchanged across the move, and the rollback stays ready until the team calls the move stable.
- [ ] Build it: `/develop cutover`

## Close out

### 14. One set of project docs, old folder archived
After the move is stable, the funnel's docs, specs and scope are linked from one place, `AGENTS.md` files are brought in line, and the old `Joining url` folder and its old deployments are archived or retired according to the data retention rules.
**Done when:** this repo's docs describe one app, nothing still points at the old folder, and old deployments are switched off only after their data is confirmed moved.
- [ ] Do it: `/sync`

## Deferred

Out of scope for this pass. The dashboard work starts only after this scope is done, and it will build on the shared platform.

- **Student house backend (Master Spec phases 0 to 6)**: invite only login, consent scopes and tenancy, room events, the metric engine (51 metrics), insights, the student, parent and school reports, care rules, and the 21 day trial · needs a decision · GA
- **DHI desk build (steps D1 to D6)**: knowledge map, library, gateway and cache, question bank, learning modes, uploads · needs a decision
- **Other houses**: teacher, institute admin, counselor and DHI master admin · needs a decision
- **Browser tests and the auth check in CI**: needs a development deployment and scoped secrets · from spec 0006
- **Move the house into `apps/house`**: once the dashboard build starts · from spec 0006
- **Convex Pro plan for scheduled backups**: take it before the first institute's real data arrives · from spec 0001
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
