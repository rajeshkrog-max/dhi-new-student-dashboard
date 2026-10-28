# Prompt for the completion run

Paste everything below the line into a new session. Written 2026-10-28 at the end of the topic tags and free plan run (origin at 9cff3c1).

---

Continue the DHI house production run on branch house/people-roles-invites (repo F:\3rd drive files\Dhi\Web App). Goal of this run: build every feature still missing from the scope, the Master Spec and the Desk Design, so the only things left are the owner's own gates. Read docs/launch/PROGRESS.md first, then AGENTS.md, packages/backend/convex/AGENTS.md, src/components/dhi/AGENTS.md, scripts/AGENTS.md, docs/scope/house/index.md, and the three PDFs in docs/ (pdftotext works; the Master Spec's metric table and "New data each room must capture", and the Desk Design's modes table and "Build order" D1 to D6).

STANDING RULES (unchanged):
- No git push, no production deploy, no --prod command and no production env change without my fresh, explicit yes in that same message. `npx convex dev --once` to the development deployment (proper-camel-616) is allowed. A change on the shared Stream app (dev and prod use one app) also needs my yes.
- Commit only after I say yes to a commit plan. Git stores every file as LF; check `git ls-files --eol` after each commit. A key scan of the staged files before each commit.
- Never label a student by ability or rank. Scores are growth marks. The Brain is the student's alone (only the weekly parent page, spec house/0022). The one exception to "a DHI admin never sees room content" is study hour call recordings (spec house/0027); do not widen it. No staff view of the Brain, and no school report action that reads it (CR2 to CR4 stay out).
- Use only made up people and say so. Keys (OpenAI, Stream) are set on dev and prod. Never write them into code, git, docs or logs, never print them, and do not ask me to rotate them.
- Ask decisions one at a time with AskUserQuestion, recommended option first, and tell wmux (`wmux report-agent --blocked ... --choices`, then `--unblocked`; the CLI is at "C:\Users\vaibh\AppData\Local\Programs\wmux\resources\cli-bin/wmux"). Plain words, no dashes as punctuation in specs and replies. Report faithfully: a failing check comes with its output, a skipped step is called skipped.
- For documentation use your own WebSearch and WebFetch, not the wmux browser. Use the installed Stream skills for Stream code, and read `packages/backend/convex/_generated/ai/guidelines.md` before Convex code.
- Before every deploy: a snapshot to F:\3rd drive files\Dhi\snapshots\, a dry run that shows only additions (the empty "Change the server's version for Node.js actions" line with no version on either side is a known CLI quirk, house spec 0029), then the deploy, a smoke test, and `pnpm --filter dhirise build` afterwards so the funnel points back at development.
- The free plan (house spec 0029): 1,000,000 calls and 1 GB of reads and writes a month, team wide. Never add a cron that runs every minute; a frequent job adds its `*HasWork` check to `minuteTick.ts`. A timer job stops after one indexed read when idle and never rereads the same rows. Model pre-generation, embeddings, vector search and file storage all count: estimate the monthly cost of each new feature in its spec, and ask me before anything that could pass the free plan.

WHERE WE ARE (all committed, pushed and live; backend at 9cff3c1, Worker afa2494d):
- Every scope row's code is built: people and invites, the event log, consent, the look, mood, habits, sleep, meals, papers, exams, blog, films, the study hour and its call, the desk (chat, clarify, write, paper, mock, story, diagram, the care text, coins, the cache, the daily cap), the feeling cards with subject and topic taps, the Brain (43 stored measures, patterns, lamps, Progress, all six connections), Home, the parent page, counseling, the school report, the staff houses.
- Sign in stays Google only (owner, 2026-10-28). Keys are not rotated (owner, 2026-10-27).
- Checks at the last run: backend 1398 of 1398, house 199 (4 skipped) and 103, funnel 321, typecheck and lint clean (5 baseline warnings), look:check in baseline.
- Uncommitted: one row in docs/launch/PROGRESS.md, two lines in docs/scope/house/index.md (counseling built, sign in closed) and this prompt file (docs/launch/COMPLETION-PROMPT.md). Fold them into the first commit.

