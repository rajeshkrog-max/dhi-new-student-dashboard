# DHI build order: every feature, in the order to run them

Written 2026-10-18 from all the project documents: the three scopes (`docs/scope/_root`, `docs/scope/house`, `apps/joining/docs/scope`), the specs, `BACKEND.md`, the Master Spec, the Growth Report and the Desk Design. This file is a reading aid. The scope files stay the source of truth, so when a row changes, run a bare `/scope` and update this list from it.

## How to run one feature

Every feature name below is written exactly as it appears in its scope row, so you can paste it after the command.

| Step | Command | When |
|---|---|---|
| 1. Design | `/architect <feature>` | Only when the row says "needs a decision". Rows without that tag go straight to step 2. |
| 2. Build | `/develop <feature>` | Always. Run `/clear` first so it starts fresh and reads the spec from disk. |
| 3. Verify | `/check verify <feature>` | Drives the real app against the spec. This is your first real test. |
| 4. Test | `/test <feature>` | Writes the automated tests. |
| 5. Review | `/check review <feature>` | A fresh model reads the code. GA rows only. |
| 6. Document | `/document <feature>` | GA rows only. |
| 7. Tidy | `/sync` | Once at the end of a feature, or around a merge. |

Tiers: the repo wide and funnel scopes and the house scope are all **GA** by default (steps 1 to 6). Rows tagged `Alpha` stop after Verify, and `Beta` rows stop after Test. After a few rows, run a bare `/scope` to reconcile.

**How to test a house row:** run it on the development deployment with synthetic people only (see house spec 0002). Do not load real students before house row 4 (consent) exists.

## Start here: the first ten steps

| # | Do this | Why now |
|---|---|---|
| 1 | Done: spec 0001 (one platform) and its children are accepted | 2026-10-18. |
| 2 | Done: `/develop shared workspace and tooling` | Platform row 3. The build is finished. `/check verify` is the optional next box, and the sandbox run and branch protection are still open. |
| 3 | Done: `/scope` | Reconciled on 2026-10-18. It added repo wide rows 16 to 18 and turned rows 4 and 7 to 10 into verification rows. |
| 4 | `/develop backend and shared code moved into packages` | Repo wide row 16. The house tables land in `packages/backend`, so nothing in the house can start before it. |
| 5 | `/develop sign in, save an answer, read it back` | Repo wide row 6. It also moves the house onto the shared sign in, which the join page of house row 2 reads. |
| 6 | `/develop people, roles, invites and institutes` | House row 2. Already designed (spec 0002), so this is the first house build. |
| 7 | `/check verify people, roles, invites and institutes` | Your first test of real logins. |
| 8 | `/architect room event log and day rules` and `/architect consent, privacy and access record for minors' house data` | House rows 3 and 4. Two separate sessions. Every room writes through row 3, and no real student may be loaded before row 4. |
| 9 | `/architect mood room, real, with the Vedic lens`, then `/develop` the same | House row 5, the first room, which proves the whole thread. |
| 10 | In parallel, in its own session: `/develop staging address and deploy credentials`, then `/develop funnel built as a Worker, served at the staging address` | Repo wide rows 15 and 17. The cutover target is 2026-10-27, so this is the critical path. The funnel's own challenge rows (`/develop live referral codes and tracking` and the rest of Track C) share the 2026-10-30 deadline. |

The funnel challenge ends **2026-10-30 23:59 IST**. The funnel cutover onto the shared platform targets **on or before 2026-10-27** (spec 0001), with no merges for 24 hours either side. The production backend deploys only after the board freezes. House work runs on the development deployment in the meantime.

## Track A: the house (the dashboard on real data)

Scope: `docs/scope/house/index.md`. All rows are on the development deployment first. Rows are in build order within each phase.

### Platform and safety

