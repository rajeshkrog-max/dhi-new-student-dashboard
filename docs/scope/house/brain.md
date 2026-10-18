# Scope: DHI student house, the Brain

The DHI Brain turns what a student logs in each room into patterns they can read, without a model writing anything. Rules are fixed, thresholds are written down, and every statement points to the exact days and rows behind it. It builds on the Master Spec's daily values and keeps your evidence chains on top (your call, 2026-10-18). The student view ships first; teacher and parent views come later. See [index.md](index.md).

Five signals feed it, mapped from your brief: meals (energy and steadiness), mood and habit ticks (state), study hour presence and peer seats (engagement), papers, modules and desk practice (work), and blog posts (expression). Counseling is the sixth signal in your brief but is deferred, so it stays dormant here.

The research links in your brief have not been checked. The pattern spec (row 18) must tie each pattern to a source the team has read, and a pattern without one does not ship.

## Slice 5: the Brain

### 17. Daily values from room events · needs a decision
Turns events into the numbers the Brain reads: one value per student, per measure, per day, kept as a top part and a bottom part so a week is never an average of percentages. A day with no log is never zero. Finished weeks are frozen, a formula change rebuilds from events, and a nightly check proves the totals match the events. It covers the measures behind the five signals first; the rest of the Master Spec's 51 metrics follow without a rebuild. (basis: the Master Spec pipeline, so opening a report is a read and not a calculation)
**Done when:** each measure has a hand made fixture week with its expected value, rerunning a day never counts twice, a not logged day stays not logged, the nightly check matches the events or alerts the team, and reading a day or a week needs no calculation.
- [ ] Design it (spec): `/architect daily values from room events`

### 18. Pattern engine and the first chain: low mood and missed habits · needs a decision
A fixed rules engine. A chain fires only when it appears in the student's own rows across 5 to 14 days, and every sentence names the days and rows that triggered it. The first chain is clustered low mood days with missed habits, then lower study or paper activity the next day, because it needs only data a student logs daily. Wording says "tends to" and never "causes", nothing ranks or labels a student, and a student can hide a pattern that does not feel true. Every pattern is tied to a checked research source, and every sentence exists in English and Hinglish before students see it.
**Done when:** the chain fires on a hand made fixture and stays silent on one that only just misses, its evidence lists the days and rows, the spec holds each threshold and its source, and the wording passes the copy rules.
- [ ] Design it (spec): `/architect pattern engine and the first chain`

### 19. Chains for study hours, meals and papers · needs a decision
Two more chains on the same engine. Supporting: regular study hour attendance with a held habit streak leads to higher paper window completion. Dragging: many packaged or fried meal days followed by fewer study hours or missed paper windows. The meal chain obeys a food guard: it never suggests that eating less, skipping a meal or fewer food groups goes with a better result.
**Done when:** both chains fire on fixtures and stay silent when one day short of the minimum, evidence rows are shown, supporting and dragging patterns stay separate, and no wording judges food.
- [ ] Design it (spec): `/architect chains for study hours, meals and papers`

### 20. Expression note and the support availability flag · needs a decision
Two light chains. When a student writes after a run of low mood days, the Brain notes that they expressed it, with no push to write more. When low mood repeats alongside a meal and habit drop, it shows that support is available. The counseling booking is not built here, so the flag points to a short message only until the counseling row exists.
**Done when:** the expression note appears after a low mood run followed by a post and never nudges, the support flag fires on its fixture and shows only to the student, and it creates no booking and no record visible to staff.
- [ ] Design it (spec): `/architect expression note and the support availability flag`

### 21. Growth lamps: Sadhana, Niyam, Viveka · needs a decision
Three growth lamps worked out only from the measured signals. What each lamp stands for and which signals feed it (for example practice and effort, rhythm and routine, reflection and judgement) is the decision. A lamp is a growth mark, never a rank, and never compared with another student.
**Done when:** each lamp is a stated formula over named signals with a fixture, the student view shows movement over 7 to 14 days in plain words, nothing compares two students, and the spec records every signal behind each lamp.
- [ ] Design it (spec): `/architect growth lamps`

### 22. Brain report for the student · needs a decision
One page: active supporting patterns with their evidence, active dragging patterns shown as a chain and not a label, 7 to 14 day movement, and the lamps. Actions point inside the existing rooms (log a plate, sit the hour, open the module). Teacher and parent views come later and read the same data.
**Done when:** the page loads from stored values only, every statement links to the days and rows behind it, no pattern, lamp or sentence ranks or labels a student, an empty state explains what to log, and each action opens the right room.
- [ ] Design it (spec): `/architect brain report for the student`

## Go live

### 24. First class pilot · needs a decision
One real invited class, with parent consent on file, before the whole institute. The quality checks that apply (fixtures, privacy tests, copy rules) run first. Then a teacher and a DHI staff member read the first 2 weeks of reports for about 10 students and flag anything wrong or hurtful. Counseling is not part of the pilot, so the support flag points to a message only. (basis: the Master Spec's staff review gate)
**Done when:** the checks pass, the staff review is done and its fixes are made, the pilot class has entered with consent, and logins for the class can be paused if something goes wrong.
- [ ] Design it (spec): `/architect first class pilot`
