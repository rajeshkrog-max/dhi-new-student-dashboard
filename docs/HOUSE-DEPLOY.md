# DHI house: the production deploy checklist

Rewritten 2026-10-27 after the production rehearsal on the development deployment (`docs/launch/PROGRESS.md`, Phase 4). **Nothing here has been run against production.** Each step marked "owner's yes" needs the owner's fresh, explicit yes in that message. Production is the Convex deployment `abundant-caiman-975`; development is `proper-camel-616`. The settings, recovery and watching details are in `docs/launch/HARDENING.md`, and the owner's gates in `docs/launch/OWNER-GATES.md`.

## 0. Before any real student: the owner's gates

Every gate in `docs/launch/OWNER-GATES.md`: the word approvals (all false), the legal check (including the missing desk line in the notice and the production region), the Hinglish read, the pattern sources and the meals chain, the food catalog licences, the Cloudflare accounts, the blog tag list, the pilot class, the new OpenAI key on production only, and the owner's own browser pass. The pilot starts with one class of made up students.

## 1. What this branch changes in production, so you can judge the risk

- **Convex schema: additive only.** 44 new tables (people and roles, the event log, consent and the access record, every room, the Brain, the desk, the parent page) and new indexes; nothing removed or renamed against `main`. The running funnel is not affected.
- **New cron jobs**, starting with the backend deploy: drop idle study hour seats (every minute), close due exam sittings (every minute), update the Brain's daily values (every minute), return coins of unanswered desk questions (every minute), end idle desk sittings (every minute), rebuild stale Brain days (every 10 minutes), close yesterday for the Brain (22:45 UTC), check the Brain's stored days (23:15 UTC), and the house retention sweep (22:00 UTC: view records after 3 years, study hour chat after 30 days, desk answers and parent links after 90 days, a removed member after 12 months).
- **One change to shared funnel code**: the daily storage clean up (`reportCopy.sweep`) now also leaves alone files held by profile pictures and blog photos.
- **`zod` 4.6.7** (from 4.6.5): a patched version of the library Better Auth uses to check sign in requests.
- **The notice is `house-v2`.** Nobody real has agreed to anything yet. A change to the notice (the legal check asks for a desk line) is a new version, and every student agrees again.
- **The DHI desk is live in the code** and answers only when `DESK_LIVE` is true and `OPENAI_API_KEY` is set. Each student has 60 coins a month and 20 questions to the model a day; the whole deployment has 300 a day (`DESK_DAILY_CAP`).
- **Brain formula version 7** (`METRIC_VERSION`); production holds no Brain days yet.

## 2. Snapshot, then the settings: owner's yes

```bash
cd packages/backend
# 1. A snapshot of production, to a folder outside the repo (it holds personal data: keep it private, delete it when the pilot has settled):
npx convex export --prod --path <folder outside the repo>
# 2. The settings. The command shows values, so run it where nobody can see the screen:
npx convex env list --prod
#    Must be set:   ERASURE_HASH_SECRET (its own value), OPENAI_API_KEY (the NEW key, only when the desk is to open), BETTER_AUTH_SECRET, GOOGLE_*
#    Must be unset: TEST_SIGNIN_ENABLED (or "false"). The test sign in must never be on in production.
#    DESK_LIVE: unset until the owner opens the desk. DESK_DAILY_CAP: unset (300) or the owner's number.
#    The funnel's own variables are already set and are not touched (table in docs/launch/HARDENING.md).
```

## 3. Deploy the Convex backend (production): owner's yes

```bash
pnpm --filter @dhi/backend deploy:convex
# It shows the schema changes before applying them: stop if it lists a removed table, field or index.
# It also builds the funnel with the production address (the package's deploy:convex script).
npx convex run bootstrap:dhiAdmin '{"email":"<the owner Google email>","name":"<owner>"}' --prod   # the first DHI admin, once
```

Then, in the Convex dashboard for production: the cron jobs above are listed, the Logs show no errors, and the new tables exist (empty is right).

Smoke test: the funnel still signs in and shows a report; the cron list is right; `npx convex env list --prod` still has `TEST_SIGNIN_ENABLED` unset.

## 4. Deploy the house Worker (production): owner's yes

```bash
wrangler login            # the account that owns dhirise
pnpm deploy:house         # builds with the production address and the test sign in off, refuses a build that holds the development address
```

The rehearsal ran `pnpm deploy:house --dry-run` on 2026-10-27: the build was clean and wrangler would take 17 routes on dhirise.com (the front door, `/enter`, `/dashboard`, `/join`, `/staff`, `/home`, `/parent`, `/assets/*`, and each folder of `public/`); the interview and `/api/*` stay with the funnel (spec house/0008).

Smoke test: `https://dhirise.com/enter` shows the Enter screen; the funnel's `/dhiinterviews/` still works.

## 5. First look, with the owner

The rehearsal ran these steps on development on 2026-10-27 with made up people (`pnpm rehearsal:check`, 9 of 9; the DHI admin's part through `rehearsalProof:setup`, because a test inbox can never be a DHI admin).

1. Open the front door, sign in with the owner's Google account, press Join: the staff area opens as a DHI admin.
2. Make the first institute and a class, and invite an institute admin, a teacher and two students (one marked under 18): made up people with real inboxes you control.
3. The institute admin and the teacher join and land in the staff area.
4. The under 18 student joins, reads and agrees to the notice, and waits; the institute admin records the parent's consent on Parent consent; the house opens by itself.
5. The adult student joins and agrees. As each student, open every room once: Home, Blog, Exams, Meal Tracker, Mood Tracker, Habit Tracker, Sleep, Modules, DHI desk (only answers once the desk is opened), Study hour, Counseling (a placeholder), Progress, Your data.
6. As the DHI admin: set a study hour; add a film (a stand-in host); publish a student's custom dish; check today's desk count on the desk screen.
7. Pause the class's logins and resume them (the pilot's safety stop, spec house/0021).
8. As the adult student: download your data, then erase, and confirm that the same email cannot be invited again.

## 6. If something goes wrong

- **A class has a problem**: Staff, Classes, `Pause logins`. Students see "Your access is paused". Resume when fixed. Nothing they own is touched.
- **The desk misbehaves or costs too much**: `npx convex env set DESK_LIVE false --prod` (owner's yes) stops the model at once with no deploy; `DESK_DAILY_CAP=0` stops new questions and keeps stored answers.
- **The house Worker is wrong**: `wrangler rollback` to the previous version. The schema is additive, so the older Worker runs against the newer backend.
- **The backend is wrong**: deploy the previous commit again (`pnpm --filter @dhi/backend deploy:convex` from it). Restoring the snapshot (`npx convex import --prod --replace`) is the last resort, only if data was damaged.
- **A bad Brain number**: the daily values are rebuilt from the events. Bump `METRIC_VERSION` in `metricRules.ts`, deploy, and the stored days are rebuilt in the background (10 minutes a pass).
- **The Brain's nightly check reports a mismatch**: the log line is `brain.reconcile: n of m stored days differ`. Run `npx convex run brainRollup:closeDay '{"day":"YYYY-MM-DD","cursor":null}' --prod` (owner's yes) for the day.

## 7. What stays off in production

`TEST_SIGNIN_ENABLED` (the test sign in and every `*Proof` helper refuse without it, `proofGuard.test.ts`), the demo institute seed, the meals chain of the Brain, the desk until the owner opens it, and any word that is still a draft. Counseling is not built.
