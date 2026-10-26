# Scope: DHI student house (the dashboard)

The student house is the dashboard where a student lives after the funnel brings them in: home, exams, meals, mood, habits, modules, blog, DHI desk, study hour, counseling and progress. It runs on local demo data for one seat today. This scope now covers two things: the screens themselves (responsive work, already under way) and the move of every room to real server data with real logins, plus the DHI Brain that finds patterns across the rooms. Counseling and calls are left out on purpose for now. The work that joins the house to the funnel's platform stays in [the repo wide scope](../_root/scope.md), and this scope builds on it.

**Build approach:** Tracer Bullet (vertical slices, each built end to end, working). Platform and login first, then one room end to end (Mood), then the other rooms one by one, then the Brain on top. For responsive work it meant one thin thread first, then the other rooms. (basis: tracer bullet practice, the same approach the repo wide scope uses)
**Workflow:** GA (after develop: `/check verify`, `/test`, a fresh model `/check review`, then `/document`). The project default level of rigor for the house, chosen because the backend holds mood, meal, sleep and writing data of students under 18. Row 1 keeps its own `Alpha` tag because it was built under the earlier default. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less. (your call, 2026-10-18)
**Start:** now, on the development deployment of the shared platform, beside the funnel move. No live student is touched and the house stays off the live domain until after the funnel cutover. (your call, 2026-10-18; spec 0001 phase 3)

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## Epics

| Epic | File | Rows | Rollup |
|---|---|---|---|
| Platform and safety | [platform.md](platform.md) | 2 to 4 | 0 of 3 done, 3 in progress (rows 2, 3 and 4, designed) |
| The rooms | [rooms.md](rooms.md) | A, 1, 5 to 16, 23, 25 | 4 of 15 done (rows 1, 5, 6, 25), 11 in progress (rows 7 to 16 and row 23, built or designed), 0 planned, plus 1 existing for context |
| The Brain | [brain.md](brain.md) | 17 to 22, 24 | 0 of 7 done, 7 in progress (rows 17 to 22 built, row 24 started) |

Row numbers run across all three files, so a row keeps one number wherever it lives.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Student house screens on demo data | Existing | existing |
| 1 | Make the app responsive | Slice 1 | done |
| 2 | People, roles, invites and institutes | Foundation | in-progress |
| 3 | Room event log and day rules | Foundation | in-progress |
| 4 | Consent, privacy and access record for minors' house data | Foundation | in-progress |
| 25 | One professional look for every page, the menu and loading screens | Look and feel | done |
| 5 | Mood room, real, with the Vedic lens | Slice 2 | done |
| 6 | Habits room, real | Slice 3 | done |
| 7 | Sleep log | Slice 3 | in-progress |
| 8 | Food table and the Indian plate catalog | Slice 3 | in-progress (built, catalog empty) |
| 9 | Meals room, real | Slice 3 | in-progress (built) |
| 10 | Papers: teachers build, send and mark | Slice 4 | in-progress (built) |
| 11 | Exams room, real | Slice 4 | in-progress (built) |
| 12 | Modules: DHI uploads, students watch and keep | Slice 4 | in-progress (built, stand-in host) |
| 13 | Blog room, real, with teacher review | Slice 4 | in-progress (built, with photo) |
| 14 | Study hour: admin clock, live seats and chat | Slice 4 | in-progress (built) |
| 15 | DHI desk: real model, coins and answer cache | Slice 4 | in-progress (built for chat and clarify) |
| 16 | After session feeling card | Slice 4 | in-progress |
| 17 | Daily values from room events | Slice 5 | in-progress (built) |
| 18 | Pattern engine and the first chain: low mood and missed habits | Slice 5 | in-progress (built) |
| 19 | Chains for study hours, meals and papers | Slice 5 | in-progress (built, meals chain off) |
| 20 | Expression note and the support availability flag | Slice 5 | in-progress (built) |
| 21 | Growth lamps: Sadhana, Niyam, Viveka | Slice 5 | in-progress (built) |
| 22 | Brain report for the student | Slice 5 | in-progress (built) |
| 23 | Home and DHI score, real | Slice 6 | in-progress (built) |
| 24 | First class pilot | Go live | in-progress (pause built, checklist open) |

