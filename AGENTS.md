# DHI student house

The student dashboard UI for DHI, a B2B house for an institute's students. It is a working demo for one seat (Suzzy Glass). Almost all data is local demo data. `BACKEND.md` is the brief for the real backend and the rules each room must keep.

## Parts of this app

DHI is one product with two parts in this repo. Each part has its own stack, commands and deploy, so run its commands from its own folder and follow its own `AGENTS.md`. Both parts keep the same product rule: never label a student by ability or rank.

| Part | Folder | Package manager | What it is |
|---|---|---|---|
| Student house | repo root (`src/`, `scripts/`) | pnpm | The front door (`/enter`), the dashboard and the demo rooms below. Everything under `## Stack`, `## Commands` and `## Rules` is about this part |
| DhiRise student funnel | `apps/joining/` | pnpm | The live self check, report and Founding Circle Challenge (Astro, Convex, Cloudflare Pages). Own specs and scope in `apps/joining/docs/`. See [apps/joining/AGENTS.md](apps/joining/AGENTS.md) |

The root rules (`@/` alias, Prettier, `pnpm dev`, TanStack Router) do not apply inside `apps/joining/`, and its page scripts and Convex rules do not apply to the house. Neither part imports the other, and the root `tsconfig.json` covers only `src`. The repo is one pnpm workspace with one lockfile at the root (spec 0006). Root `pnpm lint` and `pnpm format` cover the house only, by explicit path lists plus ignores for `apps/` and `packages/`, so they cannot rewrite the funnel. The funnel has no lint or format until it opts in with its own script and config.

## Stack

- **Language / Runtime**: TypeScript (strict), Node `>=22.19.0` (`.node-version` is 24), ESM
- **Framework**: TanStack Start (React 19) with TanStack Router file routes, built by Vite 8 as a Cloudflare Worker (the Cloudflare Vite plugin and `wrangler.jsonc`; deployed with `pnpm deploy:house`, spec 0008)
- **Key dependencies**: Tailwind CSS 4, the shared Convex backend and Better Auth sign in (`@dhi/backend`, `src/lib/auth/client.ts`, no database of its own), TanStack Query, Recharts, Radix UI, lucide-react, zod
- **Package manager**: pnpm, exact version pinned in `package.json` `packageManager`. Release age rule, build script approvals and the shared `catalog:` version list live in `pnpm-workspace.yaml`

## Build approach

Tracer Bullet (vertical slices, each built end to end through every layer, working). (from the scope headers, `docs/scope/_root/scope.md` and `docs/scope/house/index.md`)

## Commands

```bash
pnpm install --frozen-lockfile   # one install at the root for the house, the funnel and any package
pnpm dev             # Vite on 0.0.0.0:8080 (strict port), wrapped by scripts/with-app-env.mjs; also serves the funnel's built interview at /dhiinterviews (run `pnpm --filter dhirise build` first)
pnpm dev:joining     # the funnel (Astro) on port 4321
pnpm build           # house only: vite build, a Cloudflare Worker in dist/
pnpm build:all       # the house, then every app and package
pnpm typecheck       # every part: house tsc --noEmit, then each part's own typecheck
pnpm lint            # house ESLint on named paths, the catalog check, then each part's own lint
pnpm format          # prettier --write on the house's named paths only
pnpm test            # house node:test (scripts/ and a few src/lib tests), then each part's tests
pnpm deploy:house     # builds with the production backend address and deploys the house Worker `dhirise-house` (routes in wrangler.jsonc); asks Cloudflare, so log wrangler in to the account that owns dhirise first
pnpm enter:check     # real browser proof of the front door, dev server on 8080 and the funnel built (development backend only)
pnpm consent:check   # real browser proof of the consent flow, Your data and erase (dev server on 8080, development backend only)
pnpm desk:check      # real browser proof of the desk: every kind and its coins, clarify, care text, the stored answer (calls the real model on development, about seven calls)
pnpm parent:check    # real browser proof of the weekly parent page and the connections on Progress (pauses and resumes the demo class)
pnpm burst:check     # many calls at once end in an answer or a plain refusal, never a server error (needs an open hour)
pnpm pilot:setup     # a made up pilot class on development: an admin, a teacher, 10 students (6 under 18 with consent on file), and the pause practice
pnpm rehearsal:check # the first look after a deploy, on development, in a fresh made up Rehearsal School
pnpm platform:check  # real browser proof of the funnel link and that only a DHI admin is offered the staff move (dev server on 8080, the funnel built)
pnpm mood:check      # real browser proof of the mood room (dev server on 8080, development backend only)
pnpm habit:check     # real browser proof of the habits room (dev server on 8080, development backend only)
pnpm sleep:check     # the same for the sleep room
pnpm exams:check     # papers, exams and the blog: a teacher builds, sends and marks, a student sits it, the institute admin sees the mark
pnpm meals:check     # the food table, custom dishes, the meals room and the home score card
pnpm modules:check   # the films: upload, approval, watching and keeping (a stand-in video host)
pnpm hour:check      # the study hour: seats in three modes, chat, and the after session feeling card
pnpm brain:check     # the Progress page (the Brain report) on the hand made days of brainFixtures.ts
pnpm learn:check     # the desk's Learn panel (map, practice, Fix, a written answer a teacher marks, the plan) and the new measures' inputs (house specs 0030, 0031)
pnpm topics:check    # the desk card's subject and topic taps (house spec 0028): the class's topics, newest first, stored by id only
pnpm hourcall:check  # the study hour call: two made up students and a moderating teacher on the real Stream app, then the recording watched and shared (--no-recording skips the wait)
pnpm staff:check     # the staff houses: the admin's and teacher's Home, a student's Papers (the DHI admin's screens are backend tested only)
pnpm school:check    # the school report: the demo teacher and admin open it for Class 10 A; only the admin sees room counts
pnpm counsel:check   # counseling: a made up counselor and student book, meet in a real Stream call (fake camera), note, share; waits up to 8 minutes for the recording (--no-recording skips that)
pnpm responsive:sweep  # every room and screen at 360, 768, 1024 and 1280 px (needs the dev server and the demo institute)
pnpm look:check      # fails on a new hand typed colour or free corner size in src/ (baseline in scripts/look-check.baseline.json)
```

