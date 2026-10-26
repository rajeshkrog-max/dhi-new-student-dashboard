# DHI house: the one go plan for production

Written 2026-10-26. This is the plan for finishing everything that is left in one long run, and the prompt to paste to start it. It builds on `docs/HOUSE-DEPLOY.md` (the deploy checklist, written 2026-10-22 and now out of date: it still calls the desk a coming soon page).

## How the run is shaped

One run does all the work the code and the checks can do, then stops at a ready report. It cannot do the owner's gates, and it must not deploy on its own. So it is one go up to the door, then one fresh yes for each production step.

| Phase | What it does | Ends with |
|---|---|---|
| 0. Preflight | Reads the context, runs every check once, writes the progress file, proposes the commit slices | Your yes to commit (no push) |
| 1. Close every row | Verify, test, fresh model review, document and sync, row group by row group | Findings fixed, boxes ticked in the scope |
| 2. Harden for production | Settings for each deployment, secrets, spend limits, security and privacy sweeps, load and race proofs, CI, rollback | A hardening report with every gap named |
| 3. Owner packet | One file with every gate, every drafted word to read, and what flipping each switch does | `docs/launch/OWNER-GATES.md` |
| 4. Rehearsal | The whole deploy sequence on the development deployment, and a dry run of the Worker | A rehearsal log |
| 5. Ready report | Everything above in plain words | You decide |
| 6. Production | Only after your fresh yes, one step at a time, with a smoke test after each | The first look with you |

## What only you can do (the run lists these, it cannot close them)

1. Rotate the OpenAI key you pasted in chat, and set a new key on production only.
2. Approve the drafted words (house, mood, habits, sleep, Brain, parent, desk). The switches are code constants, so flipping one is a commit.
3. The legal check on parent consent (DPDP) and naming the production Convex region in the notice.
4. A Hinglish speaker reads the Hinglish lines.
5. Confirm `PATTERN_SOURCES_CONFIRMED` and decide `FOOD_PATTERN_ON` (kept off).
6. Licence checks before the food catalog is loaded.
7. A Cloudflare account that owns `dhirise`, and a Cloudflare Stream account for the films.
8. The blog tag list, and the pilot class and teacher.
9. Your own browser pass, with made up students, on every room.
10. A fresh yes to commit, to push, and to each production step.

## Settle these before you paste the prompt

The run asks decisions one at a time, but these four change the whole plan, so answer them first (put the answers on the first line of the prompt):

1. **Commits:** 225 files are uncommitted on `house/people-roles-invites`. Recommended: one commit per row group (about 8), then one branch to review. The other option is a single commit.
2. **Spend cap on the desk:** the run needs a ceiling for the OpenAI bill. Recommended: the 60 coins a month per student stays, plus a daily cap for the whole deployment that you name (a number of questions a day).
3. **Where the rehearsal runs:** on the development deployment (Recommended), or on a new third deployment that copies production settings.
4. **Which flags stay false at launch:** recommended is the owner gates above stay false until each is approved, and the pilot runs with one class of made up students first.

## The prompt

Paste everything between the lines.

---

You are finishing the DHI student house for production. Read `AGENTS.md`, `docs/HOUSE-DEPLOY.md`, `BACKEND.md`, `docs/scope/house/index.md` and the AGENTS.md of the folder you work in before you start. Today's decisions: [PUT YOUR FOUR ANSWERS HERE].

**Standing rules, never broken.** No git push and no production deploy, `--prod` command or production env change without my fresh, explicit yes in that same message. Pushing to the development deployment `proper-camel-616` with `npx convex dev --once` is allowed. Commit only after I say yes to the commit plan. Edit files with the line ending preserving helper (each old string exactly once, CRLF kept). Never label a student by ability or rank. The Brain is the student's alone except the weekly parent page (spec house/0022): no staff view, no staff class totals. Use only made up students and say so. Ask decisions one at a time with AskUserQuestion, recommended first. Plain words, no dashes as punctuation in specs and replies. Report outcomes faithfully: a failing check is reported with its output, a skipped step is said to be skipped.

**Keep a progress file.** Create `docs/launch/PROGRESS.md` first and update it after every step (phase, row group, what passed, what failed, what is open). If the conversation is compacted, read it before doing anything else.

