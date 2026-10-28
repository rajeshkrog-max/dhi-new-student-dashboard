# 0021. The first class pilot

**Date**: 2026-10-22
**Status**: In Progress

## Summary

Before the whole institute enters, one real class goes first: a teacher, about 10 invited students, parent consent on file, and a way to stop the class's logins at once if something goes wrong. This spec builds the one thing code can do for scope row 24, the class login pause, and writes the checklist the owner and the school work through. Most of the pilot is not code: it needs a real class, real consent, and the owner's gates. Written after the build, from scope row 24 and the owner's answers.

## Requirements

**User stories**:
- As the owner, I want to stop the logins of one class in one tap, so that a problem found in the pilot cannot spread.
- As an institute admin, I want to resume the class when it is fixed, with every student's data exactly as it was.

**Acceptance criteria**:
- **AC-1**: An institute admin of the school, or a DHI admin, can pause the logins of a class. Every student of it is refused on the next call and shown the paused screen ("Your access is paused. Please ask your institute."). Other classes, and the class's teachers, are not affected.
- **AC-2**: Resuming brings the whole class back with everything they own untouched. Pausing or resuming twice changes nothing and writes one line of the access log, not two.
- **AC-3**: A paused student can still reach their own data: the download and the erase belong to them.
- **AC-4**: A teacher, a student and an admin of another school cannot pause or resume. The class list shows which classes are paused.
- **AC-5** (checklist, not code): the pilot does not start until every item in the checklist below is ticked by the person named.

## Decision

**Chosen option**: a `pausedAt` on the class, read by the one member gate (`requireMember`) on every call. Not a per student loop of `members.remove`, which would take hundreds of writes, lose which students were paused on purpose before, and be slow to undo.

**The staff review of the first two weeks of reports.** The Master Spec asks a teacher and a counselor to read the first two weeks of real reports for about 10 students. The house is built so that staff never see a student's room data or Brain report. **Owner answer (2026-10-22): each pilot student shows their own screen** in a supervised session: the student opens their Progress page, the reviewer reads it beside them with the student's agreement, and nothing is built, stored or shared. The reviewer first reads the made up reports (the `heavy` and `steady` scenarios, spec house/0020) on screen. This keeps the wall (`brain` is a private data kind) and needs no new data flow. The student can stop at any point, and a parent may sit in.

## Feature design

**Data**: `classes.pausedAt` (optional, a time). No new table. Access log codes `class.pause` and `class.resume`.

**Functions** (`classes.ts`):

| Function | Kind | Inputs | Output | Errors |
|---|---|---|---|---|
| `classes.pause` | mutation | class id | `{ paused: true }` | `forbidden` (any role but institute admin or DHI admin), `not_found` (a class of another school) |
| `classes.resume` | mutation | class id | `{ paused: false }` | the same |

**Where the pause bites**: `houseAuth.loadMember` refuses a student of a paused class with `removed` unless the call tolerates inactive members (the data rights functions), and `members.me` answers `removed` for them, so the dashboard shows the paused screen without any new screen. The staff Classes screen has "Pause logins" and "Resume logins" and a "Logins paused" chip.