WHAT IS LEFT TO BUILD (ask the decisions first, one at a time, then build in this order):

1. The 19 Master Spec measures not stored yet. Group them by the data they need and build the ones the rooms can already feed first:
   - From data that exists now: E04 stress level (the E02 plus E03 share as a band word, never a score shown to staff), E07 when stress shows (by the Master Spec's contexts: the day before a paper, after 3 or more study hours), H09 the forgiving streak, A08 answer pace (seconds per multiple choice answer, if the sitting keeps answer times; add them if not), A11 desk time by subject (from the tagged sittings, house spec 0028), A07 why answers went wrong (misread from the paper author's tags, careless by the Master Spec rule, concept for the rest), A20 the day 21 matched paper, E17 asked for help (a count, never shown as a rank).
   - Needing a small new input: A03 understanding (a teacher rubric of 0 to 4 on each written answer when marking), H10 habit feels (the weekly four question self check), A16 and A17 module check (two check questions after each academic film, tagged to its topic), A19 help given (a blog comment marked helpful), A18 doubts resolved (a desk doubt marked resolved).
   - Needing the Desk Design steps below: A04 recall after 7 days, A05 old mistakes, A13 recall rounds, A09 topics mastered, A14 weak topics studied on the desk.
   Each new measure: its formula in `metricRules.ts`, a `METRIC_VERSION` bump, the rebuild, tests, and whether it feeds a lamp (ask me; the default is a plain measure that feeds no lamp, like X02).

2. The Desk Design steps D1 to D6 not built. Ask first: the book rights (which books DHI may ingest; nothing copyrighted without a licence), the boards (CBSE only first is the default), who reviews generated content, and the cost ceiling per student a month.
   - D3 question bank and practice: questions with subject and topic tags (reuse `paperTopics`), MCQ practice marked by code, Fix (go back over every wrong answer), the recall schedule at 1, 3, 7 and 21 days. This feeds A04, A05, A13.
   - D4 the modes not built: Use it (real life uses), Plan (a study plan for a test), Fix and Remember as desk modes, and topic search. Every mode reads the cache first.
   - D5 mastery: a per student topic state (levels from answers, never shown as a rank), question picking by level, written answer marking by the model against the teacher's key points with a teacher queue (the teacher's mark replaces the model's). This feeds A09 and A14.
   - D1 the knowledge map and library, and D6 uploads (private to the student, cached only for them, text treated as data) and pre-generation: only after the book rights answer, and with a storage and cost estimate against the free plan. If the answer is no licence yet, build D1 as the map of topics only (from `paperTopics` and the teachers' syllabus), with no ingested books.

3. Row 24, the first class pilot: finish its checklist in docs/specs/house/0021-first-class-pilot.md with everything the builder can do (the rehearsal, the monitoring list in HARDENING.md, the pilot class set up on development), and list what only I can do.

4. Housekeeping: run /scope to reconcile the scope rows that say "in-progress (built)" against the repo, so a row whose code is done and whose only open item is an owner gate says so plainly. Update the words export (`node scripts/words-export.mjs`) and OWNER-GATES.md for every new words file and gate.

For each feature: build, tests, a browser proof (a new `*:check` script where a screen changes), the responsive sweep of its screens, an axe pass (the earlier axe script fetched axe-core 4.10.2 from cdnjs; I allow it), the spec and docs, then a commit plan, then push, backend deploy and Worker deploy, each on its own yes. Batch the commits and deploys sensibly: one commit pair and one deploy round per group above, not per measure.

The dev server may still be running on 8080. If the port is busy, stop that process by its PID first and then run `pnpm dev`. Before a proof that needs an open study hour, run `pnpm --filter @dhi/backend exec convex run hourProof:openNow '{"minutes":30}'`.

OPEN FOR ME (remind me at deploy time, do not act): the notice needs lines for the desk, counseling and the study hour call (docs/launch/legal-check.md); every `*_WORDS_APPROVED` gate is false; the Cloudflare Web Analytics beacon is blocked by the content policy (my choice); the food catalog licences; a Cloudflare Stream account for the films; the Convex usage page (team subs-dhi) to check a week after 2026-10-28.
