# DHI demo data and rules (`src/lib/dhi`)

## Overview

The words and small pure helpers of the house screens. Every room runs on the shared backend now, so the old client side demo stores of the papers, meals, blog, modules, study hour, desk and home screens were removed (2026-10-22); `BACKEND.md` still lists the tables and the rules each room must keep. What remains is wording, drafts of wording, and the catalogs the mood and habits screens use for colours and icons.

## Key files

| File | Owns |
|---|---|
| `student.ts`, `initials.ts` | Who "you" are on the house screens: a context that is the demo student unless the dashboard route wraps the rooms in the real one (name, initials, class, and a real sign out), and the badge initials rule (spec 0008) |
| `brain-words.ts`, `brain-words.test.ts` | The Brain report's words in English and Hinglish, as fixed templates over the ids and counts the server sends, and the copy lint that holds them to the rules (no ranking, clinical or cause word, no judging of food, no order, no stray digit). Drafts: `BRAIN_WORDS_APPROVED` is false (house spec 0020) |
| `parent-words.ts`, `parent-words.test.ts` | The weekly parent page's words and the Your data link lines, English and Hinglish, with the Brain's copy lint. Drafts: `PARENT_WORDS_APPROVED` is false (house spec 0022) |
| `desk-words.ts`, `desk-words.test.ts` | The DHI desk's drafted words: a line for each refusal, the care text (it names Tele-MANAS 14416), the labels and the note that answers come from a model. The copy test refuses a label or a rank. Drafts: `DESK_WORDS_APPROVED` is false (house spec 0016) |
| `mood-demo.ts` | The mood screen's catalog (the ten moods with their colours and icons) and `prettyDate`. The days themselves are on the server (house spec 0006) |
| `mood-lines.ts`, `mood-words.ts` | The mood room's ten moods and DHI lines (pure data, codes equal `MOOD_CODES` in `@dhi/backend/moodRules`), and its drafted words, the guna lines and the failure lines (house spec 0006) |
| `sleep-words.ts` | The sleep room's drafted failure lines, the night moved on notice and the read back labels (house spec 0008). `sleep-words.test.ts` is the copy test: no judging word and no target |
| `house-words.ts` | The words for people and for every refusal code the server can send (house spec 0002); the rooms' `words.ts` files build on `codeOf` and `refusalWords` |
| `habits/` | `schema.ts` (table comments, `STORE_KEY`, limits), `store.ts` (mutations), `catalog.ts`, `words.ts` (drafted failure lines and the day moved on notice, house spec 0007) |
| `your-data.ts` | The pure pieces of Your data: the India date label and the join of the download's pages into one file (house spec 0005) |
| `id.ts` | `uid()`, a safe id helper (`crypto.randomUUID` is missing in some preview iframes) |

## Conventions

- A words file holds the drafted wording of one room behind a switch (`MOOD_WORDS_APPROVED`, `HABIT_WORDS_APPROVED`, `SLEEP_WORDS_APPROVED`, `BRAIN_WORDS_APPROVED`, `PARENT_WORDS_APPROVED`), all false, and has a copy test beside it. Add a line to the test's list when you add a line to the words.
- A word that depends on a code the server names (a pattern id, a mood code, an evidence item) has a line for every code, in every language; the copy test fails if one is missing.
- Real code reads the student from the verified session, never a constant.
- Wrap every `localStorage` access in try/catch. The app runs inside preview iframes where storage can throw (the Brain page keeps only the chosen language there).

## Gotchas

- Rule enforcement is on the server (an MCQ hint is refused if it gives the answer away, the film score is written once, a habit cap of 5, the blog body is cleaned in `blogRules.cleanBody`). The screens show the refusal in plain words and never rely on their own check.
- Habit misses are not stored. A miss is a day in the window with no check, and history is never rewritten.

## Related specs

None yet. See `BACKEND.md` at the repo root.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
