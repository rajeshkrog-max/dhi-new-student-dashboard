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

### 25. One professional look for every page, the menu and loading screens · in-progress · Alpha
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

### 5. Mood room, real, with the Vedic lens · in-progress
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
- [ ] Document it: `/document mood room, real, with the Vedic lens`
Spec [0006](../../specs/house/0006-mood-room-real/index.md) · code in `packages/backend/convex/{moods,moodRules,moodRoom,moodProof}.ts`, `packages/backend/convex/eventTypes/mood.ts`, `src/components/dhi/mood-tracker.tsx`, `src/lib/dhi/{mood-words,mood-lines,mood-demo}.ts`, `scripts/mood-check.mjs`. Built 2026-10-19; the live race check passed on the development deployment. Builds on rows 3 and 4. The guna lines and tips are drafts until the owner approves them.

## Slice 3: body and routine rooms

### 6. Habits room, real · in-progress
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
- [ ] Document it: `/document habits room, real`
Spec [0007](../../specs/house/0007-habits-room-real/index.md) · code in `packages/backend/convex/{habits,habitCodes,habitRules,habitRoom,habitProof}.ts`, `packages/backend/convex/eventTypes/habits.ts`, `src/components/dhi/habits/`, `src/lib/dhi/habits/`, `scripts/{habit-check,fresh-student}.mjs`. Built 2026-10-19; the live race check passed on the development deployment. Builds on rows 3 and 4 and follows the Mood room (row 5).

### 7. Sleep log · needs a decision
A new two tap entry for bedtime and wake time, prefilled from yesterday. Sleep is the signal your research brief leans on most, and no room records it today. Where it lives (its own card, or inside Habits or Mood) is the decision.
**Done when:** a student logs bed and wake time in two taps, sleep length and usual bedtime read back, a night with no log stays not logged, and each entry reaches the event log.
- [ ] Design it (spec): `/architect sleep log`

### 8. Food table and the Indian plate catalog · needs a decision
A trusted food list for the Meals room: Indian dishes and common packaged items, each with energy, carbs, protein and fat per serving, a food group (grain, dal or protein, vegetable, dairy, fruit) and a neutral processing tag (home cooked, packaged, fried). The source, its licence, how custom dishes get their numbers and who approves them are the decisions. Numbers are stored, but students see plate balance and food groups, never calorie totals or targets. (your call, 2026-10-18)
**Done when:** a spec names the source and its licence, search by dish name works with English and Hindi spellings, every item has a food group and a processing tag, and a custom dish is accepted, held without numbers until DHI fills them, and counts for its group once filled.
- [ ] Design it (spec): `/architect food table and the Indian plate catalog`

### 9. Meals room, real
Plates saved on the server: item, count (for example rotis), meal (breakfast, lunch, dinner, snack) and time, with custom dishes allowed. The day resets; the week does not. The room shows balance and food groups only, and no food is called good or bad.
**Done when:** a student logs a plate and sees it after a reload, a meal at 01:00 lands on the day before, no screen shows calorie totals or targets, and nothing in the wording suggests that eating less or skipping a meal helps.
- [ ] Build it: `/develop meals room, real` (follows the specs of rows 3 and 8)

## Slice 4: study and work rooms

### 10. Papers: teachers build, send and mark · needs a decision
The staff side of exams, and the first staff screens in the house. A teacher builds a paper (multiple choice and long writing) with a subject and topic on every question, the right answer kept on the server only, and each wrong option optionally tagged as a misread or a concept slip. They send it to a class or one student with an open and a due time, then mark it with a rubric and remarks.
**Done when:** a teacher builds, sends and marks a paper, answers and tags never reach a student's browser, a paper reaches only its assigned students, and marks and remarks show to the student and to the institute's academic preview.
- [ ] Design it (spec): `/architect papers: teachers build, send and mark`

