# 0020. The Brain: patterns, notes, growth lamps and the student's report

**Date**: 2026-10-22
**Status**: In Progress

## Summary

One engine and one page for scope rows 18 to 22. The engine is a set of fixed rules over a student's own stored daily values (spec house/0019): two chains that came together in their last 14 days (one dragging, one supporting), a meals chain that is built and switched off, an expression note, a support offer, and three growth lamps with their movement. The page is the Progress tab: what DHI noticed, each statement with the days and what happened on each and a way into the room, the lamps, and what was logged lately. The server returns ids, counts and days; the sentences are fixed templates in English and Hinglish, drafts until the owner approves them. Nothing ranks or labels a student, compares two students, says why, or tells a student what to do. The student alone sees any of it.

Written after the build, from the scope rows, the Master Spec and the owner's answers, to record the choices made. Rows 18 to 22 each link here.

## Requirements

**User stories**:
- As a student, I want to see what came together in my own days, with the days named, so that I can judge for myself whether it is true.
- As a student, I want to say "this does not feel true" and not see it again for a while, so that DHI never insists.
- As a student who is having a hard week, I want to be told that support exists and where, without being labelled.
- As the owner, I want every pattern tied to a source, every sentence tested against the copy rules, and nothing shown to a real student until I approve the words.

**Acceptance criteria**:
- **AC-1** (row 18): The first chain, *heavy days, habits not ticked, a quieter next day*, fires only on its rule (below), lists the days and what happened on each, and stays silent on a fixture that only just misses it.
- **AC-2** (row 19): The supporting pattern, *a steady rhythm and papers sat*, fires only on its rule and is kept apart from the dragging ones.
- **AC-3** (row 19): The meals chain obeys the food guard: no supporting pattern reads a meal measure, a meal measure appears only as the packaged or fried share of a dragging pattern, and no wording judges food or tells anyone to eat differently. The chain is off until the owner turns it on.
- **AC-4** (row 20): After a run of at least 2 days in a row marked sad or heavy, a post published within 7 days is noted, with no push to write again.
- **AC-5** (row 20): When the last 7 days held 3 or more days marked sad or heavy, and the share of open habit days ticked and the days with a plate logged both fell against the week before, a support message names the Tele-MANAS helpline (14416). It is worked out when the student looks, is never stored, books nothing and is shown to nobody else.
- **AC-6** (row 21): Each growth lamp is a stated formula over named signals with a fixture. The page shows its movement over 14 days against the 14 before in plain words. Nothing compares two students.
- **AC-7** (row 22): The page loads from the student's stored daily values (with today worked out live). Every statement lists its days with a way into the room it came from. An empty state says how many days are needed and what to log. A student can hide a pattern or the expression note for 30 days and bring it back at once.
- **AC-8** (rows 20 and 22, privacy): Only a student reads the report or hides a pattern. A teacher, an institute admin, a DHI admin and a counselor are refused, a student who withdrew gets nothing, and looking at the report leaves no record anyone can see.
- **AC-9** (rows 18 to 22, words): Every sentence exists in English and Hinglish. The copy test holds both to the rules: no ranking word, no clinical word, no judging of food, no cause word, no order, no digit that is not a count, a date, the helpline or a fixed window. The words are drafts (`BRAIN_WORDS_APPROVED` is false) and the page says so.
- **AC-10** (rows 18 to 20, sources): Each pattern is tied to a source (`sources.md`). Until the DHI team confirms them (`PATTERN_SOURCES_CONFIRMED` is false) every hit carries a draft note, and the sources are indirect.

## Decision

**Chosen option**: fixed co-occurrence rules, each tested against the student's other days, over stored daily values. Not the Master Spec's statistical connections engine (a bootstrap interval and a Benjamini–Hochberg correction over fixed pairs), which needs 14 or more days in each group and rarely has the data inside a pilot; it stays in the deferred list. The chains here are a student's own days put side by side, and they say so ("In your own days, these tend to come together"), not a claim about students in general.

**The contrast rule.** A chain stands only if the days after its group of days were quiet clearly more often (30 points or more, with at least 3 expected days in each group) than the days after the student's other days. A student who is quiet every day does not trigger it. A quiet day is one where something was expected and did not happen: a study hour open and not sat, or a paper that closed without answers. A day with nothing expected is never quiet. Only finished days are read, so today never changes a chain.

**The rules** (every number is a named constant in `brainRules.ts`):

| Pattern | Kind | Fires when, in the last 14 finished days (at least 5 of them have something logged) |
|---|---|---|
| `mood_habits_quiet` | dragging | at least 3 days marked sad or heavy fall inside one 7 day span; on at least 2 of those days a habit was open and not ticked and the next day was quiet; and the next days after the low days were quiet 30 points or more oftener than after the other days |
| `steady_rhythm` | supporting | the study hour sat on at least 4 days and on 60 percent or more of the days one was open; a habit ticked on 70 percent or more of at least 8 days it was open; and every paper that closed in the last 28 days (at least 2) sat |
| `packaged_quiet` | dragging, **off** | at least 4 days had half or more of the tagged items packaged or fried (at least 2 tagged items); at least 2 of them were followed by a quiet day; and the contrast rule holds against the student's other meal days |
| expression note | note | a run of at least 2 days in a row marked sad or heavy, then a post published from that day up to 7 days after, no later than today |
| support offer | offer | in the last 7 days at least 3 days marked sad or heavy; a habit open on at least 5 days in each of the two weeks, with the share ticked down by 30 points or more; and days with a plate down by 2 or more from at least 3 the week before |