Build order is the row order within each phase. Rows 2 to 4 come first, then row 25 (the look) so later rooms start on the finished look. Rows 6 to 16 can go in the order that suits you once row 5 has proven the thread, but 17 onward need the rooms they read.

## Deferred

Out of scope for this pass.

- **Counseling and calls**: booking a counselor, the counselor roster and view, the care rules, the mood help button's booking, and any calls. Left out on purpose; the counselor role and the dormant support flag (row 20) are placed so this can be added without a rebuild · needs a decision · GA (your call, 2026-10-18)
- **Teacher view of the Brain report**: closed. A parent's weekly page is built (spec [0022](../../specs/house/0022-parent-sharing-and-weekly-page.md), the owner's answers of 2026-10-24: off by default, days logged and the three lamp values, a private link the student shares; no email and no parent account). Class totals of Brain measures are closed (the owner's answer, 2026-10-24): the Brain stays the student's alone, `brain` stays a private kind and `classTotal` keeps serving only the wellbeing rooms
- **Study hour voice and video**: needs a decision
- **Sign in for students without a Google account**: spec 0003 says Google only, and an invite matches a Google email · needs a decision · from spec 0002
- **Move a person between institutes**: built for teachers and institute admins only (owner, 2026-10-24): `members.moveStaff`, DHI admin only, ends their class links and logs `member.move` for both institutes. A student is never moved: one who changes school is paused at the old school and invited as a new student at the new one with fresh consent, so a student's rows never cross institutes · from spec 0002
- **Link a funnel profile to a house member**: built (owner, 2026-10-26): the student's own tap on Your data (`funnelLink.link`) records the link by the same Google account; the download then holds their answers to the check. Link and download only: erasing in the house leaves the check, because the funnel never deletes results or consents, and the card says so · from spec 0002
- **Statistical connections (Master Spec pairs P1 to P6)**: four of six built (spec [0023](../../specs/house/0023-statistical-connections.md)): bedtime and papers, breakfast and focus, bedtime and mood, late study room and the next day's feeling. P4 and P6 wait for topic and subject tags
- **School report, academic support list and teacher actions (CR1 to CR4)**: needs a decision
- **Rest of the Master Spec's 51 metrics**: added without a rebuild after row 17
- **Parts of the Desk Design not taken by row 15**: knowledge map, question bank, learning modes and uploads, whichever the row 15 spec leaves out
- **Full teacher, institute admin and DHI master houses**: only the small staff screens inside rows 2, 10, 12, 14 and 15 are planned here
- **Open decisions already named in the Master Spec**: trial start date, who tags questions, counseling record. Parent sharing default is taken up by row 4 and calories by row 8

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`. Its wording varies (`Design it (spec)` normally), so skills locate it by that `(spec)` suffix, never by an exact label. Every other box is an execution box and `/architect` never ticks one.

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
- `AGENTS.md` (root) and `src/lib/dhi/AGENTS.md`: the rules on not labelling students and the demo stores that define the backend contract
- `BACKEND.md`: the tables, the room rules and the "Do not" list every room must keep
- `docs/DHI Master Spec - Metrics Storage Insights and Build Roadmap v1.pdf`: events, daily values, the metric catalog, insight rules, the copy rules and the quality checks
- `docs/DHI Growth Report.pdf` and `docs/DHI Desk Design v1.pdf`: what the reports and the desk should look like
- [Spec 0001, one platform](../../specs/_root/0001-one-platform/index.md) (status Accepted, 2026-10-18): the shared sign in, database and host this scope builds on
- Your research brief for the DHI Brain (pasted into the `/scope` request on 2026-10-18)

**Practices and standards**
- Tracer bullets: build one thin working path through every layer first
- Foundations before features: accounts, tenancy and the event log come before any room
- Event log as the source of truth: rebuild every number from events, so a changed formula never loses data
- Data minimisation and verifiable parental consent for students under 18
- Deterministic, cited rules: a pattern fires only from the student's own rows and names the rows behind it

**Needs a citation check.** The five research links in your brief (meals and performance, sleep and mood, peer study, expressive writing, practice and retrieval) and their effect sizes are not verified here. The pattern spec (row 18) must tie each pattern to a source the team has read.
