# DHI house: the production deploy checklist

Written 2026-10-22, after the whole student house was built on the development deployment. **Nothing here has been run against production.** Deploying needs the owner's fresh, explicit yes for each of the two deploys below, in that message. Production is the Convex deployment `abundant-caiman-975`; development is `proper-camel-616`.

## 0. Before any real student: the owner's gates

Only the owner can close these. The code cannot.

| # | Gate | Where it shows in the code |
|---|---|---|
| 1 | Approve the consent notice and the parent wording | `HOUSE_WORDS_APPROVED` in `packages/backend/convex/consentText.ts` (false) |
| 2 | Approve the drafted words of the Mood, Habits, Sleep rooms and the Brain (English and Hinglish) | `MOOD_WORDS_APPROVED`, `HABIT_WORDS_APPROVED`, `SLEEP_WORDS_APPROVED`, `BRAIN_WORDS_APPROVED` in `src/lib/dhi/` (all false). Each screen shows a draft note until its switch is true |
| 3 | The DHI team reads the Brain's research sources and confirms or removes each pattern | `PATTERN_SOURCES_CONFIRMED` in `brainRules.ts` (false); `docs/specs/house/0020-brain-patterns-lamps-and-report/sources.md` |
| 4 | Decide whether the meals chain ever turns on | `FOOD_PATTERN_ON` in `brainRules.ts` (false; the owner chose to keep it off on 2026-10-22) |
| 5 | Legal check on verifiable parental consent through the school's record (DPDP), and name the production Convex region in the notice | the consent notice |
| 6 | Confirm the numbers that are the builder's defaults: Viveka's four films in four weeks (`VIVEKA_FULL`), the study hour chat kept 30 days (`CHAT_KEEP_MS`), the Brain's thresholds | `brainRules.ts`, `retention.ts` |
| 7 | A Hinglish speaker on the team reads the Hinglish lines | `src/lib/dhi/brain-words.ts` |
| 8 | A Cloudflare account that owns `dhirise` (for `pnpm deploy:house`), and a Cloudflare Stream account for the Modules films (a stand-in host is used until then) | `wrangler.jsonc`, `moduleRules.ts` |
| 9 | The food catalog: load it only after each source's licence is checked (it starts empty; students can add their own dishes, and DHI can publish them) | `foods.ts` |

## 1. What this branch changes in production, so you can judge the risk

- **Convex schema: additive only.** New tables (class pauses, papers and exams, the blog, foods and meals, films, the study hour, seats and chat, sleep nights, the Brain's days, hides and state) and new optional fields (`classes.pausedAt`, `blogPosts.publishedAt`, `paperAttempts` answers, hints and acceptance, `paperQuestions.hint`) and indexes. No field or table is removed or renamed, so the running funnel is not affected.
- **New cron jobs** (they start when the backend is deployed): the study hour seat sweep (every minute), the exam window close sweep (every minute), the Brain's day update (every minute), its morning close (04:15 India time), its nightly check (04:45), its stale rebuild (every 10 minutes), and the daily house retention sweep (now also deletes study hour chat older than 30 days).
- **One change to shared funnel code**: the daily storage clean up (`reportCopy.sweep`) used to delete every stored file older than a day that was not a report copy. It now also leaves alone files held by profile pictures (`avatars.storageId`) and blog photos (`blogPosts.photoId`). Before, a profile picture file older than a day was not protected from it, and a blog photo would not have been either. The funnel's own app files (`apps/joining/`) are unchanged.
- **The notice changes to `house-v2`**: it now says what really happens (a teacher reads each blog post before the class, classmates read approved posts, the study hour chat is read by the others in the hour and by teachers and the DHI team, and is deleted after 30 days). Everyone who agreed to `house-v1` is asked to agree again before the next room opens. Only made up people hold a `house-v1` record, so nobody real is affected, but on the development deployment run `npx convex run demo:seed` after a push so the demo students agree again. The words are still drafts (gate 1).
- **Brain formula version 2** (`METRIC_VERSION`): stored daily values of version 1 are rebuilt from the events by the stale rebuild job, ten minutes at a time. Nothing is lost.
- **Events**: `meals.logged` is now version 2 (adds the processing tag); version 1 events stay readable.

## 2. Deploy the Convex backend (production): needs the owner's yes

```bash
cd packages/backend
# 1. Check the environment variables first. The command shows values, so run it where nobody can see the screen:
npx convex env list --prod
#    Must be set:   ERASURE_HASH_SECRET   (a long random value; erase answers `erase_not_configured` without it)
#    Must be unset: TEST_SIGNIN_ENABLED   (or "false"). The test sign in must never be on in production.
#    The funnel's own variables are already set and are not touched.
# 2. Deploy (this also builds the funnel with the production address; see the package's deploy:convex script):
pnpm --filter @dhi/backend deploy:convex
# 3. Make the first DHI admin (once), with the owner's own Google email:
npx convex run bootstrap:dhiAdmin '{"email":"owner@example.com","name":"Owner"}' --prod
```

Then, in the Convex dashboard for production: check that the cron jobs above are listed, and that `brainState` and `brainDays` exist (empty is right).

## 3. Deploy the house Worker (production): needs the owner's yes

```bash
wrangler login            # the account that owns dhirise
pnpm deploy:house         # builds with the production backend address, refuses a build that holds the development address or an enabled test sign in
```

The house serves only its own paths on dhirise.com; the interview and `/api/*` stay with the funnel (spec house/0008).

## 4. First look, with the owner

1. Open the front door, sign in with the owner's Google account, press Join: the staff area opens as a DHI admin.
2. Make the first institute, a class, and invite one teacher and one student (made up people, with real inboxes you control).
3. As the student: agree to the notice (for an under 18 student the school records the parent's consent first), then open every room once. Expect: Home, Blog, Exams, Meal Tracker, Mood Tracker, Habit Tracker, Sleep, Modules, DHI desk (a coming soon page), Study hour, Counseling (a placeholder), Progress, Your data.
4. As the DHI admin: set a study hour; add a film (a stand-in host); publish a student's custom dish.
5. Pause the class's logins and resume them (the pilot's safety stop, spec house/0021).
6. Download your data and erase one test student, and confirm the erase receipt.

## 5. If something goes wrong

- **A class has a problem**: pause its logins in Staff, Classes (`Pause logins`). Students see "Your access is paused". Resume when fixed. Nothing they own is touched.
- **The house Worker is wrong**: `wrangler rollback` to the previous version. The Convex schema is additive, so the older Worker still runs against the newer backend.
- **A bad Brain number**: the daily values are rebuilt from the events. Bump `METRIC_VERSION` in `metricRules.ts`, deploy, and the stored days are rebuilt in the background (10 minutes a pass).
- **The Brain's nightly check reports a mismatch**: `brainState` (key `reconcile`) holds the counts; the log line is `brain.reconcile: n of m stored days differ`. Run `npx convex run brainRollup:closeDay '{"day":"YYYY-MM-DD","cursor":null}' --prod` for the day to recompute it.

## 6. What stays off in production

`TEST_SIGNIN_ENABLED` (the test sign in and every `*Proof` helper refuse to run without it), the demo institute seed, the meals chain of the Brain, and any word that is still a draft. Counseling, the DHI desk model and the coin wallet are not built (spec house/0016 is on hold).
