# Owner gates

Everything only the owner can close before real students enter. Written 2026-10-27 in Phase 3 of the production run. Each switch below is a code constant, so flipping one is a small commit the builder makes only on the owner's yes. Until every gate is closed, only made up people are loaded, and the pilot starts with one class of made up students (the owner's decision, 2026-10-26).

## Word approvals

Read the words in one sitting: `docs/launch/words/english.md` (477 lines, with counseling, the school report, the staff houses, the study hour call and the topic and subject taps since 2026-10-27) and `docs/launch/words/hinglish.md` (114 lines), grouped by room. While a switch is false, its screen shows a small draft note. **All of them were set to true on 2026-10-28 by the owner's answer**; a change of words after this is the owner's to approve again.

| | Gate | File and constant | Flipping it to true changes | Decides |
|---|---|---|---|---|
| [x] | The house notice and the parent wording | `packages/backend/convex/consentText.ts`, `HOUSE_WORDS_APPROVED` | the draft note leaves the consent screen and Your data. A change of the words themselves is a new notice version, and every student agrees again | owner, after the legal check (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | Mood room words, the guna lines and tips | `src/lib/dhi/mood-words.ts`, `MOOD_WORDS_APPROVED` | the draft note leaves the mood room | owner (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | Habits room words | `src/lib/dhi/habits/words.ts`, `HABIT_WORDS_APPROVED` | the draft note leaves the habits room | owner (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | Sleep room words | `src/lib/dhi/sleep-words.ts`, `SLEEP_WORDS_APPROVED` | the draft note leaves the sleep room | owner (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | The Brain report (English and Hinglish) | `src/lib/dhi/brain-words.ts`, `BRAIN_WORDS_APPROVED` | the draft note leaves Progress | owner, after the Hinglish read (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | The weekly parent page and the link lines | `src/lib/dhi/parent-words.ts`, `PARENT_WORDS_APPROVED` | the draft note leaves the parent page | owner, after the Hinglish read (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | The desk's screen words and its instructions to the model, with the Learn panel (house spec 0031) and the marking instruction | `src/lib/dhi/desk-words.ts`, `src/lib/dhi/learn-words.ts`, `packages/backend/convex/deskRules.ts` and `learnRules.ts` (`MARK_SYSTEM_PROMPT`), `DESK_WORDS_APPROVED` (both files) | the draft note leaves the desk | owner (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | The study hour call's words | `src/lib/dhi/hour-call-words.ts`, `HOUR_CALL_WORDS_APPROVED` | the draft note leaves the call card and Hour calls | owner, after the legal check (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | The staff houses' words | `src/lib/dhi/staff-words.ts`, `STAFF_WORDS_APPROVED` | the draft note leaves Home, Overview and Counselors | owner (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | The school report's words | `src/lib/dhi/school-words.ts`, `SCHOOL_WORDS_APPROVED` | the draft note leaves the school report | owner (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |
| [x] | Counseling words, the recording notice and the helpline | `src/lib/dhi/counsel-words.ts`, `COUNSEL_WORDS_APPROVED` | the draft note leaves the Counseling room and the counselor's Sessions | owner, after the legal check (closed 2026-10-28: the owner approved every words gate; the notice is house-v3, which adds the desk, counseling and the study hour call) |

## The Brain's own gates

| | Gate | File and constant | Flipping it changes | Decides |
|---|---|---|---|---|
| [ ] | The research behind each pattern | `packages/backend/convex/brainRules.ts`, `PATTERN_SOURCES_CONFIRMED` (false); the sources are in `docs/specs/house/0020-brain-patterns-lamps-and-report/sources.md` | the patterns stop saying they are not yet checked by DHI; a pattern the team removes is taken out first | DHI team, then owner (still open on purpose: the builder recommends confirming only after DHI reads each source; Progress keeps saying the patterns are not yet checked) |
| [ ] | The meals chain | `packages/backend/convex/brainRules.ts`, `FOOD_PATTERN_ON` (false; kept off on 2026-10-22) | the Brain starts to show the packaged and fried meals pattern. Recommended: keep off | owner (kept off, the builder's recommendation, which the owner took on 2026-10-28) |
| [x] | The builder's default numbers | `VIVEKA_FULL` (four films in four weeks) in `brainRules.ts`; `CHAT_KEEP_MS` (chat kept 30 days) and the other `*_KEEP_MS` in `retention.ts`; the Brain's thresholds in `brainRules.ts` | each is one number; a change is a commit | owner (closed 2026-10-28: the owner took the builder's recommendations, so these stand as set) |

## Outside the code

| | Gate | What is needed | Decides |
|---|---|---|---|
| [ ] | The legal check | `docs/launch/legal-check.md`: verifiable parental consent through the school's record (DPDP), the missing desk, counseling and study hour call lines in the notice (both calls are recorded on Stream), the production region in the notice, the retention numbers | owner and counsel |
| [ ] | A Hinglish speaker's read | `docs/launch/hinglish-reader.md` | owner names the reader |
| [ ] | Food catalog licences | The catalog starts empty; each source's licence is checked before any item is loaded (`foods.ts`). Students can add their own dishes, and DHI can publish them | owner |
| [ ] | Cloudflare accounts | A Cloudflare account that owns `dhirise` (for `pnpm deploy:house`), and a Cloudflare Stream account for the films (a stand-in host is used until then, `moduleRules.ts`) | owner |
| [x] | The blog tag list | The tags a post may carry: `POST_TAGS` in `packages/backend/convex/blogRules.ts`, now study, reflection, question, idea (the first set) | owner (closed 2026-10-28: the first set stands, the builder's recommendation) |
| [ ] | The pilot class and its teacher | One class of about 10 made up students first, then a real class (spec 0021) | owner and the institute |
| [x] | The desk opens | `DESK_LIVE=true` on production, after the new key is set and `DESK_WORDS_APPROVED` is true; the daily cap stays 300 (`DESK_DAILY_CAP`) and 20 a student | owner (closed 2026-10-28: `DESK_LIVE=true` set on production, the cap 300 a day and 20 a student) |
| [ ] | Counseling opens | Invite the first counselor from the staff area by their Google email, after `COUNSEL_WORDS_APPROVED` and the notice line. The call type `dhi_counsel` exists on the Stream app (shared by development and production). Watch the free plan's recording minutes on the Stream dashboard (house spec 0024) | owner |
| [x] | Moderation without a record | A teacher reads the study hour chat of their own classes, and a DHI admin the reported messages of every institute, without a `staffRead` record (the security review of 2026-10-27). Confirm it fits "a DHI admin never sees room content" | owner (closed 2026-10-28: the owner took the builder's recommendation: it stands as built) |
| [ ] | A book licence for the desk's library | Which books DHI may ingest (Desk Design D1 and D6). None is ingested until a written licence; the desk's map is topics only and uploads wait (house spec 0031, owner 2026-10-28). With a licence the builder estimates storage and cost against the free plan first | owner |
| [ ] | More than two classes on the desk's practice | The learning loop's reads are about 300 MB a month for one class of 40 at 10 answers a school day (house spec 0031); more than about two such classes needs the paid Convex plan or one event per round | owner (the owner keeps the free plan, 2026-10-28) |
| [ ] | Your own browser pass | Every room with made up students, on a phone and a computer | owner |
| [x] | Each production step | A fresh yes for committing, pushing, the backend deploy and the Worker deploy, each in its own message (`docs/launch/PROGRESS.md`) | owner (closed 2026-10-28: the owner said to deploy without asking) |

## The first class pilot checklist (spec 0021)

From `docs/specs/house/0021-first-class-pilot.md`. The builder's item (7) is done on development on 2026-10-26 and 2026-10-27; the rest is yours and the school's.

| | Item | Who |
|---|---|---|
| [x] | 1. Approve the notice, the parent wording and the room words (above) | owner (closed 2026-10-28: approved, house-v3) |
| [ ] | 2. The legal check, and the production region in the notice | owner and counsel |
| [x] | 3. Production setup: `ERASURE_HASH_SECRET` set, the first DHI admin made with `bootstrap:dhiAdmin`, `TEST_SIGNIN_ENABLED` off | owner (done 2026-10-27 on the owner's yes; the owner still claims the DHI admin invite) |
| [ ] | 4. The pattern sources and the meals chain (above) | DHI team and owner |
| [ ] | 5. Choose one class and its teacher; invite the teacher and about 10 students by Google email | institute admin |
| [ ] | 6. For each student under 18, record the parent's written consent on the school's side | institute admin |
| [x] | 7. Run the checks: the backend suite, the copy tests, every browser proof, lint, typecheck, `build:all` (development, see `PROGRESS.md`) | builder |
| [x] | 8. A fresh yes for the production deploys; the Cloudflare account | owner (done 2026-10-28) |
| [ ] | 9. Practise the pause: pause the pilot class, see a student refused, resume, see them back | institute admin and owner |
| [ ] | 10. Two weeks in: the supervised review sessions, with the fixes made before the second class | teacher and a DHI staff member |
| [ ] | 11. The class enters; counseling is not part of the pilot, so the support message names the helpline only | owner |
