# Scope: DHI student house (the dashboard)

The student house is the dashboard where a student lives after the funnel brings them in: home, exams, meals, mood, habits, modules, blog, DHI desk, study hour, counseling and progress. It runs on local demo data for one seat today. This scope now covers two things: the screens themselves (responsive work, already under way) and the move of every room to real server data with real logins, plus the DHI Brain that finds patterns across the rooms. Counseling and calls are left out on purpose for now. The work that joins the house to the funnel's platform stays in [the repo wide scope](../_root/scope.md), and this scope builds on it.

**Build approach:** Tracer Bullet (vertical slices, each built end to end, working). Platform and login first, then one room end to end (Mood), then the other rooms one by one, then the Brain on top. For responsive work it meant one thin thread first, then the other rooms. (basis: tracer bullet practice, the same approach the repo wide scope uses)
**Workflow:** GA (after develop: `/check verify`, `/test`, a fresh model `/check review`, then `/document`). The project default level of rigor for the house, chosen because the backend holds mood, meal, sleep and writing data of students under 18. Row 1 keeps its own `Alpha` tag because it was built under the earlier default. `/architect` is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag (e.g. `· Beta`) to do more or less. (your call, 2026-10-18)
**Start:** now, on the development deployment of the shared platform, beside the funnel move. No live student is touched and the house stays off the live domain until after the funnel cutover. (your call, 2026-10-18; spec 0001 phase 3)

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## Epics

| Epic | File | Rows | Rollup |
|---|---|---|---|
| Platform and safety | [platform.md](platform.md) | 2 to 4 | 3 of 3 done in code (rows 2, 3, 4); rows 2 and 4 wait on the owner's words and legal check |
| The rooms | [rooms.md](rooms.md) | A, 1, 5 to 16, 23, 25, 27 | 16 of 16 done in code; 4 fully done (rows 1, 5, 6, 25); the rest wait only on owner gates (words, licences, accounts), plus 1 existing for context |
| The Brain | [brain.md](brain.md) | 17 to 22, 24, 26 | 7 of 8 done in code (rows 17 to 22, 26), waiting on owner gates; row 24, the pilot, has every builder item done and waits on the owner and a real class |

