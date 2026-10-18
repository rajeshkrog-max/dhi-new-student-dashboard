# @dhi/engine

The pure code the funnel and the backend share (spec 0001, child 0002). No dependency on an app or on the backend.

## Key files

| File | Owns |
|---|---|
| `questions.js` | The 18 questions and their options. A plain ES5 script that hangs `DhiQuestions` on `window` (a page) or `globalThis` (the server) |
| `score.js` | The scoring engine, `DhiScore`, plus `ENGINE_VERSION`. Needs `questions.js` first |
| `result.ts` | The pure parts of the saved result: `flatten`, `isFlat`, `startResult`, and the `ResultView` type written out by hand (this package cannot import the backend's generated API) |

## Rules

- The funnel serves `questions.js` and `score.js` at the old public addresses (`/dhiinterviews/js/engine/`) from generated, git ignored copies written by `apps/joining/scripts/sync-engine.mjs`. Edit the files here, never the copies. `apps/joining/tests/engine-copy.test.js` fails when a copy is missing or differs.
- Keep `questions.js` and `score.js` plain ES5 scripts with no `import`, no DOM and no storage. Scoring rules and the `ENGINE_VERSION` lock are described in `apps/joining/public/dhiinterviews/js/engine/AGENTS.md` and `packages/backend/convex/AGENTS.md`.
- `ResultView` must keep fitting what `results.ensure` returns. `apps/joining/src/lib/session.ts` fails to compile if it does not.
- Name no flag in `result.ts` (flags are `Record<string, boolean>`); only the backend's `resultsCore.ts` may name them.
