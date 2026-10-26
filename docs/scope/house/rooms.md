# Scope: DHI student house, the rooms

Each room of the house moved from demo data to real server data, plus the small staff screens that feed them (papers, marking, the study hour clock, modules, coins, invites). Counseling and calls are left out on purpose and sit under Deferred in [index.md](index.md). The rooms follow the platform rows in [platform.md](platform.md), and the Brain in [brain.md](brain.md) reads what they write.

## Already built (for context)

### A. Student house screens on demo data · existing
All the rooms as screens, with local demo data for one seat. No real backend yet. code in `src/`, the backend brief in `BACKEND.md`

## Slice 1: works on every screen size

### 1. Make the app responsive · done · Alpha
Every room of the house reads and works well on a phone, a tablet and a desktop. That covers the side menu, the cards and grids, the calendar and charts, tables and lists, forms, and touch sized buttons. It does not change what any room does, and it keeps the room rules in `BACKEND.md`.
**Done when:** every room opens at phone, tablet and desktop widths with no sideways page scroll, nothing is cut off or overlaps, the menu can be opened and used by touch on a phone, and the controls are easy to tap.
- [x] Design it (spec): `/architect make the app responsive`
- [x] Build it: `/develop make the app responsive`
   - [x] The thread: sweep script, top bar and drawer, shared Sheet, Home at four widths (AC-1 to AC-9, AC-14, AC-15, AC-18)
   - [x] Exams, Mood, Meals and Habits on a phone (AC-7 to AC-11, AC-14, AC-15)
   - [x] Modules, Blog, Study hour and DHI desk on a phone (AC-5 to AC-9, AC-12, AC-13)
   - [x] Sign in page, placeholder rooms, desktop unchanged and room rules kept (AC-5, AC-16, AC-17)
- [x] Verify it: `/check verify make the app responsive`
Spec [0001](../../specs/house/0001-make-app-responsive.md) · code in `src/routes/home.tsx`, `src/components/dhi/`, `src/styles.css`, `scripts/responsive-*`

## Look and feel: one professional look

### 25. One professional look for every page, the menu and loading screens · done · Alpha
Every page, the shared menu and every wait on screen take on the same polished look the dashboard and the room pages already have: the front door, the sign in page, the menu and top bar, the empty and error pages, and the loading screens (a page opening, the sign in check, data arriving). Loading screens hold the shape of the page they stand in for, so nothing jumps when the content lands. It changes how things look, never what a room does, and it keeps the room rules in `BACKEND.md`. Placed before the Mood room so the rooms built after it start on the finished look. (your call, 2026-10-18)
**Done when:** every page uses the dashboard's look (type, colour, spacing, cards and buttons), the menu looks and works the same on every page, every wait shows a matching loading screen and never a blank page or bare text, error and not found pages match, and all of it holds at phone, tablet and desktop widths with no sideways scroll and no room behaviour changed.
- [x] Design it (spec): `/architect one professional look for every page, the menu and loading screens`
- [x] Build it: `/develop one professional look for every page, the menu and loading screens`
   - [x] Tokens, focus ring, readable grey text, the check baseline and the repaired sweep (AC-1, AC-8, AC-9, AC-13)
   - [x] The shared kit and one menu style for the side menu and the drawer (AC-2, AC-4, AC-12)
   - [x] Loading screens, slow wait, error and not found pages (AC-5, AC-6, AC-7)
   - [x] The Enter screen on the kit and self hosted fonts (AC-3, AC-10)
   - [x] Rooms on tokens and the full proof at four widths (AC-11, AC-12, AC-13)
- [x] Verify it: `/check verify one professional look for every page, the menu and loading screens`
Spec [0003](../../specs/house/0003-one-professional-look/index.md) · code in `src/components/dhi/ui/`, `src/styles.css`, `src/components/dhi/enter-screen.tsx`, `src/routes/home.tsx`, `scripts/look-check.mjs`, `scripts/responsive-sweep.mjs`

## Slice 2: the thin thread (Mood)