**Key invariants**: the pause changes no row a student owns. It does not stop the rollup (a paused class's days are still worked out, and the data stays visible to the student after resume).

**Pause history** (owner answer, 2026-10-24): each pause is kept as a `classPauses` row with its start and end (`classes.pausedAt` stays the answer to "is it paused now"; a class paused before the history existed counts as paused from `pausedAt`). `pauseHistory.pausedWithin` answers "was it paused then".
- **Brain**: what a student did still counts on every day, including during a pause (an exam sitting that closes with answers, a blog approval, anything logged before the pause). A day the pause touched, even in part, gets no real zero (a habit open and not ticked, an hour open and not sat), before or after the resume. The first whole day after the resume gets its zeros as usual.
- **Exams**: a window is excused when the class was paused at the moment it ended, so a sweep that runs after the resume still excuses it. A window that ended before the pause began is a miss.

## The pilot checklist

Not code. Each item names who closes it. Updated 2026-10-28: the builder closed every item it can (marked done, with where it is proven); the rest only the owner, the school or counsel can close.

| # | Item | Who | State |
|---|---|---|---|
| 1 | Approve the consent notice and the parent wording (`HOUSE_WORDS_APPROVED`) and every room's drafted words (`docs/launch/OWNER-GATES.md`, the words export in `docs/launch/words/`) | Owner | open |
| 2 | The legal check on verifiable parental consent through the school's record (DPDP), the production Convex region in the notice, and the notice lines for the desk (and its outside model provider, which now also marks written practice answers), counseling and the study hour call (`docs/launch/legal-check.md`) | Owner and counsel | open |
| 3 | Production setup: `ERASURE_HASH_SECRET` set, the first DHI admin's `bootstrap:dhiAdmin` invite made, `TEST_SIGNIN_ENABLED` off | Owner (done on the owner's yes, 2026-10-27); the owner claims the DHI admin invite with subs.dhi@gmail.com | invite to claim |
| 4 | Read the sources of the Brain's patterns and confirm or remove each (`PATTERN_SOURCES_CONFIRMED`); decide whether the meals chain ever turns on | DHI team and owner | open |
| 5 | Choose one real class and its teacher; invite the teacher and about 10 students by Google email through the staff area | Institute admin | open (rehearsed on development: `pnpm pilot:setup` made Pilot School rykbtm, Class 10 P, an admin, a teacher and 10 made up students on 2026-10-28) |
| 6 | For each student under 18, record the parent's written consent on the school's side before the student can enter | Institute admin | open (rehearsed: 6 made up minors in the pilot setup, and `rehearsal:check`) |
| 7 | Run the checks: the backend suite, the copy tests, typecheck, lint, `build:all`, and the browser proofs (`enter`, `consent`, `platform`, `mood`, `habit`, `sleep`, `meals`, `exams`, `modules`, `hour`, `brain`, `parent`, `desk`, `topics`, `learn`, `staff`, `school`, `counsel`, `hourcall`, `rehearsal`), the responsive sweep and axe | Builder | done 2026-10-28 for the latest code (`docs/launch/PROGRESS.md`, phase 14); rerun before the real class |
| 8 | The production Convex deploy and `pnpm deploy:house`; a Cloudflare account that owns `dhirise` | Owner's yes, builder runs | done 2026-10-28 (backend from 7f66286, Worker 105370d9) |
| 9 | Practice the pause: pause the pilot class, see a student refused, resume, see them back | Institute admin and owner | rehearsed on development (pilot setup and `rehearsal:check`); the owner repeats it on production with the real class |
| 10 | Two weeks in: the supervised review sessions (above), with the fixes made before the second class | Teacher and a DHI staff member | open |
| 11 | The class enters; counseling is built (spec 0024) but opens only after its words and notice line, so until then the support message names the helpline only | Owner | open |
| 12 | Watch the deployment for the first two weeks with the list in `docs/launch/HARDENING.md` section 10 (errors, crons, the Brain's check, the desk's count, the teachers' written answer queue, the free plan's usage) | Owner, or the person they name | open |
| 13 | The free plan: the Convex CLI said on 2026-10-28 that the team is above the free plan limits. Look at the usage page (team subs-dhi) and decide between the paid plan and cutting use before real students | Owner | open |

## Build plan

1. [x] The class login pause on the server, with its tests (`classPause.test.ts`, 4). Satisfies **AC-1** to **AC-4**.
2. [x] The pause and resume buttons and chip on the staff Classes screen.
3. [ ] The checklist, item by item. Satisfies **AC-5**. Every builder item is done (2026-10-28); the open ones are the owner's, the school's and counsel's.

## Consequences

**Positive**: one tap stops a class and one tap brings it back; no data is touched.

**Negative / tradeoffs**: a paused student's open screens show the paused page at once (the member query is live), but a mutation already in flight finishes. The pause does not hide a paused class's data from its teachers, who may still mark papers.

## Follow-up

- [ ] The Master Spec's golden reports (three synthetic students with 60 days of events) wait for the teacher and parent views.