The `:house` variants (`typecheck:house`, `lint:house`, `test:house`) run the house alone. `test:e2e` and `enter:check` are not in CI. CI (`.github/workflows/ci.yml`) runs a frozen install, `typecheck`, `lint`, `test` and `build:all` on Node 22.19.0 and 24. `deploy:*` has no root alias: run `pnpm --filter dhirise deploy:pages` by name.

## Specs

Stored in `docs/specs/<part>/`: `_root` for repo wide decisions (the platform move, the workspace) and `house` for the student house. Format: `docs/specs/<part>/NNNN-title.md`, or a folder with `index.md` for an umbrella. The funnel keeps its own in `apps/joining/docs/specs/`. Scope files follow the same split under `docs/scope/`. `docs/` also holds three PDFs: the Master Spec (metrics, storage, insights, build roadmap), the Growth Report and the Desk Design.

## Rules

- Always start the app with `pnpm dev`, never `vite` directly. The wrapper merges `.grok/app-env.json` so dev, build and preview agree.
- Import with the `@/` alias (maps to `src/`). Prettier: double quotes, semicolons, trailing commas, 100 columns.
- `src/routeTree.gen.ts` is generated by the router plugin. Do not edit it by hand.
- The house has no database. Data and sign in live in the shared Convex backend (`packages/backend`), imported as `@dhi/backend/api`. Routes that read the signed in student render in the browser only (`ssr: false`) and sit inside `ConvexSession` (`src/components/dhi/convex-session.tsx`).
- The house serves only its own paths on dhirise.com (Worker routes in `wrangler.jsonc`, spec 0008); everything else, the whole interview and `/api/*`, stays with the funnel on Cloudflare Pages. A new top level folder in `public/` must be added to those routes. A root address with a query string (`/?ref=`) is not matched by a route and takes the funnel's `/` redirect.
- A new account goes through the front door `/` (also `/enter`): a finished interview goes to `/dashboard`, anything else to the funnel's interview at `/dhiinterviews/landing.html` (spec 0008, `src/lib/entry.ts`). The interview stays the funnel's; do not rebuild it in the house.
- Rows owned by a person carry `student_id` and `institute_id`. Never return another institute's rows.
- Do not label a student weak, average or bright. Scores are growth marks, not ranks.
- A student reaches no room until they agree to the house notice and, if under 18 (or the flag is missing), the school has recorded a parent's consent (house spec 0005). Staff see named student data only through `staffRead`, and a DHI admin or counselor never sees room content, with one exception the owner chose on 2026-10-28: that institute's teachers and a DHI admin may watch study hour call recordings (house spec 0027). The consent words are drafts until the owner approves them: use only made up people.
- The room rules in `BACKEND.md` ("Rooms in this repo" and "Do not") are product rules. Keep them when changing a room.
- Every room and the Brain run on the server now; no screen shows sample data. The words of the rooms and the Brain are drafts until the owner approves them (`HOUSE_WORDS_APPROVED`, `MOOD_WORDS_APPROVED`, `HABIT_WORDS_APPROVED`, `SLEEP_WORDS_APPROVED`, `BRAIN_WORDS_APPROVED`, `PARENT_WORDS_APPROVED`, `DESK_WORDS_APPROVED`, `COUNSEL_WORDS_APPROVED`, `SCHOOL_WORDS_APPROVED`, `STAFF_WORDS_APPROVED`, `HOUR_CALL_WORDS_APPROVED`, and for the Brain `PATTERN_SOURCES_CONFIRMED` and `FOOD_PATTERN_ON`). All are false: use only made up students and say so before any real one is invited.
- The study hour call (house spec 0027) is on Stream Video too: camera and voice, one call per hour and institute, recorded and kept on Stream 30 days, watched by that institute's teachers and a DHI admin (owner, 2026-10-28).
- Counseling (house spec 0024) is on Stream Video: every call is recorded and transcribed, and the files stay on Stream, never in a DHI table (the owner's choice, 2026-10-27). A counselor sees a student's first name, class, school and note only; school staff and DHI admins never see a booking. Stream code follows the installed Stream skills (`.claude/skills/stream`, `stream-react`).
- The Brain (house specs 0019 and 0020) is the student's alone: no teacher, institute admin, DHI admin or counselor function reads a daily value, a pattern or a lamp, and no look at it is recorded. Never add a staff view of it without the owner's yes. The one opening is the weekly parent page (house spec 0022): with the student's sharing on and their own private link, `parentReport.open` gives days logged in each room for 7 days and the three lamp values, built only by `weekOf` in `parentRules.ts`, never a mood value, note, pattern, movement or the support flag. A look through it is recorded in the student's own "Who has looked".

## Agent skills

Installed under `apps/joining/.claude/skills/` for now (spec 0001 and house spec 0002 ask to move them where both parts see them). Open the one a task needs before shared backend or sign in work. The funnel's own list is in `apps/joining/AGENTS.md`.

- [convex](apps/joining/.claude/skills/convex/): `get-convex/agent-skills`, the backend, and the router to the other `convex-*` skills
- [convex-auth](apps/joining/.claude/skills/convex-auth/): `get-convex/agent-skills`, wiring sign in into Convex
- [convex-authz](apps/joining/.claude/skills/convex-authz/): `get-convex/agent-skills`, ownership and tenant checks (`student_id`, `institute_id`)
- [convex-env](apps/joining/.claude/skills/convex-env/): `get-convex/agent-skills`, deployment variables and secrets
- [better-auth-best-practices](apps/joining/.claude/skills/better-auth-best-practices/): `better-auth/skills`, the one shared sign in
- [better-auth-security-best-practices](apps/joining/.claude/skills/better-auth-security-best-practices/): `better-auth/skills`, trusted origins, rate limits, sessions
- [workers-best-practices](apps/joining/.claude/skills/workers-best-practices/): `cloudflare/skills`, both Workers
- [wrangler](apps/joining/.claude/skills/wrangler/): `cloudflare/skills`, deploys and environments

## Context files

- [src/lib/dhi/AGENTS.md](src/lib/dhi/AGENTS.md): demo stores and schema comments that define the backend contract
- [src/lib/auth/AGENTS.md](src/lib/auth/AGENTS.md): the browser sign in client (Better Auth through the shared backend) and the preview and dev proxies for `/api/auth`
- [src/components/dhi/AGENTS.md](src/components/dhi/AGENTS.md): the room screens, the shared menu and Sheet, and the responsive rules
- [scripts/AGENTS.md](scripts/AGENTS.md): env wrapper, the `/api/auth` proxies, the local funnel serving, preview tooling and their tests
- [src/lib/app-data/AGENTS.md](src/lib/app-data/AGENTS.md): server only connector client (Drive, Calendar and others) and its readiness probe
- [apps/joining/AGENTS.md](apps/joining/AGENTS.md): the DhiRise student funnel part (Astro, Convex, Cloudflare); it has its own nested docs for `convex/`, `src/`, `tools/` and the scoring engine

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