### 5. Mood room, real, with the Vedic lens · done
The thinnest real path through the house: a signed in student picks a mood colour for the day, writes their own words, and reads it back from the server after a reload. The room reads each mood through the three gunas (sattva, rajas, tamas) and offers a daily rhythm (dinacharya) tip. This is reflection only, never a diagnosis and never health advice. The help button stays as it is until the counseling row, and nothing is booked. (basis: tracer bullet practice; mood is logged daily, so it proves login, the event log and the read back fastest)
**Done when:** a student logs one mood a day, edits it for that day only, sees history after a reload and on another device, the DHI line and guna wording pass the copy rules (no clinical words, no labels like weak or bright), and each entry reaches the event log.
- [x] Design it (spec): `/architect mood room, real, with the Vedic lens`
- [x] Build it: `/develop mood room, real, with the Vedic lens`
   - [x] The thread: table, rules file, event type, save and month (AC-1, AC-5, AC-7)
   - [x] One entry a day, edits, today only, the note, the limit (AC-2, AC-3, AC-4, AC-10)
   - [x] Export, erase and the data map (AC-6, AC-9)
   - [x] The words: lines, gunas and tips as drafts (AC-8)
   - [x] The screen on the server and the proof (AC-1, AC-8, AC-11, AC-12)
- [x] Verify it: `/check verify mood room, real, with the Vedic lens`
- [x] Test it: `/test mood room, real, with the Vedic lens`
- [x] Review it (fresh model): `/check review mood room, real, with the Vedic lens`
- [x] Document it: `/document mood room, real, with the Vedic lens`
Spec [0006](../../specs/house/0006-mood-room-real/index.md) · code in `packages/backend/convex/{moods,moodRules,moodRoom,moodProof}.ts`, `packages/backend/convex/eventTypes/mood.ts`, `src/components/dhi/mood-tracker.tsx`, `src/lib/dhi/{mood-words,mood-lines,mood-demo}.ts`, `scripts/mood-check.mjs`. Built 2026-10-19; the live race check passed on the development deployment. Builds on rows 3 and 4. The guna lines and tips are drafts until the owner approves them.

## Slice 3: body and routine rooms

### 6. Habits room, real · done
Up to 5 habits per student, each with its own label, start, end, daily tick and streak, saved on the server. A miss is a day in the window with no tick, and history is never rewritten. The cap of 5 is checked on the server as well as on the screen.
**Done when:** a sixth habit is refused by the server, ticks survive a reload, a missed day shows as a miss, a tick on a future or closed day is refused, and each tick reaches the event log.
- [x] Design it (spec): `/architect habits room, real`
- [x] Build it: `/develop habits room, real`
   - [x] The thread: tables, rules file, event type, add, list and tick (AC-1, AC-3, AC-4, AC-6, AC-8)
   - [x] The window and field rules, the cap, undo and flips, remove, the limit (AC-2, AC-5, AC-7, AC-11)
   - [x] Export, erase and the data map (AC-9, AC-10)
   - [x] The screen on the server (AC-4, AC-12)
   - [x] The proof (AC-1 to AC-13)
- [x] Verify it: `/check verify habits room, real`
- [x] Test it: `/test habits room, real`
- [x] Review it (fresh model): `/check review habits room, real`
- [x] Document it: `/document habits room, real`
Spec [0007](../../specs/house/0007-habits-room-real/index.md) · code in `packages/backend/convex/{habits,habitCodes,habitRules,habitRoom,habitProof}.ts`, `packages/backend/convex/eventTypes/habits.ts`, `src/components/dhi/habits/`, `src/lib/dhi/habits/`, `scripts/{habit-check,fresh-student}.mjs`. Built 2026-10-19; the live race check passed on the development deployment. Builds on rows 3 and 4 and follows the Mood room (row 5).

