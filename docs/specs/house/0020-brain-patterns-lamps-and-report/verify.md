# Verify: the Brain · specs 0019 and 0020 · updated 2026-10-22
_Steps derived from the acceptance criteria of specs 0019 and 0020. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
Needs `pnpm dev`, the demo institute (`pnpm --filter @dhi/backend exec convex run demo:seed`) and `VITE_TEST_SIGNIN=true` in `.env.local`. Use only made up students. Nothing here touches production. To see a page with days on it, use the development helper after signing in as a fresh student (the email is the one you invited): `pnpm --filter @dhi/backend exec convex run brainProof:seed '{"email":"<the student email>","scenario":"heavy"}'`, then reload. Scenarios: `heavy`, `steady`, `packaged`.
- [x] Open Progress as a student who has logged nothing → the page says DHI needs at least 5 days, a draft note shows for the words and for the sources, there is no pattern and the score says Not yet, and "Open Mood" opens the Mood room → AC-7, AC-9, AC-10
- [x] Seed `heavy` and reload → one card, "Heavy days and quieter days after", that says "tend to come together" and "your own days"; "See the days" lists 8 days, each with what happened and a button into the room; an expression note; and a support message that names Tele-MANAS on 14416 and promises no booking → AC-1, AC-4, AC-5, AC-7
- [x] Press "This does not feel true" → the card goes, the page says one is hidden for 30 days, and it stays hidden after a reload; "Show again" brings it back → AC-7
- [x] Choose Hinglish → the same cards read in Hinglish, and it is still Hinglish after a reload → AC-9
- [x] Seed `steady` → one supporting card, no support message, no expression note, the Sadhana and Niyam lamps say they are rising, Viveka says there are not enough days, the score is 70, and Home shows 70 → AC-2, AC-6
- [ ] Read every word on the page in both languages → no ranking, no clinical word, no "because", no advice about food, no one else's name; and the lamps text says it is never a rank → AC-9
- [ ] Ask a Hinglish speaker of the team to read the Hinglish lines → they read naturally and kindly → AC-9
- [ ] Open Progress at 360, 768, 1024 and 1280 px → no sideways scroll, taps of at least 44 px on touch, text of at least 12 px → AC-7
- [ ] Sign in as a teacher, an institute admin and a DHI admin → none of them has a Progress page, and none can reach a student's report by any screen → AC-8

## Commands
- [x] `pnpm --filter @dhi/backend test` → 1,000 or more tests pass, including `metricRules` (8), `brainRollup` (12), `brainRules` (27), `brain` (13), `home` (8) and `classPause` (4) → AC-1 to AC-9 of both specs
- [x] `node --experimental-strip-types --test src/lib/dhi/brain-words.test.ts` → the copy lint passes in both languages → AC-9
- [x] `pnpm brain:check` → 8 of 8 steps → AC-7
- [ ] `pnpm responsive:sweep --room progress` → ok at four widths → AC-7
- [x] Vary the input: a student with only today logged → no row for a finished day and the lamps use today; a student with 4 days logged → the empty state; a student with one paper, one habit tick and nothing else → a score from the lamps that have a value → AC-2, AC-6, AC-7
- [x] Vary the viewer: a teacher, an institute admin, a DHI admin and a counselor call `brain.report`, `brain.hide` and `brain.show` → each is refused; a student who withdrew is refused → AC-8
- [x] Vary the tenant: a second student's report → their own days only; hiding a pattern for one student leaves the other's → AC-8
- [x] Read the stored `brainDays` of a student in the Convex dashboard → measure ids, numbers and a version only, no word they wrote → AC-9 of spec 0019
- [x] Download my data → the file has a Brain section of day, measure, top and bottom; Erase my data then leaves no day and no hidden pattern → AC-8 of spec 0019
- [ ] Wait a minute after logging a mood on a finished day (a late entry) and read the stored row → the day updated; run `brainRollup:reconcile` → zero mismatches → AC-4, AC-5 of spec 0019

## Acceptance-criteria coverage
- Spec 0019: AC-1 … `metricRules` tests · AC-2 … `metricRules`, `brainRollup` · AC-3 … `metricRules`, `brainRollup` · AC-4 … `brainRollup` · AC-5 … `brainRollup` · AC-6 … `brainRollup` · AC-7 … `brainRollup` · AC-8 … `brainRollup` · AC-9 … `brainRollup`, `houseConsent`
- Spec 0020: AC-1 … `brainRules`, `brain`, UI 2 · AC-2 … `brainRules`, UI 5 · AC-3 … `brainRules` · AC-4 … `brainRules`, UI 2 · AC-5 … `brainRules`, UI 2 · AC-6 … `brainRules`, UI 5 · AC-7 … `brain`, `brain:check`, UI 1, 3, 8 · AC-8 … `brain`, UI 9 · AC-9 … `brain-words.test.ts`, UI 4, 6, 7 · AC-10 … UI 1, `sources.md`

_2026-10-22: built and checked locally. Ran: the backend suite, the copy test, `pnpm brain:check` (8 of 8) and `pnpm exams:check` (12 of 12). Not run by hand yet: the sweep at four widths for the new page, the staff roles by eye, a Hinglish read by a native speaker, the wait for a late event, and `/check verify`, `/test` and `/check review`._