**Phase 0. Preflight.** Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm look:check`, `pnpm test`, `pnpm build:all`, and in `packages/backend` `npx vitest run` and `npx tsc --noEmit`. Record the baseline (lint is 5 warnings and 0 errors, look:check 27 hits, backend 1288 tests). Run `git status` and propose the commit slices, one per row group below. Stop and ask for my yes to commit. Do not push.

**Phase 1. Close every row.** For each group below, in order, do these steps, and fix what they find before moving on:
1. `/check verify` against the spec, driving the real app on the development deployment with the matching `pnpm *:check` script (`enter:check`, `consent:check`, `mood:check`, `habit:check`, `sleep:check`, `exams:check`, `meals:check`, `modules:check`, `hour:check`, `brain:check`) and `pnpm responsive:sweep`. Where no script exists (desk, parent page, connections, funnel link, move staff), write one in the same style, development only, refusing to run where the test sign in is off.
2. `/test` for gaps. Add the tests that are missing, especially refusals, cross institute reads and the "no staff view of the Brain" scans.
3. `/check review` by a fresh model that did not write the code (spawn a subagent for it). Fix every confirmed finding. List the ones you chose not to fix and why.
4. `/document`, then `/sync`. Tick the boxes in `docs/scope/house/` only for steps that really ran.

Groups: (A) platform rows 2 to 4: people, roles, invites, institutes, move staff, the event log, consent and the access record, the funnel link. (B) health rooms: mood, habits, sleep, meals and the food table. (C) study: papers, exams, modules, blog, study hour and the after session card. (D) the DHI desk, every kind (chat, clarify, write, paper, mock, story, draw), coins, cache, the sweep that returns coins, the draw sanitiser. (E) the Brain: daily values, patterns, lamps, the report, the connections (spec 0023), the parent page. (F) Home and the DHI score, the staff screens, the class pause, the first class pilot checklist (row 24).

**Phase 2. Harden for production.** Produce a report in `docs/launch/HARDENING.md` that names every gap, and fix the ones the code can fix:
- **Settings matrix** for development and production side by side: every Convex and Worker variable the house needs, with set or unset, where it lives and who sets it. At least `ERASURE_HASH_SECRET` (set), `TEST_SIGNIN_ENABLED` (unset or false), `OPENAI_API_KEY` and `DESK_LIVE` (a new key on production only), `DESK_MODEL`, `SHARE_LINK_SECRET`, the Brain switches, the Cloudflare ones. Never print a secret value. Check that no key is in the code, the docs, the git history (scan the history for the pasted OpenAI key pattern) or the build output.
- **Desk spend and abuse:** the per student coins, the hourly limits, the daily deployment cap I named, the exam lock, the minute sweep that returns coins, the model timeout, and what the student sees when the model is down. Add a switch that turns the desk off without a deploy.
- **Authorisation sweep:** a test or script that tries every public function as each role (student of another institute, teacher of another class, institute admin of another institute, DHI admin, counselor, signed out) and proves nothing crosses an institute or reads the Brain. Fix anything it finds.
- **Privacy sweep:** the export holds everything the data map names, erase leaves nothing but what the data map says is kept, no log line holds personal data, no event payload holds free text, the parent page holds only what `weekOf` allows.
- **Schema safety:** show the additive-only diff against production's current schema (new tables and optional fields only, no rename or removal), and list the new cron jobs.
- **Load and races:** run every `*Proof.ts` race check on development and a burst test for sign in, the desk and the study hour. Expect 429 and never 500 on a lost race.
- **Frontend:** `pnpm responsive:sweep` clean at 360, 768, 1024 and 1280 px, `/accessibility-review` on the main screens, the build refuses a development address or an enabled test sign in.
- **Supply chain and CI:** `pnpm audit`, the catalog check, CI green on Node 22.19.0 and 24, the lockfile frozen.
- **Recovery:** a Convex snapshot export step before the production deploy, a written rollback for the backend (redeploy the previous commit, additive schema stays) and for the Worker (`wrangler rollback`), and the switches that turn a room or the desk off.
- **Watching:** what to look at after launch (the Convex logs and dashboard, the cron list, error counts, the desk's coin and spend counts) and who looks.
- Run `/security-review` on the whole branch and fix what it finds.

**Phase 3. Owner packet.** Write `docs/launch/OWNER-GATES.md`: each gate with the exact file and constant, what flipping it changes, who decides, and a checkbox. Extract every drafted word the owner must approve into one file per language under `docs/launch/words/` (English, Hinglish) grouped by room, so they can be read in one sitting without opening the code. Add a short page for the Hinglish reader and one for the legal check (the consent notice, the parent wording, the data kept and for how long).

**Phase 4. Rehearsal.** On the development deployment only: reset to a clean state, run the exact production sequence from `docs/HOUSE-DEPLOY.md` (updated), `demo:seed`, then the first look with made up people (a DHI admin, an institute, a class, a teacher, a parent consented student and an adult student). Run `wrangler deploy --dry-run` for the Worker and show the routes it would take. Update `docs/HOUSE-DEPLOY.md` so it matches reality (the desk is live, the new tables, the new cron jobs, the new variables, the new notice version).

**Phase 5. Ready report.** Stop. Give me one report: what passed, what failed or was skipped, what the fresh reviews found and how each was settled, the gaps in the hardening file, the open owner gates, the risks in plain words, and a go or no go recommendation with the reason. Do not deploy.

**Phase 6. Production, only after my fresh yes for each step.** Ask separately for: committing, pushing, the backend deploy, the Worker deploy. For each step: show the exact command and what it changes, wait for my yes, run it, run the smoke test (sign in, one room, the cron list, the variables, a desk question if the desk is on), record it in `PROGRESS.md`, and stop on the first failure and say so. The order is: snapshot export, production settings check, backend deploy, make the first DHI admin, Worker deploy, the first look with me.

---

## What can still go wrong with one go

- The run is long, so it may be compacted. The progress file is how it carries on. Tell it to read `docs/launch/PROGRESS.md` first if it seems lost.
- Word approval and the legal check can take days. The run does not wait for them: it ends at the ready report with those gates open, and the pilot starts only when you close them.
- A fresh review can find a real problem late. That is the point of it. Budget a fix and a second review for the group it came from.
