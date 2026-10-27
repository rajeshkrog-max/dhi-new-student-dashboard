# Owner gates

Everything only the owner can close before real students enter. Written 2026-10-27 in Phase 3 of the production run. Each switch below is a code constant, so flipping one is a small commit the builder makes only on the owner's yes. Until every gate is closed, only made up people are loaded, and the pilot starts with one class of made up students (the owner's decision, 2026-10-26).

## Word approvals

Read the words in one sitting: `docs/launch/words/english.md` (259 lines) and `docs/launch/words/hinglish.md` (102 lines), grouped by room. While a switch is false, its screen shows a small draft note.

| | Gate | File and constant | Flipping it to true changes | Decides |
|---|---|---|---|---|
| [ ] | The house notice and the parent wording | `packages/backend/convex/consentText.ts`, `HOUSE_WORDS_APPROVED` | the draft note leaves the consent screen and Your data. A change of the words themselves is a new notice version, and every student agrees again | owner, after the legal check |
| [ ] | Mood room words, the guna lines and tips | `src/lib/dhi/mood-words.ts`, `MOOD_WORDS_APPROVED` | the draft note leaves the mood room | owner |
| [ ] | Habits room words | `src/lib/dhi/habits/words.ts`, `HABIT_WORDS_APPROVED` | the draft note leaves the habits room | owner |
| [ ] | Sleep room words | `src/lib/dhi/sleep-words.ts`, `SLEEP_WORDS_APPROVED` | the draft note leaves the sleep room | owner |
| [ ] | The Brain report (English and Hinglish) | `src/lib/dhi/brain-words.ts`, `BRAIN_WORDS_APPROVED` | the draft note leaves Progress | owner, after the Hinglish read |
| [ ] | The weekly parent page and the link lines | `src/lib/dhi/parent-words.ts`, `PARENT_WORDS_APPROVED` | the draft note leaves the parent page | owner, after the Hinglish read |
| [ ] | The desk's screen words and its instructions to the model | `src/lib/dhi/desk-words.ts` and `packages/backend/convex/deskRules.ts`, `DESK_WORDS_APPROVED` (both) | the draft note leaves the desk | owner |

## The Brain's own gates

| | Gate | File and constant | Flipping it changes | Decides |
|---|---|---|---|---|
| [ ] | The research behind each pattern | `packages/backend/convex/brainRules.ts`, `PATTERN_SOURCES_CONFIRMED` (false); the sources are in `docs/specs/house/0020-brain-patterns-lamps-and-report/sources.md` | the patterns stop saying they are not yet checked by DHI; a pattern the team removes is taken out first | DHI team, then owner |
| [ ] | The meals chain | `packages/backend/convex/brainRules.ts`, `FOOD_PATTERN_ON` (false; kept off on 2026-10-22) | the Brain starts to show the packaged and fried meals pattern. Recommended: keep off | owner |
| [ ] | The builder's default numbers | `VIVEKA_FULL` (four films in four weeks) in `brainRules.ts`; `CHAT_KEEP_MS` (chat kept 30 days) and the other `*_KEEP_MS` in `retention.ts`; the Brain's thresholds in `brainRules.ts` | each is one number; a change is a commit | owner |

## Outside the code

| | Gate | What is needed | Decides |
|---|---|---|---|
| [ ] | Rotate the OpenAI key | The key pasted in chat is on the development deployment only and appears nowhere in code, docs, build output or git history (scan of 2026-10-26). Revoke it at OpenAI, make a new key, and set the new one on **production only**: `npx convex env set OPENAI_API_KEY ... --prod` (typed by the owner, never pasted in chat). Then set a fresh one on development too | owner |
| [ ] | The legal check | `docs/launch/legal-check.md`: verifiable parental consent through the school's record (DPDP), the missing desk line in the notice, the production region in the notice, the retention numbers | owner and counsel |
| [ ] | A Hinglish speaker's read | `docs/launch/hinglish-reader.md` | owner names the reader |
| [ ] | Food catalog licences | The catalog starts empty; each source's licence is checked before any item is loaded (`foods.ts`). Students can add their own dishes, and DHI can publish them | owner |
| [ ] | Cloudflare accounts | A Cloudflare account that owns `dhirise` (for `pnpm deploy:house`), and a Cloudflare Stream account for the films (a stand-in host is used until then, `moduleRules.ts`) | owner |
| [ ] | The blog tag list | The tags a post may carry: `POST_TAGS` in `packages/backend/convex/blogRules.ts`, now study, reflection, question, idea (the first set) | owner |
| [ ] | The pilot class and its teacher | One class of about 10 made up students first, then a real class (spec 0021) | owner and the institute |
| [ ] | The desk opens | `DESK_LIVE=true` on production, after the new key is set and `DESK_WORDS_APPROVED` is true; the daily cap stays 300 (`DESK_DAILY_CAP`) and 20 a student | owner |
| [ ] | Moderation without a record | A teacher reads the study hour chat of their own classes, and a DHI admin the reported messages of every institute, without a `staffRead` record (the security review of 2026-10-27). Confirm it fits "a DHI admin never sees room content" | owner |
| [ ] | Your own browser pass | Every room with made up students, on a phone and a computer | owner |
| [ ] | Each production step | A fresh yes for committing, pushing, the backend deploy and the Worker deploy, each in its own message (`docs/launch/PROGRESS.md`) | owner |

## The first class pilot checklist (spec 0021)

From `docs/specs/house/0021-first-class-pilot.md`. The builder's item (7) is done on development on 2026-10-26 and 2026-10-27; the rest is yours and the school's.

| | Item | Who |
|---|---|---|
| [ ] | 1. Approve the notice, the parent wording and the room words (above) | owner |
| [ ] | 2. The legal check, and the production region in the notice | owner and counsel |
| [ ] | 3. Production setup: `ERASURE_HASH_SECRET` set, the first DHI admin made with `bootstrap:dhiAdmin`, `TEST_SIGNIN_ENABLED` off | owner |
| [ ] | 4. The pattern sources and the meals chain (above) | DHI team and owner |
| [ ] | 5. Choose one class and its teacher; invite the teacher and about 10 students by Google email | institute admin |
| [ ] | 6. For each student under 18, record the parent's written consent on the school's side | institute admin |
| [x] | 7. Run the checks: the backend suite, the copy tests, every browser proof, lint, typecheck, `build:all` (development, see `PROGRESS.md`) | builder |
| [ ] | 8. A fresh yes for the production deploys; the Cloudflare account | owner |
| [ ] | 9. Practise the pause: pause the pilot class, see a student refused, resume, see them back | institute admin and owner |
| [ ] | 10. Two weeks in: the supervised review sessions, with the fixes made before the second class | teacher and a DHI staff member |
| [ ] | 11. The class enters; counseling is not part of the pilot, so the support message names the helpline only | owner |