### 11. Exams room, real · needs a decision
The student side: open papers, sitting one (starting locks the other menus), the hint slider that never reveals the answer, submit to the teacher, and accept feedback. When the window closes with no submit, the miss is stored once and the attempt history stays.
**Done when:** a paper opens only inside its window, a hint response never contains the answer, a closed window with no submit stores one miss, a submitted attempt cannot be changed, and accepted feedback is recorded.
- [ ] Design it (spec): `/architect exams room, real`

### 12. Modules: DHI uploads, students watch and keep · needs a decision
Films are uploaded by DHI admin only, so a student cannot add one. Students watch with progress saved, the score is written once when playback reaches the end, and seeking past the watched point stays closed until then. Academic films carry 2 check questions tagged to their topic.
**Done when:** an admin uploads a film with its category and score value, a student's progress survives a reload and a change of device, the score is written once at the end and never on a replay, a jump forward is refused by the server's own record and not only by the screen, and a student has no upload control.
- [ ] Design it (spec): `/architect modules: DHI uploads, students watch and keep`

### 13. Blog room, real, with teacher review · needs a decision
Students write posts with a title, a tag, one photo and a body (bold, italic and a numbered list only). The author sees their post at once; classmates in the same institute see it after a teacher approves it. Comments are plain text and also reviewed. The HTML is cleaned again on the server with the same allowed tags as the screen. Writing is a signal in the Brain, so the room never pushes a student to write more. (your call, 2026-10-18)
**Done when:** a post with disallowed markup is cleaned on the server, an unapproved post is visible to its author and teachers only, a teacher can approve, hide and remove, a post never leaves its institute, and the photo is stored once with only its path kept.
- [ ] Design it (spec): `/architect blog room, real, with teacher review`

### 14. Study hour: admin clock, live seats and chat · needs a decision
DHI admin sets the hours. A student can enter only inside the window, and leaving or the clock ending drops the seat. Live shows yourself large and others beside you, Away shows the profile only, and Do not disturb shows no people and no chat. Voice and video are a later row. Seat time feeds the Brain.
**Done when:** entry before the hour opens or after it closes is refused, seats update live for everyone in the hour, leaving or the end drops the seat on the server, Do not disturb hides the student and the chat from others, and minutes present reach the event log.
- [ ] Design it (spec): `/architect study hour: admin clock, live seats and chat`

### 15. DHI desk: real model, coins and answer cache · needs a decision
The study helper with a coin wallet (chat 1, write 2, paper 2, mock 4, story 5, draw 8, clarify free), a monthly allotment set by DHI admin, saved threads, study file attachments, and a cache so a repeated question costs 0 and does not call the model again. Which parts of the Desk Design (steps D1 to D6) fit this slice is the decision. Many users are minors, so what the model may be asked and may show is part of it.
**Done when:** a student asks, spends the right coins and sees the thread after a reload, a repeated question returns the stored answer for 0 coins with no model call, a student with no coins is refused by the server, DHI admin sets the allotment and an institute admin cannot, and no counselor recording can be stored.
- [ ] Design it (spec): `/architect DHI desk: real model, coins and answer cache`

### 16. After session feeling card
When a desk sitting of 10 minutes or more, or a study hour stay of 20 minutes or more, ends, the student may tap how they felt (energised, okay, drained) and rate their focus from 1 to 5. It can be skipped, and a skip is stored as a skip. It feeds the felt okay and focus measures.
**Done when:** the card appears only at those lengths, a skip is stored as skipped and changes no value, and answers reach the event log with their subject.
- [ ] Build it: `/develop after session feeling card` (follows rows 14 and 15)

## Slice 6: home

### 23. Home and DHI score, real · needs a decision
The home screen on real data: greeting, open exams, quick tiles and the DHI score (a growth mark, not a rank) built from exams sat before the window closes and misses, study time in an open hour, modules kept, habit ticks, and mood and meal logs counted as presence only. Whether the DHI score and the three lamps in the Brain are one thing or two is the decision.
**Done when:** home loads for a real student with no demo data, the score can be explained by its inputs, mood and meal logs count by presence while their content never does, and open exams link to the papers.
- [ ] Design it (spec): `/architect home and DHI score, real`