Row numbers run across all three files, so a row keeps one number wherever it lives.

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Student house screens on demo data | Existing | existing |
| 1 | Make the app responsive | Slice 1 | done |
| 2 | People, roles, invites and institutes | Foundation | done (code); waits on the owner: claim the DHI admin invite, the house notice words and the legal check |
| 3 | Room event log and day rules | Foundation | done |
| 4 | Consent, privacy and access record for minors' house data | Foundation | done (code); waits on the owner: the notice and parent wording (`HOUSE_WORDS_APPROVED`) and the legal check |
| 25 | One professional look for every page, the menu and loading screens | Look and feel | done |
| 5 | Mood room, real, with the Vedic lens | Slice 2 | done |
| 6 | Habits room, real | Slice 3 | done |
| 7 | Sleep log | Slice 3 | done (code); waits on the owner: the sleep words (`SLEEP_WORDS_APPROVED`) |
| 8 | Food table and the Indian plate catalog | Slice 3 | done (code); waits on the owner: the food catalog licences and the first import |
| 9 | Meals room, real | Slice 3 | done (code); waits on the owner: the meals wording check |
| 10 | Papers: teachers build, send and mark | Slice 4 | done (code); no owner gate (suggested marks stay held by the owner's answer) |
| 11 | Exams room, real | Slice 4 | done (code); no owner gate |
| 12 | Modules: DHI uploads, students watch and keep | Slice 4 | done (code); waits on the owner: a Cloudflare Stream account (a stand-in host until then) |
| 13 | Blog room, real, with teacher review | Slice 4 | done (code); waits on the owner: the final blog tag list |
| 14 | Study hour: admin clock, live seats and chat | Slice 4 | done (code); waits on the owner: confirm the 30 day chat keep and moderation without a record |
| 15 | DHI desk: real model, coins and answer cache | Slice 4 | done (code); waits on the owner: the desk words (`DESK_WORDS_APPROVED`), the notice line, and `DESK_LIVE` on production |
| 16 | After session feeling card | Slice 4 | done (code); no owner gate |
| 17 | Daily values from room events | Slice 5 | done (code); waits on the owner: the Brain words (`BRAIN_WORDS_APPROVED`) |
| 18 | Pattern engine and the first chain: low mood and missed habits | Slice 5 | done (code); waits on the owner: the pattern sources (`PATTERN_SOURCES_CONFIRMED`) and the Brain words |
| 19 | Chains for study hours, meals and papers | Slice 5 | done (code); waits on the owner: the pattern sources, and the meals chain stays off (`FOOD_PATTERN_ON`) |
| 20 | Expression note and the support availability flag | Slice 5 | done (code); waits on the owner: the Brain words |
| 21 | Growth lamps: Sadhana, Niyam, Viveka | Slice 5 | done (code); waits on the owner: Viveka's four films in four weeks, and the Brain words |
| 22 | Brain report for the student | Slice 5 | done (code); waits on the owner: the Brain words and the Hinglish read |
| 23 | Home and DHI score, real | Slice 6 | done (code); waits on the owner: the Brain words |
| 26 | The remaining Master Spec measures (19 more) | Slice 5 | done (code); waits on the owner: the Brain and habits words |
| 27 | The desk's learning loop: topic map, bank, Fix, Remember, Plan, written marking | Slice 4 | done (code); waits on the owner: the desk words; a book licence for the library and uploads (D1 ingestion, D6) |
| 24 | First class pilot | Go live | in-progress (every builder item done 2026-10-28; the open items are the owner's, the school's and counsel's: the words, the legal check, the real class and its consent, the review sessions, the free plan) |

Build order is the row order within each phase. Rows 2 to 4 come first, then row 25 (the look) so later rooms start on the finished look. Rows 6 to 16 can go in the order that suits you once row 5 has proven the thread, but 17 onward need the rooms they read.

## Deferred

Out of scope for this pass.

- **Counseling and calls**: built (spec [0024](../../specs/house/0024-counseling.md), the owner's answers of 2026-10-27): a student books a counselor's 30 minute slot with a note, both meet in a recorded and transcribed Stream call, the counselor writes the note after and may share the recording; the mood help button opens Counseling; the counselor roster is in spec 0026
- **Teacher view of the Brain report**: closed. A parent's weekly page is built (spec [0022](../../specs/house/0022-parent-sharing-and-weekly-page.md), the owner's answers of 2026-10-24: off by default, days logged and the three lamp values, a private link the student shares; no email and no parent account). Class totals of Brain measures are closed (the owner's answer, 2026-10-24): the Brain stays the student's alone, `brain` stays a private kind and `classTotal` keeps serving only the wellbeing rooms
- **Study hour voice and video**: built (spec [0027](../../specs/house/0027-study-hour-call.md), the owner's answers of 2026-10-28): camera and voice on Stream, recorded and kept 30 days, watched by that institute's teachers and a DHI admin, shared with a student on request
- **Sign in for students without a Google account**: closed. The owner chose on 2026-10-28 that sign in stays Google only (offered: an email one time code, a school join code with a password, an email link, an SMS code); spec 0003 stands · from spec 0002
- **Move a person between institutes**: built for teachers and institute admins only (owner, 2026-10-24): `members.moveStaff`, DHI admin only, ends their class links and logs `member.move` for both institutes. A student is never moved: one who changes school is paused at the old school and invited as a new student at the new one with fresh consent, so a student's rows never cross institutes · from spec 0002
- **Link a funnel profile to a house member**: built (owner, 2026-10-26): the student's own tap on Your data (`funnelLink.link`) records the link by the same Google account; the download then holds their answers to the check. Link and download only: erasing in the house leaves the check, because the funnel never deletes results or consents, and the card says so · from spec 0002
- **Statistical connections (Master Spec pairs P1 to P6)**: all six built (spec [0023](../../specs/house/0023-statistical-connections.md)): bedtime and papers, breakfast and focus, bedtime and mood, late study room and the next day's feeling; and with the topic and subject tags (spec [0028](../../specs/house/0028-topic-and-subject-tags.md), owner 2026-10-28: teachers tag papers, students tap on the cards) a desk sitting and the next paper on that topic, and a subject and how the sessions felt
- **School report, academic support list and teacher actions**: built (spec [0025](../../specs/house/0025-school-report.md), the owner's answers of 2026-10-27): papers only plus the existing room counts, a support list with paper reasons, the institute admin and the class's teachers, CR1 only (CR2 to CR4 read the Brain and stay out)
- **Rest of the Master Spec's 51 metrics**: built as row 26 (spec [0030](../../specs/house/0030-the-remaining-measures.md), 2026-10-28): every measure the house can feed, plain measures that feed no lamp (owner's choice). Not built: the insight rule library, the parent report beyond spec 0022, and the school cohort rules CR2 to CR4 (they read the Brain, closed by the owner)
- **Parts of the Desk Design not taken by row 15**: built as row 27 (spec [0031](../../specs/house/0031-desk-learning-loop.md), 2026-10-28): the topic map (topics only), the question bank, practice, Fix, Remember, Plan, Use it, search and written marking. Waiting on a book licence (owner, 2026-10-28): book ingestion and passages, prerequisite links, uploads and pre-generation (D1 ingestion, D6)
- **Full teacher, institute admin and DHI master houses**: built (spec [0026](../../specs/house/0026-staff-houses.md), the owner's choice of 2026-10-27): a Home of what waits for each role, a teacher's page per student, the DHI admin's overview and counselor roster
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
