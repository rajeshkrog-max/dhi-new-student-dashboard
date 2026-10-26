# Scope: DHI student house, the Brain

The DHI Brain turns what a student logs in each room into patterns they can read, without a model writing anything. Rules are fixed, thresholds are written down, and every statement points to the exact days and rows behind it. It builds on the Master Spec's daily values and keeps your evidence chains on top (your call, 2026-10-18). The student view ships first; teacher and parent views come later. See [index.md](index.md).

Five signals feed it, mapped from your brief: meals (energy and steadiness), mood and habit ticks (state), study hour presence and peer seats (engagement), papers, modules and desk practice (work), and blog posts (expression). Counseling is the sixth signal in your brief but is deferred, so it stays dormant here.

The research links in your brief have not been checked. The pattern spec (row 18) must tie each pattern to a source the team has read, and a pattern without one does not ship.

## Slice 5: the Brain

### 17. Daily values from room events · in-progress
Built (spec [0019](../../specs/house/0019-brain-daily-values.md)): 40 measures (version 3 added 20 on 2026-10-24: mood swing and mix, note days, the blog's length, range, structure, tags and comments, meal times, late night study, rooms used in a day) worked out from the events into one stored row for each student and day, a minute job, a morning job for the real zeros, a nightly check that counts mismatches, rebuild on a formula change, and export and erase. Covered by 20 tests. Open: the Master Spec's other measures wait for the rooms that capture them, and the golden reports wait for the teacher and parent views.
Turns events into the numbers the Brain reads: one value per student, per measure, per day, kept as a top part and a bottom part so a week is never an average of percentages. A day with no log is never zero. Finished weeks are frozen, a formula change rebuilds from events, and a nightly check proves the totals match the events. It covers the measures behind the five signals first; the rest of the Master Spec's 51 metrics follow without a rebuild. (basis: the Master Spec pipeline, so opening a report is a read and not a calculation)
**Done when:** each measure has a hand made fixture week with its expected value, rerunning a day never counts twice, a not logged day stays not logged, the nightly check matches the events or alerts the team, and reading a day or a week needs no calculation.
- [x] Design it (spec): `/architect daily values from room events`
- [x] Build it: `/develop daily values from room events`
- [x] Verify it: `/check verify daily values from room events` (2026-10-26: `brain:check` 8 of 8, `parent:check` 6 of 6)
- [x] Test it: `/test daily values from room events` (2026-10-26: `brainWall.test.ts`, `brainSittingDay.test.ts`)
- [x] Review it (fresh model): `/check review daily values from room events` (2026-10-26; review in `docs/reviews/2026-10-26-group-e-brain.md`)
- [ ] Document it: `/document daily values from room events`
Spec [0019](../../specs/house/0019-brain-daily-values.md) · code in `packages/backend/convex/{metricRules,brainDay,brainRollup,brainRoom,brainProof}.ts`, `packages/backend/convex/eventTypes/{exams,blog}.ts`. Reads the events of rows 3, 5, 6, 7, 9, 11, 12, 13, 14 and 16.

### 18. Pattern engine and the first chain: low mood and missed habits · in-progress
Built (spec [0020](../../specs/house/0020-brain-patterns-lamps-and-report/index.md)): the rules, the contrast test, the evidence and the hide, with a fixture that fires and near misses that stay silent. Open: the owner approves the words and the team confirms the sources.
A fixed rules engine. A chain fires only when it appears in the student's own rows across 5 to 14 days, and every sentence names the days and rows that triggered it. The first chain is clustered low mood days with missed habits, then lower study or paper activity the next day, because it needs only data a student logs daily. Wording says "tends to" and never "causes", nothing ranks or labels a student, and a student can hide a pattern that does not feel true. Every pattern is tied to a checked research source, and every sentence exists in English and Hinglish before students see it.
**Done when:** the chain fires on a hand made fixture and stays silent on one that only just misses, its evidence lists the days and rows, the spec holds each threshold and its source, and the wording passes the copy rules.
- [x] Design it (spec): `/architect pattern engine and the first chain`
- [x] Build it: `/develop pattern engine and the first chain`
- [x] Verify it: `/check verify pattern engine and the first chain` (2026-10-26: `brain:check` 8 of 8, `parent:check` 6 of 6)
- [x] Test it: `/test pattern engine and the first chain` (2026-10-26: `brainWall.test.ts`, `brainSittingDay.test.ts`)
- [x] Review it (fresh model): `/check review pattern engine and the first chain` (2026-10-26; review in `docs/reviews/2026-10-26-group-e-brain.md`)
- [ ] Document it: `/document pattern engine and the first chain`
Spec [0020](../../specs/house/0020-brain-patterns-lamps-and-report/index.md) · sources in `sources.md` there · code in `packages/backend/convex/{brainRules,brainCodes,brainFixtures}.ts`.

### 19. Chains for study hours, meals and papers · in-progress
Built: the supporting chain (a steady rhythm and papers sat) and the dragging meals chain with the food guard. The meals chain is switched off by the owner's answer (2026-10-22) because no source links packaged food to study time.
Two more chains on the same engine. Supporting: regular study hour attendance with a held habit streak leads to higher paper window completion. Dragging: many packaged or fried meal days followed by fewer study hours or missed paper windows. The meal chain obeys a food guard: it never suggests that eating less, skipping a meal or fewer food groups goes with a better result.
**Done when:** both chains fire on fixtures and stay silent when one day short of the minimum, evidence rows are shown, supporting and dragging patterns stay separate, and no wording judges food.
- [x] Design it (spec): `/architect chains for study hours, meals and papers`
- [x] Build it: `/develop chains for study hours, meals and papers`
- [x] Verify it: `/check verify chains for study hours, meals and papers` (2026-10-26: `brain:check` 8 of 8, `parent:check` 6 of 6)
- [x] Test it: `/test chains for study hours, meals and papers` (2026-10-26: `brainWall.test.ts`, `brainSittingDay.test.ts`)
- [x] Review it (fresh model): `/check review chains for study hours, meals and papers` (2026-10-26; review in `docs/reviews/2026-10-26-group-e-brain.md`)
- [ ] Document it: `/document chains for study hours, meals and papers`
Spec [0020](../../specs/house/0020-brain-patterns-lamps-and-report/index.md) · code in `packages/backend/convex/brainRules.ts`.

### 20. Expression note and the support availability flag · in-progress
Built: the expression note after a run of low mood days, and the support offer that names the Tele-MANAS helpline (14416, the owner's answer). It is worked out when the student looks, stored nowhere, and shown to nobody else.
Two light chains. When a student writes after a run of low mood days, the Brain notes that they expressed it, with no push to write more. When low mood repeats alongside a meal and habit drop, it shows that support is available. The counseling booking is not built here, so the flag points to a short message only until the counseling row exists.
**Done when:** the expression note appears after a low mood run followed by a post and never nudges, the support flag fires on its fixture and shows only to the student, and it creates no booking and no record visible to staff.
- [x] Design it (spec): `/architect expression note and the support availability flag`
- [x] Build it: `/develop expression note and the support availability flag`
- [x] Verify it: `/check verify expression note and the support availability flag` (2026-10-26: `brain:check` 8 of 8, `parent:check` 6 of 6)
- [x] Test it: `/test expression note and the support availability flag` (2026-10-26: `brainWall.test.ts`, `brainSittingDay.test.ts`)
- [x] Review it (fresh model): `/check review expression note and the support availability flag` (2026-10-26; review in `docs/reviews/2026-10-26-group-e-brain.md`)
- [ ] Document it: `/document expression note and the support availability flag`
Spec [0020](../../specs/house/0020-brain-patterns-lamps-and-report/index.md) · code in `packages/backend/convex/{brainRules,brain}.ts`, `src/lib/dhi/brain-words.ts`.

### 21. Growth lamps: Sadhana, Niyam, Viveka · in-progress
Built as one thing with the DHI score (row 23): each lamp is a stated formula over named daily values, with its movement over 14 days against the 14 before. Open: the owner confirms Viveka's four films in four weeks, which is the builder's default.
Three growth lamps worked out only from the measured signals. What each lamp stands for and which signals feed it (for example practice and effort, rhythm and routine, reflection and judgement) is the decision. A lamp is a growth mark, never a rank, and never compared with another student.
**Done when:** each lamp is a stated formula over named signals with a fixture, the student view shows movement over 7 to 14 days in plain words, nothing compares two students, and the spec records every signal behind each lamp.
- [x] Design it (spec): `/architect growth lamps`
- [x] Build it: `/develop growth lamps`
- [x] Verify it: `/check verify growth lamps` (2026-10-26: `brain:check` 8 of 8, `parent:check` 6 of 6)
- [x] Test it: `/test growth lamps` (2026-10-26: `brainWall.test.ts`, `brainSittingDay.test.ts`)
- [x] Review it (fresh model): `/check review growth lamps` (2026-10-26; review in `docs/reviews/2026-10-26-group-e-brain.md`)
- [ ] Document it: `/document growth lamps`
Spec [0020](../../specs/house/0020-brain-patterns-lamps-and-report/index.md) · code in `packages/backend/convex/{brainRules,home}.ts`.

### 22. Brain report for the student · in-progress
Built: the Progress tab with what DHI noticed (each statement with its days and a way into the room), the lamps and score, and what was logged lately, in English and Hinglish. Covered by 13 server tests, 8 copy tests and `pnpm brain:check` (8 of 8). The words are drafts.
One page: active supporting patterns with their evidence, active dragging patterns shown as a chain and not a label, 7 to 14 day movement, and the lamps. Actions point inside the existing rooms (log a plate, sit the hour, open the module). No teacher view exists and none is planned (the owner's answer, 2026-10-24). A parent sees a small weekly summary only when the student turns sharing on, through a private link the student makes: days logged in each room over the last 7 days and the three lamp values, built by `parentRules.weekOf` and never a mood value, note, pattern, movement or the support flag (spec [0022](../../specs/house/0022-parent-sharing-and-weekly-page.md)).
**Done when:** the page loads from stored values only, every statement links to the days and rows behind it, no pattern, lamp or sentence ranks or labels a student, an empty state explains what to log, and each action opens the right room.
- [x] Design it (spec): `/architect brain report for the student`
- [x] Build it: `/develop brain report for the student`
- [x] Verify it: `/check verify brain report for the student` (2026-10-26: `brain:check` 8 of 8, `parent:check` 6 of 6)
- [x] Test it: `/test brain report for the student` (2026-10-26: `brainWall.test.ts`, `brainSittingDay.test.ts`)
- [x] Review it (fresh model): `/check review brain report for the student` (2026-10-26; review in `docs/reviews/2026-10-26-group-e-brain.md`)
- [ ] Document it: `/document brain report for the student`
Spec [0020](../../specs/house/0020-brain-patterns-lamps-and-report/index.md) · code in `packages/backend/convex/brain.ts`, `src/components/dhi/brain/brain-report.tsx`, `src/lib/dhi/brain-words.ts`, `scripts/brain-check.mjs`.

## Go live

### 24. First class pilot · in-progress
Built: the class login pause and resume. The rest is the checklist in the spec, which needs the owner and a real class. The staff review of the first two weeks is done with each student showing their own screen (the owner's answer, 2026-10-22).
One real invited class, with parent consent on file, before the whole institute. The quality checks that apply (fixtures, privacy tests, copy rules) run first. Then a teacher and a DHI staff member read the first 2 weeks of reports for about 10 students and flag anything wrong or hurtful. Counseling is not part of the pilot, so the support flag points to a message only. (basis: the Master Spec's staff review gate)
**Done when:** the checks pass, the staff review is done and its fixes are made, the pilot class has entered with consent, and logins for the class can be paused if something goes wrong.
- [x] Design it (spec): `/architect first class pilot`
- [ ] Build it: `/develop first class pilot` (the pause is built; the checklist is the owner's)
- [ ] Verify it: `/check verify first class pilot`
- [ ] Test it: `/test first class pilot`
- [ ] Review it (fresh model): `/check review first class pilot`
- [ ] Document it: `/document first class pilot`
Spec [0021](../../specs/house/0021-first-class-pilot.md) · code in `packages/backend/convex/classes.ts`, `src/components/dhi/staff/classes-section.tsx`.
