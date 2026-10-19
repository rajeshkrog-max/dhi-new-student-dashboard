# DHI demo data and rules (`src/lib/dhi`)

## Overview

Each student room has a store or catalog here, plus a header comment that names the real database tables it will become. Today every store is client side demo data in `localStorage` or a file built from `Date.now()`. `BACKEND.md` lists the tables and the rules the API must keep. These files are the contract the backend replaces.

## Key files

| File | Owns |
|---|---|
| `gate.tsx` | Demo "in the house" state (`enter` / `leave`); wraps the app in `__root.tsx` |
| `home-demo.ts` | Home greeting, DHI score and quick tiles |
| `student.ts`, `initials.ts` | Who "you" are on the house screens: a context that is the demo student unless the dashboard route wraps the rooms in the real one (name, initials, class, and a real sign out), and the badge initials rule (spec 0008) |
| `papers-demo.ts` | Exam papers; attempts are stored from `components/dhi/papers-desk.tsx` |
| `meals-demo.ts` | Meal plates (key `dhi-meals-v3`) |
| `mood-demo.ts` | Mood days (key `dhi-mood-v1`) |
| `habits/` | `schema.ts` (table comments, `STORE_KEY`, limits), `store.ts` (mutations), `catalog.ts` |
| `desk/` | `schema.ts` (wallet, coin `COSTS`, cache rules), `store.ts` (key `dhi-desk-v1`) |
| `modules/catalog.ts` | House films and watch progress (key `dhi-modules-v1`) |
| `blog/posts.ts` | Student posts (key `dhi-blog-v1`) |
| `study/` | `schema.ts` and `hours.ts`; study hours are generated, not stored |
| `your-data.ts` | The pure pieces of Your data: the India date label and the join of the download's pages into one file (house spec 0005) |
| `id.ts` | `uid()`, a safe id helper (`crypto.randomUUID` is missing in some preview iframes) |

## Conventions

- Keep the demo store API shaped like the future mutations (for example `addPlan`, `lightToday`, `unlightToday` in habits). Swapping to a real API should not change callers.
- Each store has a versioned storage key (`dhi-…-vN`). Change the shape, bump the version.
- Table and column comments in `schema.ts` files use snake_case; the TypeScript types use camelCase. Keep both in step when a field changes.
- `STUDENT_ID` is a fixed demo id (`stu_suzzy_glass`). Real code must read the student from the verified session, never a constant.
- Wrap every `localStorage` access in try/catch. The app runs inside preview iframes where storage can throw.

## Gotchas

- Rule enforcement is in the UI today (MCQ hint must not reveal the answer, modules score once at the end of playback, habit cap of 5, desk cache hit costs 0). The server must repeat these checks.
- Blog HTML is sanitized by `safeHtml` in `components/dhi/blog/blog-room.tsx`. The server must sanitize again with the same allowed tags.
- Study hours are fake: one live and one locked hour built from `Date.now()`. Real hours come from the admin clock.
- Habit misses are not stored. A miss is a day in the window with no check, and history is never rewritten.

## Related specs

None yet. See `BACKEND.md` at the repo root.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