### 7. Sleep log · in-progress
A new two tap entry for bedtime and wake time, prefilled from yesterday. Sleep is the signal your research brief leans on most, and no room records it today. It lives in its own room (your call, 2026-10-20): its own card, table and event type, not inside Habits or Mood.
**Done when:** a student logs bed and wake time in two taps, sleep length and usual bedtime read back, a night with no log stays not logged, and each entry reaches the event log.
- [x] Design it (spec): `/architect sleep log`
- [x] Build it: `/develop sleep log`
   - [x] The thread: table, rules file, event type, save and recent (AC-1, AC-5, AC-7)
   - [x] The rules: one entry a night, the server day, validation, the change cap, the limit (AC-2, AC-3, AC-4, AC-10)
   - [x] Export, erase and the data map (AC-6, AC-9)
   - [x] The words and the screen on the server (AC-8, AC-11)
   - [x] The proof (AC-1 to AC-12): the live race, the browser proof `pnpm sleep:check` (11 of 11) and the sweep at four widths passed
- [ ] Verify it: `/check verify sleep log`
- [ ] Test it: `/test sleep log`
- [ ] Review it (fresh model): `/check review sleep log`
- [ ] Document it: `/document sleep log`
Spec [0008](../../specs/house/0008-sleep-room-real/index.md) · code in `packages/backend/convex/{sleep,sleepRules,sleepRoom,sleepProof,sleep.test}.ts`, `packages/backend/convex/eventTypes/sleep.ts`, `src/components/dhi/sleep-tracker.tsx`, `src/lib/dhi/sleep-words.ts`, `src/lib/dhi/sleep-words.test.ts`. Builds on rows 3 and 4 and follows the Mood and Habits rooms (rows 5 and 6). The words are drafts until the owner approves them.

