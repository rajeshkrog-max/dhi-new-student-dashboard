# Review: group C, the study rooms (house rows 10 to 14 and 16), 2026-10-26

Part of the production run (`docs/PRODUCTION-RUN-PROMPT.md`, Phase 1). Verify ran on the development deployment `proper-camel-616` with made up people only. The review was done by a fresh model that did not write the code.

## Verify

| Check | Result |
|---|---|
| `pnpm exams:check` (papers, exams, blog) | 13 of 13, run twice (a first run under load failed 5 steps on timeouts); 13 of 13 again after the server exam lock |
| `pnpm modules:check` | 5 of 5, and again after the film progress fix |
| `pnpm hour:check` (study hour and the feeling card) | 7 of 7, and again after the review fixes |
| `pnpm responsive:sweep` on the study hour and the sitting scenes | the live study hour shifted (0.06 to 0.15): the seat list rendered nothing while loading and pushed the chat down. It now holds its place; live, away and do not disturb are clean at all four widths |

## Tests added

`studyAccess.test.ts`: every film, study hour, feeling card and blog function that takes no id refuses each staff role, a signed out caller, the gate, a withdrawal, a removal and a paused institute; and a scan of all 43 public functions of the six study files proves each starts with the entry check and then its role check. Plus the cases below.

## Fresh review findings and how each was settled

| # | Finding | Settled |
|---|---|---|
| 1 | A film's progress grew with the time since the last report, so after a pause one call could jump to the end and write the score | Fixed: one report moves the furthest point by at most 30 seconds (`MAX_STEP_SEC`), finish included |
| 2 | The exam lock lived on the screen only: a reload or "Leave for now" freed the other rooms while the sitting stayed open | The owner chose a server lock (2026-10-26): from Start until hand in or the window closes, every other room refuses with `exam_open` (`examLock.ts`, index `paperAttempts.by_memberId_and_status`); the frame reads `exams.sitting` so the menus stay locked after a reload. Your data, consent and the frame stay open |
| 3 | The chat review read the deployment's newest messages, then filtered, so a busy institute pushed another out of view | Fixed: indexes `chatMessages.by_instituteId` and `by_reported` |
| 4 | A pending blog post older than the newest 200 never reached a teacher; the student list could drop approved posts | Fixed: index `blogPosts.by_instituteId_and_status`; pending oldest first; the list is approved posts plus the student's own |
| 5 | The server keeps `b, i, ol, li` while `BACKEND.md` lists `p, br, strong, em` too; line breaks collapsed for readers | Line breaks now show as written (pre line) for readers and reviewers. The tag list follows spec 0014 AC-1; `strong` and `em` are the same marks as `b` and `i`. `BACKEND.md` is left as the owner's brief and the difference is named in the ready report |
| 6 | The hint check is a heuristic | Stronger: an option split by a space or a hyphen, and a small letter after "answer is" at the end of a sentence. It stays a guard on the teacher's own text, not a proof of AC-4 |
| 7 | The download left out the student's own answers | Fixed: the choice and the text of each answer, never the right answer |
| 8 | The seat sweep read at most 500 open seats and never went on | Fixed: pages of 200, it schedules itself for the next page |
| 9 | A class teacher who did not build a paper can mark it but cannot open it | Not changed: marking by the class teacher is on purpose, and nothing leaks. Named for the owner |

Also named for the owner: blog moderation and the chat review show named content to the reviewing teacher without a `staffRead` record; that fits moderation.

A side effect found while verifying: a proof that stops part way (or the sweep's sitting scenes) can leave the demo student in an open sitting, which the server lock now holds. `papersProof:resetDemoSitting` (development only) puts it back, and the sweep and `exams:check` call it.
