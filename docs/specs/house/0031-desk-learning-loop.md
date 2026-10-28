# 0031. The desk's learning loop: the topic map, the question bank, Fix, Remember, Plan and written marking

**Date**: 2026-10-28
**Status**: In Progress (built; the words are drafts; books, uploads and pre-generation wait for a licence)

## Summary

The desk gets a Learn tab beside Ask (Desk Design D1 map only, D3, D4 and D5). A student finds a topic of their class by subject and chapter, or by search, and on its page can practise its bank questions (marked by code), go back over every wrong answer until it is right (Fix), answer short recall rounds when a topic is due (Remember, at 1, 3, 7, 21 and 45 days), write an answer that the model marks against the teacher's key points (a teacher of the class marks it when the model is unsure or the student asks), and ask where the idea is used in daily life (Use it). Plan lays out the days before a test by code. Each answer moves the student's own state on the topic (mastery, the next recall day), which only chooses the next questions and is never shown as a label. Teachers fill the bank with their own questions and the syllabus map with topics and chapters.

## Requirements

**Owner answers (2026-10-28)**: the owner chose "go with your recommendation" for every question:
1. Book rights: **no licence yet**. D1 is the map of topics only, from the teachers' paper topics and a syllabus list the teachers enter. No book text is ingested, no embeddings, no vector search, no file storage. D6 (uploads, pre-generation) waits.
2. Boards: **CBSE only** first. (The map has no board field yet: every topic belongs to its institute, which teaches one board.)
3. Reviewers: **a teacher of the class** reviews: the bank is the teachers' own questions, and a written mark the model is unsure of goes to them.
4. Cost: **no new model spend beyond the 60 coins a month**. Search, the map, practice, Fix, Remember and Plan are code and cost nothing; marking a written answer costs 2 coins and Use it 2 coins, both inside the daily cap of 300 (spec 0016).

**Defaults the builder chose (say if any should change)**:
- The bank is an institute's own questions: a teacher's practice bank paper ("Practice questions for the desk only"; never sent, so its answers can be shown) at once, and a sent paper's questions once every window of it has closed, so an answer is never shown while a classmate may still sit the paper. A bank paper's topics go to every class its teacher teaches.
- Mastery starts at 0.3 and moves toward 1 or 0 on each answer, more for a hard question right or an easy one wrong; a question's difficulty is learned from the desk answers to it in the institute. Held ("Holding in memory") is 0.85 or more on two answers at least three days apart, counted once (`desk.mastered`, A09). The level (under 0.4, 0.4 to 0.75, over 0.75) only picks questions near a 70 to 85% chance of being right; the screen never shows it.
- Paper answers count too: after a submission, each multiple choice answer on a tagged question enters the student's state in its own step (`learn.fromPaper`), and a wrong one opens a Fix item.
- A round is 5 questions (practice), up to 5 open Fix items, or one question of each due topic up to 5 (recall). An answer is taken only for a question of the student's own round, once.
- Every desk kind that is not the student's own writing or a clarifying question reads the cache first: a question, a study story, a diagram and Use it are stored per institute and served again for 0 coins (this changes spec 0016's builder default for story and diagram, after Desk Design rule 2). A practice set (paper, mock) stays fresh; the bank is the reused practice.
- Written answers: the key points are the teacher's rubric lines (one a line, up to 6). The model returns a fixed JSON form (each point covered, partly or missing, and a confidence); anything else, a confidence under 0.7, a failed call (coins back), the desk being off (no coins), or the student asking sends it to the teachers of the student's class. The teacher sees the question, the key points and the answer, never the name, and their mark replaces the model's. The answer is data to the model, never an instruction.
- Plan: open Fix first, then due recall, then the lowest mastery, two topics a day from tomorrow to the day before the test (30 days at most); the last day goes back over the lowest. Stored is only the subject and the test day.
- Not built (D1 and D6, waiting for a book licence): book ingestion, passages and citations, prerequisite links and stepping back, misconception corrections, cross-board links, uploads and their private cache, pre-generation, the monthly re-marking check of the marker against teachers.

**Acceptance criteria**:
- **AC-1**: A bank paper can never be sent (`bank_paper`); a sent paper's question is served only when every send has closed; another institute's or class's topic is refused (`bad_topic`).
- **AC-2**: No question returned to a student before its answer holds the right option or a tag; the answer returns the right option.
- **AC-3**: A wrong answer opens one Fix item; a right answer to it fixes it; recall offers a topic only when its next day has come.
- **AC-4**: `desk.answered` holds the topic id, right, the mode, whether first seen 7 or more days before, whether wrong before, and the seconds; `desk.mastered` is written once a topic.
- **AC-5**: Written marking: 2 coins on the way to the model and one count of the daily cap; the teacher queue shows no name or member id; a teacher of another class or institute cannot mark; a marking that never comes back is given up by the minute sweep (coins back, to the teachers).
- **AC-6**: The desk is closed by the exam lock for every Learn function, and distress words get the care text with nothing stored.
- **AC-7**: Everything is in the student's download and erased with them (`learnRoom.ts`); `questionStats` holds no student.
- **AC-8**: The words are drafts under `DESK_WORDS_APPROVED` and no line labels or ranks a student.

## Cost on the free plan (house spec 0029)

No cron and no timer job: the stuck marking check rides on the desk's existing minute check (`sweepPendingHasWork`). Each answer is one mutation that reads about 12 rows and writes about 6, and the Brain recomputes that day once a minute while answers arrive. Estimate for one class of 40 that answers 10 questions each school day: about 9,000 calls for answers and 3,000 for the Brain's passes a month, and about 300 MB of reads and writes, inside the 1 GB but the largest single use of it. More than about two classes at that use would need the paid plan or one event per round instead of per answer: ask the owner before inviting them. The model: no new spend beyond the coins.

## Tests

`learn.test.ts` (the pure rules, the bank's opening rule, practice, Fix, recall, held once, the exam lock and other classes, a paper's answers, written marking on all its paths, the plan, search and the map, export and erase), `desk.test.ts` (story and diagram stored once and reused), `learn-words.test.ts`. Browser: `pnpm learn:check` (9 steps: the map and search, a practice round, Fix, a written answer marked by the demo teacher with no name, the plan, a resolved doubt, the feels check, a film's checks, Progress). Sweep: `dhi-learn`, `dhi-learn-topic`, `dhi-learn-round`, `staff-papers`, `dhi`. axe: clean at 1280 and 360.

## Still open

- A book licence (D1 ingestion, D6 uploads and pre-generation) and its storage and cost estimate.
- The words are drafts until the owner approves them.