### 8. Food table and the Indian plate catalog · in-progress (designed)
Built without catalog items (the catalog loads after the licence checks): search, custom dishes, DHI publishing and its screen. Open: the licence checks and the first import.
A trusted food list for the Meals room: Indian dishes and common packaged items, each with energy, carbs, protein and fat per serving, a food group (grain, dal or protein, vegetable, dairy, fruit) and a neutral processing tag (home cooked, packaged, fried). The source, its licence, how custom dishes get their numbers and who approves them are the decisions. Numbers are stored, but students see plate balance and food groups, never calorie totals or targets. (your call, 2026-10-18)
**Done when:** a spec names the source and its licence, search by dish name works with English and Hindi spellings, every item has a food group and a processing tag, and a custom dish is accepted with the student's own numbers, counts for its group at once, and DHI can publish it to everyone's list (owner's answer, 2026-10-20).
- [x] Design it (spec): `/architect food table and the Indian plate catalog`
Spec [0009](../../specs/house/0009-food-table-indian-plate-catalog.md) · the build follows once you accept the spec.

### 9. Meals room, real · in-progress (designed)
Built: logging, day and week group counts, removal, export and erase, and the screen, covered by 15 tests and `pnpm meals:check`. Open: the owner's wording check.
Spec [0010](../../specs/house/0010-meals-room-real.md) · code in `packages/backend/convex/{meals,mealsRoom,foods,foodRules}.ts`, `src/components/dhi/meals/`, `scripts/meals-check.mjs`. The meals event carries the processing tag since version 2 (spec 0019).
Plates saved on the server: item, count (for example rotis), meal (breakfast, lunch, dinner, snack) and time, with custom dishes allowed. The day resets; the week does not. The room shows balance and food groups only, and no food is called good or bad.
**Done when:** a student logs a plate and sees it after a reload, a meal at 01:00 lands on the day before, no screen shows calorie totals or targets, and nothing in the wording suggests that eating less or skipping a meal helps.
- [x] Build it: `/develop meals room, real` (follows the specs of rows 3 and 8)
- [ ] Verify it: `/check verify meals room, real`
- [ ] Test it: `/test meals room, real`
- [ ] Review it (fresh model): `/check review meals room, real`
- [ ] Document it: `/document meals room, real`

## Slice 4: study and work rooms

### 10. Papers: teachers build, send and mark · in-progress (designed)
The staff side of exams, and the first staff screens in the house. A teacher builds a paper (multiple choice and long writing) with a subject and topic on every question, the right answer kept on the server only, and each wrong option optionally tagged as a misread or a concept slip. They send it to a class or one student with an open and a due time, then mark it with a rubric and remarks.
**Done when:** a teacher builds, sends and marks a paper, answers and tags never reach a student's browser, a paper reaches only its assigned students, and marks and remarks show to the student and to the institute's academic preview.
- [x] Design it (spec): `/architect papers: teachers build, send and mark`
Built: the paper builder with a hint for each question, sending to a class, the teacher's look at named results through the staff read (a record the student can see), marking by hand with remarks and confirming, and the institute admin's results preview. 18 tests and `pnpm exams:check`. Suggested marks are held by the owner's answer.
- [x] Build it: `/develop papers: teachers build, send and mark`
- [ ] Verify it: `/check verify papers: teachers build, send and mark`
- [ ] Test it: `/test papers: teachers build, send and mark`
- [ ] Review it (fresh model): `/check review papers: teachers build, send and mark`
- [ ] Document it: `/document papers: teachers build, send and mark`
Spec [0011](../../specs/house/0011-papers-teachers-build-send-mark.md) · code in `packages/backend/convex/{papers,papersRules,paperRoom}.ts`, `src/components/dhi/staff/{papers-section,results-section}.tsx`.

### 11. Exams room, real · in-progress (designed)
Built: the server side (sitting, answers kept as the student types, hints, submit, the automatic close by a minute sweep, the single miss, accepting feedback) with 18 tests, an event for the Brain for each finished sitting, and the student screen with the menu lock during a sitting, covered by `pnpm exams:check` (12 of 12). A window that ends while the class is paused closes as excused, with no miss (row 24). A late press of Submit is told that what was written went in when the time ended. Review fixes of 2026-10-22 are in the spec.
The student side: open papers, sitting one (starting locks the other menus), the hint slider that never reveals the answer, submit to the teacher, and accept feedback. When the window closes with no submit, the miss is stored once and the attempt history stays.
**Done when:** a paper opens only inside its window, a hint response never contains the answer, a closed window with no submit stores one miss, a submitted attempt cannot be changed, and accepted feedback is recorded.
- [x] Design it (spec): `/architect exams room, real`
- [x] Build it: `/develop exams room, real`
- [ ] Verify it: `/check verify exams room, real`
- [ ] Test it: `/test exams room, real`
- [ ] Review it (fresh model): `/check review exams room, real`
- [ ] Document it: `/document exams room, real`
Spec [0012](../../specs/house/0012-exams-room-real.md) · code in `packages/backend/convex/{exams,papers}.ts`, `src/components/dhi/exams/exams-room.tsx`.

### 12. Modules: DHI uploads, students watch and keep · in-progress (designed)
Built on a stand-in host: upload and approval, the student's room with the server's own progress record, the score once, export and erase, 16 tests and `pnpm modules:check`. Open: the Cloudflare Stream account.
Films are uploaded by DHI admin only, so a student cannot add one. Students watch with progress saved, the score is written once when playback reaches the end, and seeking past the watched point stays closed until then. Academic films carry 2 check questions tagged to their topic.
**Done when:** an admin uploads a film with its category and score value, a student's progress survives a reload and a change of device, the score is written once at the end and never on a replay, a jump forward is refused by the server's own record and not only by the screen, and a student has no upload control.
- [x] Design it (spec): `/architect modules: DHI uploads, students watch and keep`
- [x] Build it: `/develop modules: DHI uploads, students watch and keep` (on a stand-in host)
- [ ] Verify it: `/check verify modules: DHI uploads, students watch and keep`
- [ ] Test it: `/test modules: DHI uploads, students watch and keep`
- [ ] Review it (fresh model): `/check review modules: DHI uploads, students watch and keep`
- [ ] Document it: `/document modules: DHI uploads, students watch and keep`
Spec [0013](../../specs/house/0013-modules-dhi-uploads.md) · code in `packages/backend/convex/{films,moduleRules,filmRoom,filmsProof}.ts`, `src/components/dhi/modules/`, `src/components/dhi/staff/films-section.tsx`.

### 13. Blog room, real, with teacher review · in-progress (designed)
Built: the server side (write, the server clean, review by the author's class teacher, comments, an allowance of 6 posts and 30 comments an hour, an event when a post is first published, export and erase) with 13 tests, the student screen and the teacher review, covered by `pnpm exams:check`. The photo is built (one a post, checked by size, freshness and declared type, seen by the class teacher before classmates, deleted with the post or the student, `hadPhoto` in the download), and comments are in the download. Still open: the final tag list.
Students write posts with a title, a tag, one photo and a body (bold, italic and a numbered list only). The author sees their post at once; classmates in the same institute see it after a teacher approves it. Comments are plain text and also reviewed. The HTML is cleaned again on the server with the same allowed tags as the screen. Writing is a signal in the Brain, so the room never pushes a student to write more. (your call, 2026-10-18)
**Done when:** a post with disallowed markup is cleaned on the server, an unapproved post is visible to its author and teachers only, a teacher can approve, hide and remove, a post never leaves its institute, and the photo is stored once with only its path kept.
- [x] Design it (spec): `/architect blog room, real, with teacher review`
- [x] Build it: `/develop blog room, real, with teacher review`
- [ ] Verify it: `/check verify blog room, real, with teacher review`
- [ ] Test it: `/test blog room, real, with teacher review`
- [ ] Review it (fresh model): `/check review blog room, real, with teacher review`
- [ ] Document it: `/document blog room, real, with teacher review`
Spec [0014](../../specs/house/0014-blog-room-with-teacher-review.md) · code in `packages/backend/convex/{blog,blogRules,blogRoom}.ts`, `src/components/dhi/blog/blog-real.tsx`, `src/components/dhi/staff/papers-section.tsx`.

### 14. Study hour: admin clock, live seats and chat · in-progress (designed)
Built: the clock, seats and modes split by institute, the heartbeat and sweep, presence minutes, moderated chat, teacher review, export and erase, 17 tests and `pnpm hour:check`. The chat is deleted after 30 days (a builder default for the owner to confirm); teachers and the DHI admin can read it, and the consent notice says so.
DHI admin sets the hours. A student can enter only inside the window, and leaving or the clock ending drops the seat. Live shows yourself large and others beside you, Away shows the profile only, and Do not disturb shows no people and no chat. Voice and video are a later row. Seat time feeds the Brain.
**Done when:** entry before the hour opens or after it closes is refused, seats update live for everyone in the hour, leaving or the end drops the seat on the server, Do not disturb hides the student and the chat from others, and minutes present reach the event log.
- [x] Design it (spec): `/architect study hour: admin clock, live seats and chat`
- [x] Build it: `/develop study hour: admin clock, live seats and chat`
- [ ] Verify it: `/check verify study hour: admin clock, live seats and chat`
- [ ] Test it: `/test study hour: admin clock, live seats and chat`
- [ ] Review it (fresh model): `/check review study hour: admin clock, live seats and chat`
- [ ] Document it: `/document study hour: admin clock, live seats and chat`
Spec [0015](../../specs/house/0015-study-hour-admin-clock-seats.md) · code in `packages/backend/convex/{studyHour,hourRules,hourRoom,hourProof}.ts`, `src/components/dhi/study/study-hour-real.tsx`, `src/components/dhi/staff/hour-section.tsx`.

### 15. DHI desk: real model, coins and answer cache · in-progress (built for chat and clarify)
Built on 2026-10-24 once a model key was supplied: wallets with a monthly allotment (60 coins, DHI admin sets it), saved talks, the answer cache, the exam lock, the care answer for distress words, and the gateway to the model, with 32 tests. Live kinds are chat, clarify and write (feedback on a student's own writing, 2 coins, up to 1500 letters, coach and never rewrite, never cached) and paper (practice questions on a topic, 2 coins: five questions and no answers, asking about an answer afterwards is the free clarify; never cached) and mock (a longer practice set, 4 coins: ten questions, no timer, no marks, no answers, self checked through the free clarify; never cached) and story (a short study story from a school topic, 5 coins: text only, under 250 words, school safe by instruction; never cached); and draw (a simple labelled study diagram, 8 coins: plain SVG written by the text model and checked tag by tag on the server by `cleanSvg`, shown through an image tag, never a picture model; never cached). Every desk kind is now live. Open: the owner's word approvals and the care text, rotating the key that was pasted into the chat, and production setup.
The study helper with a coin wallet (chat 1, write 2, paper 2, mock 4, story 5, draw 8, clarify free), a monthly allotment set by DHI admin, saved threads, study file attachments, and a cache so a repeated question costs 0 and does not call the model again. Which parts of the Desk Design (steps D1 to D6) fit this slice is the decision. Many users are minors, so what the model may be asked and may show is part of it.
**Done when:** a student asks, spends the right coins and sees the thread after a reload, a repeated question returns the stored answer for 0 coins with no model call, a student with no coins is refused by the server, DHI admin sets the allotment and an institute admin cannot, and no counselor recording can be stored.
- [x] Design it (spec): `/architect DHI desk: real model, coins and answer cache`
- [x] Build it: `/develop DHI desk: real model, coins and answer cache` (chat and clarify)
- [ ] Verify it: `/check verify DHI desk: real model, coins and answer cache`
- [ ] Test it: `/test DHI desk: real model, coins and answer cache`
- [ ] Review it (fresh model): `/check review DHI desk: real model, coins and answer cache`
- [ ] Document it: `/document DHI desk: real model, coins and answer cache`
Spec [0016](../../specs/house/0016-dhi-desk-model-coins-cache.md) · code in `packages/backend/convex/{desk,deskAsk,deskRules,deskRoom}.ts`, `src/components/dhi/desk/desk-real.tsx`, `src/lib/dhi/desk-words.ts`.

### 16. After session feeling card · in-progress
Built for the study hour (spec [0018](../../specs/house/0018-after-session-feeling-card.md)): the card after a stay of 20 minutes, a skip stored as skipped, the answer as one event, 8 tests and `pnpm hour:check`. The desk part is built too (2026-10-24): a desk sitting is a run of questions with no gap over 15 minutes, a card is offered at 10 minutes or more, and the student may pick a subject. Open: the owner confirms the subject list and the words.
When a desk sitting of 10 minutes or more, or a study hour stay of 20 minutes or more, ends, the student may tap how they felt (energised, okay, drained) and rate their focus from 1 to 5. It can be skipped, and a skip is stored as a skip. It feeds the felt okay and focus measures.
**Done when:** the card appears only at those lengths, a skip is stored as skipped and changes no value, and answers reach the event log with their subject.
- [x] Build it: `/develop after session feeling card` (the study hour and the desk)
- [ ] Verify it: `/check verify after session feeling card`
- [ ] Test it: `/test after session feeling card`
- [ ] Review it (fresh model): `/check review after session feeling card`
- [ ] Document it: `/document after session feeling card`

## Slice 6: home

### 23. Home and DHI score, real · in-progress (designed)
The home screen on real data: greeting, open exams, quick tiles and the DHI score (a growth mark, not a rank) built from exams sat before the window closes and misses, study time in an open hour, modules kept, habit ticks, and mood and meal logs counted as presence only. Whether the DHI score and the three lamps in the Brain are one thing or two is the decision.
**Done when:** home loads for a real student with no demo data, the score can be explained by its inputs, mood and meal logs count by presence while their content never does, and open exams link to the papers.
- [x] Design it (spec): `/architect home and DHI score, real`
Built: Home on real data only. The sample data note and every demo tile are gone; the greeting, the DHI score card (the Brain's three lamps, with their inputs), open exams, recent exams with confirmed marks, and quick access remain. Presence only for mood and meals. Row 21 is the same lamps, so the score and the Progress page cannot disagree. The bell at the top lists an open paper, a mark ready to read and a feeling card, read when the student looks and stored nowhere. 8 tests, plus the bell tests.
- [x] Build it: `/develop home and DHI score, real`
- [ ] Verify it: `/check verify home and DHI score, real`
- [ ] Test it: `/test home and DHI score, real`
- [ ] Review it (fresh model): `/check review home and DHI score, real`
- [ ] Document it: `/document home and DHI score, real`
Spec [0017](../../specs/house/0017-home-and-dhi-score-real.md) · code in `packages/backend/convex/{home,homeRules}.ts`, `src/components/dhi/home-score.tsx`, `src/routes/home.tsx`.