| # | Feature | Status | Next command |
|---|---|---|---|
| 2 | People, roles, invites and institutes | designed (spec 0002) | `/develop people, roles, invites and institutes` (after repo wide rows 16 and 6, see Track B) |
| 3 | Room event log and day rules | planned, needs a decision | `/architect room event log and day rules` |
| 4 | Consent, privacy and access record for minors' house data | planned, needs a decision | `/architect consent, privacy and access record for minors' house data` |

### Slice 1 and 2: responsive, then the thin thread

| # | Feature | Status | Next command |
|---|---|---|---|
| 1 | Make the app responsive | built and verified (Alpha) | Done under Alpha. Nothing to run. |
| 5 | Mood room, real, with the Vedic lens | planned, needs a decision | `/architect mood room, real, with the Vedic lens` |

### Slice 3: body and routine rooms

| # | Feature | Status | Next command |
|---|---|---|---|
| 6 | Habits room, real | planned | `/develop habits room, real` |
| 7 | Sleep log | planned, needs a decision | `/architect sleep log` |
| 8 | Food table and the Indian plate catalog | planned, needs a decision | `/architect food table and the Indian plate catalog` |
| 9 | Meals room, real | planned | `/develop meals room, real` (after 3 and 8) |

### Slice 4: study and work rooms

| # | Feature | Status | Next command |
|---|---|---|---|
| 10 | Papers: teachers build, send and mark | planned, needs a decision | `/architect papers: teachers build, send and mark` |
| 11 | Exams room, real | planned, needs a decision | `/architect exams room, real` (after 10) |
| 12 | Modules: DHI uploads, students watch and keep | planned, needs a decision | `/architect modules: DHI uploads, students watch and keep` |
| 13 | Blog room, real, with teacher review | planned, needs a decision | `/architect blog room, real, with teacher review` |
| 14 | Study hour: admin clock, live seats and chat | planned, needs a decision | `/architect study hour: admin clock, live seats and chat` |
| 15 | DHI desk: real model, coins and answer cache | planned, needs a decision | `/architect DHI desk: real model, coins and answer cache` |
| 16 | After session feeling card | planned | `/develop after session feeling card` (after 14 and 15) |

Row 15 chooses which of the Desk Design steps fit this slice: D1 map and library, D2 gateway and asset store, D3 question bank and practice, D4 learning modes, D5 mastery and written marking, D6 uploads and pre generation. The rest are listed under "Later" below.

### Slice 5: the Brain

| # | Feature | Status | Next command |
|---|---|---|---|
| 17 | Daily values from room events | planned, needs a decision | `/architect daily values from room events` |
| 18 | Pattern engine and the first chain: low mood and missed habits | planned, needs a decision | `/architect pattern engine and the first chain` |
| 19 | Chains for study hours, meals and papers | planned, needs a decision | `/architect chains for study hours, meals and papers` |
| 20 | Expression note and the support availability flag | planned, needs a decision | `/architect expression note and the support availability flag` |
| 21 | Growth lamps: Sadhana, Niyam, Viveka | planned, needs a decision | `/architect growth lamps` |
| 22 | Brain report for the student | planned, needs a decision | `/architect brain report for the student` |

### Slice 6 and Go live

| # | Feature | Status | Next command |
|---|---|---|---|
| 23 | Home and DHI score, real | planned, needs a decision | `/architect home and DHI score, real` |
| 24 | First class pilot | planned, needs a decision | `/architect first class pilot` |

## Track B: the platform move (funnel onto the shared platform)

Scope: `docs/scope/_root/scope.md`, decided in spec 0001 and its children. Strangler plan: the old setup stays ready to switch back to until the new one is proven. Spec 0001 was accepted on 2026-10-18 and `/scope` was run. The data stays where it is, so rows 4 and 7 to 10 became verification rows (`/check verify`, on the staging address), and row 12 lost its decision. Rows 16 to 18 are the migration phases that had no row. Rows are listed in build order.

| # | Feature | Status | Next command |
|---|---|---|---|
| 1 | Funnel moved into this repo with its history | done | Nothing to run. |
| 2 | One platform: database, sign in, host and dependencies | done (spec 0001 accepted) | Nothing to run. |
| 3 | Shared workspace and tooling | built, verify open | `/check verify shared workspace and tooling` (optional), or mark it done |
| 16 | Backend and shared code moved into packages | planned | `/develop backend and shared code moved into packages` |
| 15 | Staging address and deploy credentials | planned | `/develop staging address and deploy credentials` |
| 5 | Environments, secrets and alerts on the shared platform | needs a decision | `/architect environments, secrets and alerts` |
| 17 | Funnel built as a Worker, served at the staging address | planned | `/develop funnel built as a Worker, served at the staging address` (after 15 and 16) |
| 6 | Sign in, save an answer, read it back, on the shared platform | planned | `/develop sign in, save an answer, read it back` (after 16) |
| 4 | One account across both parts | planned, verifies | `/check verify one account across both parts` (after 6 and house row 2) |
| 7 | The full check and its saved result | planned, verifies | `/check verify the full check and its saved result` (after 17) |
| 8 | Leads, feedback, consents and the Sheet copy | planned, verifies | `/check verify leads, feedback, consents and the Sheet copy` (after 17) |
| 9 | Reports, files, share links, team view and pictures | planned, verifies | `/check verify reports, files, share links, team view and pictures` (after 17) |
| 10 | Founding Circle Challenge | planned, verifies | `/check verify Founding Circle Challenge` (after 17) |
| 11 | Interviews keep working: checks before and after | planned | `/develop interviews keep working checks` |
| 12 | Production export, counts check and rollback rehearsal | planned | `/develop production export, counts check and rollback rehearsal` (after 17) |
| 13 | Cutover before 2026-10-30 | planned | `/develop cutover` (target on or before 2026-10-27, after 11, 12 and 17) |
| 18 | Production backend deployed from the new package | planned | `/develop production backend deployed from the new package` (not before 2026-10-31) |
| 14 | One set of project docs, old folder archived | planned | `/sync` |

## Track C: the funnel (DhiRise, live at dhirise.com/dhiinterviews)

Scope: `apps/joining/docs/scope/scope.md`. Run these from `apps/joining/`. It is far along: of 35 rows, one is done and most of the rest are built and waiting on checks. The first unticked box of each row is the next command.

### Before the challenge ends (2026-10-30)

| # | Feature | Status | Next command |
|---|---|---|---|
| 10 | Live referral codes and tracking | built, checks open | `/check verify live referral codes and tracking` |
| 11 | Challenge join with parent consent | in progress | `/develop challenge join with parent consent` |
| 12 | Live leaderboard | built, checks open | `/check verify live leaderboard` |
| 15 | Data export and deletion | in progress | `/develop data export and deletion` |
| 26 | Ship what is built to production | Alpha | `/check verify ship what is built to production` |
| 18 | Privacy page and grievance contact | built on an assumed spec (0007) | `/architect privacy page and grievance contact` to ratify. You also owe a named grievance contact. |
| 13 | Winner review tools | built, needed after the deadline | `/check verify winner review tools` |

### Foundations and open checks

| # | Feature | Status | Next command |
|---|---|---|---|
| 1 | Stack & architecture | built and verified | `/test stack & architecture` |
| 2 | Data model | designed | `/develop data model` |
| 3 | Coding standards & tooling | planned | `/audit` |
| 4 | Real sign in and saved check | in progress | `/develop real sign in and saved check` |
| 5 | Leads and feedback saved | built and verified | `/test leads and feedback saved` |
| 6 | Results and report from saved data | done | Nothing to run. |
| 7 | Sheet copy | built | `/check verify sheet copy` |
| 9 | Error monitoring and alerts | designed | `/develop error monitoring and alerts` |
| 8 | Product analytics with consent | needs a decision | `/architect product analytics with consent` |
| 22 | Report copy saved when seen, with Download | built | `/check verify report copy saved when seen, with download` |
| 23 | Team link to the saved report | built, proof open | `/develop team link to the saved report` (the proof milestone), then `/check verify team link to the saved report` |
| 25 | Privacy notice names Cloudflare Browser Run | built and shipped | Close it with `/scope`. |
| 28 | Team list keeps its order when copies are replaced | designed | `/develop team list order and gate wording` |

### Polish, pages and quality

| # | Feature | Status | Next command |
|---|---|---|---|
| 19 | Live smoke test and fixes | Alpha | `/debug` |
| 20 | Site layout, root address and 404 | built | `/check verify site layout, root address and 404` |
| 21 | About page | Alpha | `/develop about page` (after 20) |
| 24 | Leaderboard on every screen size | Beta | `/develop leaderboard on every screen size` |
| 27 | Browser tests run clean | Alpha | `/debug browser tests that fail on a clean checkout` |
| 29 | Funnel screens use our own fonts | Alpha | `/develop funnel screens use our own fonts` (after 20) |
| 31 | Prize amount changed to up to ₹5,000 | Alpha, built | `/check verify prize amount up to 5000` |
| 32 | Share buttons that really send the report | Beta, built | `/check verify share buttons that send the report` |
| 30 | Google profile picture shown across the screens | GA, mostly built | `/develop google profile picture across the screens` (the open milestones), then verify |
| 33 | Faster images and a blur fade between them | Beta, designed | `/develop faster images and a blur fade between them` |
| 16 | Share previews and SEO | Beta | `/develop share previews and SEO` |
| 17 | Accessibility pass | Beta | `/develop accessibility pass` |

## Later: deferred on purpose

None of these has a scope row to run yet. Run `/scope <the feature>` to enroll one when you are ready.

**House (from the house scope and the Master Spec)**
- Counseling and calls: booking, the counselor roster and view, the care rules, the mood help button. Left out on purpose for now.
- Teacher and parent views of the Brain report, the weekly parent report, and the parent sharing switch.
- The school report, the academic support list and the teacher actions (CR1 to CR4).
- Study hour voice and video.
- The statistical connections (Master Spec pairs P1 to P6), which need 14 or more days in each group.
- The rest of the Master Spec's 51 metrics, the 21 day trial, the golden reports for parent and school.
- Desk Design steps not taken by house row 15.
- The full teacher, institute admin and DHI master houses.
- Sign in for students without a Google account. Moving a person between institutes. Linking a funnel profile to a house member.

**Platform**
- Browser tests and the auth check in CI. Moving the house into `apps/house`. The Convex Pro plan (scheduled backups) before the first institute's real data arrives.

## Decisions only you can make

| Decision | Where it came from | Blocks |
|---|---|---|
| Accept spec 0001 and its children | `docs/specs/_root/0001-one-platform` | House row 2 build and everything after it |
| Parent sharing default (the Master Spec recommends off) | Master Spec open decisions | House row 4 |
| Calories for under 18s (this plan stores nutrients but shows balance only) | Master Spec, house row 8 | House row 8 |
| Trial start date | Master Spec | Whether the fast track is needed |
| Who tags questions, DHI or the school's teachers | Master Spec | House rows 10, 11 and 15 |
| Counseling record: counselor note or short transcript | Master Spec | The deferred counseling work |
| Book rights, which boards, who reviews, which model providers, target price per student | Desk Design open decisions | House row 15 |
| Verify the research links and effect sizes in your Brain brief | Your Brain brief | House row 18 |
| A named grievance contact, the privacy words, the lawyer checks for under 18s | Funnel scope owner items | Funnel rows 18, 26, 30 and 32 |
| Convex region and plan, and whether to take the Pro plan | Spec 0001 | Before real institute data |

## Files this list came from

- Scopes: `docs/scope/index.md`, `docs/scope/house/` (index, platform, rooms, brain), `docs/scope/_root/scope.md`, `apps/joining/docs/scope/scope.md`
- Specs: `docs/specs/_root/0001-one-platform/`, `docs/specs/_root/0006-shared-workspace-and-tooling/`, `docs/specs/house/0001-make-app-responsive.md`, `docs/specs/house/0002-people-roles-invites-institutes/`, and the funnel's own specs in `apps/joining/docs/specs/`
- Briefs: `BACKEND.md`, `docs/DHI Master Spec - Metrics Storage Insights and Build Roadmap v1.pdf`, `docs/DHI Growth Report.pdf`, `docs/DHI Desk Design v1.pdf`