**The lamps** (each 0 to 1 over the student's last 28 days; the score is the mean of the lamps that have a value, times 100, as in spec house/0017):

| Lamp | Means | Signals (daily values) | Formula |
|---|---|---|---|
| Sadhana | effort and practice | A01 papers sat, H12 study room days | the mean of: papers sat ÷ papers closed, and days sat ÷ days a study hour was open |
| Niyam | rhythm and routine | H08 habit days | days with a tick ÷ days a habit was open |
| Viveka | reflection | A15 films kept | films kept ÷ 4 (four in four weeks fill it), and **no value** when none were kept |

An input with nothing to measure is left out, so a room never used never lowers a lamp. **Viveka is the builder's default, not an owner answer**: films are optional content, so films DHI added and a student has not watched must not lower the lamp or give a new student a score of 0; four in four weeks is the one number to change (`VIVEKA_FULL`). Mood and meal logs are presence only and are in no lamp. Movement compares the last 14 days with the 14 before, needs a value and at least 3 logged days in each half, and says **rising** or **dipping** only by a clear rise of 10 points, otherwise **steady**.

**The page**: the Progress tab. Order: the support message (if it applies), What DHI noticed (patterns and the expression note, or the empty state), the growth lamps and score, and what was logged in the last 14 days with a button into each room. English or Hinglish is chosen on the page and remembered on the device.

**Owner answers** (2026-10-22): the support message names Tele-MANAS, 14416; the meals chain stays off; the pilot review is done with each student showing their own screen (spec house/0021).

**Builder defaults the owner can change**: the thresholds above; Viveka's four films; a pattern or the expression note hides for 30 days (the Master Spec's number); the support message has no hide, because it is an offer and not a claim; the language choice lives on the device; the page is the Progress tab.

## Feature design

**Functions** (`brain.ts`, each starts with `requireMember` and a student check):

| Function | Kind | Inputs | Output | Errors |
|---|---|---|---|---|
| `brain.report` | query | none | today; days logged and days needed; coverage (days with a value for each room); score; lamps (value, movement, logged days, inputs); patterns that fired and are not hidden (id, kind, counts, evidence days with items and rooms); hidden ids; expression note; support offer; whether the sources are still drafts | `forbidden` for any role but student; the consent errors |
| `brain.hide` | mutation | `id` | `{ ok }` or `{ ok: false, code }` | returned: `bad_id`, `slow_down` (30 an hour) |
| `brain.show` | mutation | `id` | the same | the same |

The report holds **no sentence, no mood word, no habit title and no note**: ids, counts, days and the room each evidence item opens. A pattern is computed when the student looks and is not stored; `brainHides` holds only which pattern is hidden until when.

**The words** (`src/lib/dhi/brain-words.ts`): a template for each pattern, the expression note, the support message, each evidence item, each lamp and input, each movement, and the page's own lines, in English and Hinglish. `brain-words.test.ts` renders every string with sample counts and holds it to the copy rules, and checks that every code the server names (`brainCodes.ts`) has a line in both languages.

**The screen** (`src/components/dhi/brain/brain-report.tsx`): the Progress tab. A pattern shows its kind, title, sentence, a note that it is only about the student's own days, the days behind it (a list that opens, each day with what happened and a button into the room), and "This does not feel true". Hidden patterns are counted with a "Show again" button.

**Key invariants**: a hit names the days that triggered it. The food guard is a function with a test, and a supporting pattern cannot read a meal measure. The support message creates no row and no record. The Brain's files do not import the staff read, the access log or a view log.

## Build plan

1. [x] The pure rules and fixtures (`brainRules.ts`, `brainFixtures.ts`, `brainCodes.ts`, `brainRules.test.ts`, 27 tests). Satisfies **AC-1** to **AC-6**.
2. [x] The report and the hide (`brain.ts`, `brain.test.ts`, 13 tests) and the home score on the same lamps (`home.ts`). Satisfies **AC-7**, **AC-8**.
3. [x] The words and the copy test (`brain-words.ts`, 8 tests). Satisfies **AC-9**.
4. [x] The Progress screen and the browser proof (`pnpm brain:check`, 8 of 8). Satisfies **AC-7**.
5. [x] Sources written down, with their limits (`sources.md`). Satisfies **AC-10**.
6. [ ] Owner: approve the words, confirm the sources, decide the meals chain, and check the thresholds. See Follow-up.

## Consequences

**Positive**: a student sees their own days put side by side, with the days named and a way to say no. Nothing is stored about what was shown.

**Negative / tradeoffs**: with these thresholds a chain fires rarely, by design; a first class may see an empty page for weeks. The sources are indirect (below), so a hit is an observation about one student's days and never evidence of cause. The expression note waits for a teacher to approve the post, because the log records publication; a post written on Monday and approved on Thursday is noted on Thursday.

## Follow-up

- [ ] **Owner**: approve the English and Hinglish words and set `BRAIN_WORDS_APPROVED` to true (`brain-words.ts`).
- [ ] **Owner and DHI team**: read the sources in `sources.md` and set `PATTERN_SOURCES_CONFIRMED` to true (`brainRules.ts`), or ask for a pattern to be removed. Nothing in the sources links packaged food to study time.
- [ ] **Owner**: decide whether the meals chain ever turns on (`FOOD_PATTERN_ON`). Today it is off, and a test holds it off.
- [ ] **Owner**: confirm or change the thresholds, and Viveka's four films.
- [ ] A Hinglish speaker on the team should read the Hinglish lines; they are drafted by the builder.
- [ ] Counseling is deferred. When it exists, the support message can offer a booking; today it names the helpline only.
- [ ] Teacher and parent views of the Brain report and the school report are deferred (scope, Deferred). Class totals of Brain measures are closed by the owner (2026-10-24): no staff total of the Brain.
