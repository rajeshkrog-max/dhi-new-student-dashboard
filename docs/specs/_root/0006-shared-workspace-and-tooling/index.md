# 0006. Shared workspace and tooling: one pnpm workspace for the house, the funnel and the shared packages

**Date**: 2026-10-17
**Status**: In Progress

## Summary

The repo becomes one pnpm workspace with one lockfile. The house stays at the repo root, the funnel stays in `apps/joining`, and the shared packages from spec 0001 go under `packages/`. One set of root commands installs, builds, type checks, lints and tests every part by running each part's own tooling. Lint and format stay per part, so the house keeps ESLint and Prettier and the funnel is left untouched until you opt in. GitHub Actions runs the same checks, including a build, on every pull request. The funnel's live behaviour does not change.

## Requirements

**User stories**:
- As the owner, I want one install and one set of commands for both parts so that I do not juggle two package managers.
- As the owner, I want a format or lint run on one part to never rewrite the other, so the live funnel is not reformatted by accident.
- As the owner, I want every change checked automatically before it reaches `main`, because the repo holds code for a product with minors' data.
- As the builder of spec 0001, I want a workspace with room for `packages/backend` and `packages/engine`, so the backend move has a home.

**Acceptance criteria** (the contract, each independently checkable):
- **AC-1**: From a clean checkout, one `pnpm install` at the repo root installs the house, the funnel and any package from a single `pnpm-lock.yaml`. `package-lock.json` and `apps/joining/pnpm-lock.yaml` no longer exist, and `.gitignore` lists `package-lock.json` and `yarn.lock` so another package manager cannot bring a second lockfile back.
- **AC-2**: `pnpm dev` starts the house on port 8080 exactly as `npm run dev` did, and `pnpm dev:joining` starts the funnel on port 4321. Neither behaves differently from today.
- **AC-3**: `pnpm build:all` builds the house and the funnel from the root. The house's `build` runs its migration step through `node scripts/migrate.mjs`, not `npm`. Spec 0005 later removes that step.
- **AC-4**: `pnpm typecheck`, `pnpm lint` and `pnpm test` each run every part's own task and fail if any part fails. `pnpm test` passes on a clean checkout with no `.grok` folder, and it does not run the browser tests (`test:e2e`), which need a development deployment. On a clean checkout the house tests that need gitignored `.grok` files skip with a stated reason (8 today), and the share card tests do not depend on the project's own `src/lib/og/site.json`.
- **AC-5**: `pnpm lint` and `pnpm format` read and change nothing under `apps/` or `packages/`. A check proves it: on a clean tree, `pnpm format` leaves `git status` clean for those folders.
- **AC-6**: One `catalog:` list in `pnpm-workspace.yaml` names the version of each library both parts use, and both parts refer to it. A check fails if a part pins a catalog library directly, except a short exception list in the check script, one reason each.
- **AC-7**: `pnpm-workspace.yaml` holds the release age rule (explicit `minimumReleaseAge`), its named exceptions, the build script approvals (`allowBuilds`), the `overrides` entry the house still needs, and `engineStrict`. An install that needs a build script nobody approved fails, and each approval has a one line reason.
- **AC-8**: Node and pnpm are pinned: `engines.node` is `>=22.19.0` in both the root and the funnel `package.json` (the funnel's own runtime dependency `undici@8.11.2` needs it, found by the first CI run), `packageManager` is exactly `pnpm@12.10.1`, and `.node-version` names the Node version used locally. CI reads the same values.
- **AC-9**: A GitHub Actions workflow runs a frozen install, `typecheck`, `lint`, `test` and `build:all` on every pull request and every push to `main`, on Node 22.19.0 and Node 24, with read only permissions and no secrets. A failing run is visible on the pull request.
- **AC-10**: No file in `apps/joining` other than its `package.json` (catalog references, a `typecheck` script, the corrected `engines.node`), its removed `pnpm-lock.yaml` and its removed `pnpm-workspace.yaml` change, plus documentation edits to its `AGENTS.md` files. The funnel's direct dependencies stay at exactly the versions of the lockfile the live app was built on. Its Vitest suites pass as before, its build works, and `pnpm --filter dhirise exec convex --version` and `pnpm --filter dhirise exec wrangler --version` still resolve. Nothing in this spec runs `deploy:*`.
- **AC-11**: Every root script runs the same on Windows 11 (PowerShell and Git Bash) and on the Linux CI runner, except the Linux only sandbox scripts named below. Scripts use double quoted globs and no bash only syntax.
- **AC-12**: The Grok sandbox startup script (`startup.sh`) starts the house through pnpm, in the same change that creates the workspace, using the pnpm version pinned in `package.json`.

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): a pnpm workspace with the house at the root, plain pnpm commands for tasks, per part lint and format, and GitHub Actions. (basis: the funnel already runs pnpm, and pnpm documents the version list, release age rule and build approvals that spec 0005 needs; one lockfile per repo; least privilege CI)

**Implementation skills**: none installed for this decision.

## Workspace design

**Layout**:

| Path | What it is | Package name |
|---|---|---|
| `/` (root) | The house app, and the workspace root | `dhi-house` (renamed from `app-builder-workspace`) |
| `apps/joining` | The DhiRise funnel | `dhirise` (unchanged) |
| `packages/backend` | Convex backend (spec 0002), created by that spec's build | `@dhi/backend` |
| `packages/engine` | Shared pure scoring and result code (spec 0002), created by that spec's build | `@dhi/engine` |

`pnpm-workspace.yaml` lists `apps/*` and `packages/*`. The root project is a workspace member by being the root. Recursive commands skip the root by default (`includeWorkspaceRoot` stays false), so the house's own tasks have their own names and the root scripts call them explicitly. That also stops any script calling itself.

**`pnpm-workspace.yaml` holds** (one place for repo wide settings):
- `packages`: `apps/*`, `packages/*`
- `catalog`: the libraries both parts use now, which are `better-auth` (`~1.6.33`) and `vite` (`8.3.3`). Other shared libraries from spec 0005 (Convex, Wrangler, `@convex-dev/better-auth`) join the catalog when a second part first uses them. `typescript` (house `^5.7.0`, funnel `^7.0.2`) and `@types/node` (22 against 26) are listed exceptions until spec 0005's first thin thread settles them. `playwright` (house) and `@playwright/test` (funnel) are different packages, so they are not a shared row
- `minimumReleaseAge`: explicit, `1440` (minutes, one day, the value the funnel runs on today by default). `minimumReleaseAgeExclude` keeps `astro@7.3.7`, with its reason
- `allowBuilds`: `esbuild` and `workerd` (carried from the funnel), plus any the house needs. The first install that finds an unapproved build script fails and the entry is added with a reason
- `overrides`: `nf3: 0.3.17`, moved here from the house's top level npm `overrides`, because pnpm reads it here. Needed while Nitro stays, until spec 0005 removes it
- `engineStrict: true`
- The funnel's current `apps/joining/pnpm-workspace.yaml` is merged in and deleted

**Root scripts** (literal bodies after this spec is built; the house's current bodies are kept, only the `npm` call is replaced):

```json
"dev": "node scripts/with-app-env.mjs vite dev --host 0.0.0.0 --port 8080",
"dev:joining": "pnpm --filter dhirise dev",
"build": "node scripts/with-app-env.mjs vite build && node scripts/migrate.mjs",
"build:all": "pnpm build && pnpm --recursive --workspace-concurrency=1 --if-present --filter \"./apps/*\" --filter \"./packages/*\" run build",
"typecheck:house": "tsc --noEmit",
"typecheck": "pnpm typecheck:house && pnpm --recursive --workspace-concurrency=1 --if-present --filter \"./apps/*\" --filter \"./packages/*\" run typecheck",
"lint:house": "eslint src scripts server vite.config.ts eslint.config.mjs",
"lint": "pnpm lint:house && node scripts/check-catalog.mjs && pnpm --recursive --workspace-concurrency=1 --if-present --filter \"./apps/*\" --filter \"./packages/*\" run lint",
"format": "prettier --write src scripts server vite.config.ts eslint.config.mjs",
"format:check": "prettier --check src scripts server vite.config.ts eslint.config.mjs",
"test:house": "node --test \"scripts/**/*.test.mjs\" && node --experimental-strip-types --test src/lib/app-data/app-data.test.ts src/lib/app-data/readiness-schedule.test.ts src/lib/auth/gate-identity.test.ts src/lib/auth/sign-in-gate.test.ts",
"test": "pnpm test:house && pnpm --recursive --workspace-concurrency=1 --if-present --filter \"./apps/*\" --filter \"./packages/*\" run test",
"test:e2e": "pnpm --filter dhirise test:e2e"
```

The house runs first and a failure stops the run (`&&`). Part tasks run one at a time (`--workspace-concurrency=1`) so output stays in order. A filter that matches no project (`packages/` does not exist yet) passes, as CI showed; only the case where both filters match nothing is untested. House only scripts (`check:auth`, `preview`, `preview:restart`, `preview:stop`, `build:dev`, `db:migrate`) keep their current bodies. `deploy:*` has no root alias: run `pnpm --filter dhirise deploy:pages` by name, and `deploy:worker` once spec 0004 adds it, so a production deploy is never one short command.

**Lint and format scope** (explicit path lists, so a stray run cannot reach a part):
- ESLint covers `src`, `scripts`, `server`, `vite.config.ts` and `eslint.config.mjs`, and the config adds `apps/**` and `packages/**` to its ignores. `src/routeTree.gen.ts` stays ignored as today.
- Prettier covers the same paths, code files only. It does not touch `docs/`, Markdown, `migrations/`, `package.json` or `pnpm-workspace.yaml`. A root `.prettierignore` lists `apps/`, `packages/`, `src/routeTree.gen.ts` and `pnpm-lock.yaml`.
- The house's `.prettierrc` gains `"endOfLine": "auto"`, so a Windows checkout with CRLF does not fail `format:check`. A root `.gitattributes` holds one scoped rule, `apps/joining/** text=auto eol=lf`: the funnel's tests read files with newline patterns and fail on CRLF, which Windows Git checks out when `autocrlf` is on. The index is already LF, so no content is renormalised. `text=auto` (never plain `text`) leaves images and audio untouched. No rule applies to the house.
- The funnel, `packages/backend` and `packages/engine` hold funnel code (plain ES5 page scripts, Convex files in a wider line style), so none gets ESLint or Prettier now. A part opts in by adding its own `lint` or `format` script and config. Genuinely new packages written later get the house's config.

**The catalog check** is `scripts/check-catalog.mjs`, with a test beside it. It reads `pnpm-workspace.yaml` and every `package.json` in the workspace, and fails when a library in the catalog is pinned directly in a part. Its exception list is a constant inside the script, one reason each (`typescript`, `@types/node` for now). It runs from `pnpm lint`.

**House tests on a clean checkout.** 18 of the house's script tests failed on a fresh clone, in three groups. All are now fixed without deleting a test. (1) 8 tests need a gitignored file that only the sandbox ships: 4 pin documents to `.grok/skills/og/SKILL.md` (and, in the sandbox's template, a "Brand-asset pass" section of `AGENTS.md`), and 4 assert `.grok/app-env.json`. They skip, each with the stated reason, when the file is absent, and still run in the sandbox. (2) 8 share card tests in `scripts/grok-pwa-plugin.test.mjs` read the real `src/lib/og/site.json` ("DHI") because they passed no working directory. That file now starts in an empty temp directory (`process.chdir`), so the tests assert the default identity they were written for. (3) 2 wrapper tests (an explicit override, and the exit code) failed because `scripts/with-app-env.mjs` used a Windows shell for every command, which cannot start a path with spaces. The shell is now used only for bare command names (`vite`, `pnpm`), whose `.cmd` shims need it. One real lint error was fixed too: an empty `catch` in `src/lib/app-data/client.server.ts`.

**Linux only sandbox scripts** are exempt from AC-11: `startup.sh`, `scripts/preview.mjs` (reads `/proc`) and the `preview*` scripts. `scripts/preview.mjs` keeps spawning `npm run preview`, which still works because npm ships with Node and root `package.json` still has that script.

**Pins**:
- `packageManager` is exactly `pnpm@12.10.1` in the root `package.json`, confirmed against the installed pnpm at build. Corepack is not required, since a standalone pnpm switches to the pinned version itself. `devEngines.packageManager` is revisited later, because `pnpm/action-setup` may not read it.
- `engines.node` is `>=22.19.0` in the root and funnel `package.json`. The funnel's runtime dependency `undici@8.11.2` needs Node 22.19.0, and every other floor in the lockfile is at most 22.13. The first CI run on 22.12.0 failed on this. A local install under 22.12.0 had passed only because the tree was already installed, so pnpm never re-checked engines. `.node-version` is `24` (this machine runs 24.18).
- In the Grok sandbox pnpm comes from `npm install -g pnpm@<pinned version>`, which `startup.sh` runs itself when pnpm is missing, because npm ships with Node and Corepack may not be there.

**CI** (`.github/workflows/ci.yml`):
- Triggers: `pull_request` and `push` to `main`.
- `permissions: contents: read`. No secrets, and no production or development deployment credentials, and no step that contacts Convex or Cloudflare.
- One job on a matrix of Node `22.19.0` (the floor) and `24`: checkout, `pnpm/action-setup` (reads the pinned pnpm version), `actions/setup-node` with `cache: pnpm`, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build:all`.
- The builds must succeed with no `.env` values. The house's `migrate.mjs` already skips without `DATABASE_URL`. The funnel's Astro build is checked at build time to confirm it succeeds without `PUBLIC_CONVEX_URL`, and if it does not, CI sets a dummy public value in the workflow.
- Every third party action is pinned to a full commit SHA, taken from its release page at build time and never guessed. A comment beside each names the release.
- Not in CI yet: `test:e2e`, `check:auth` and the Playwright smoke run, which need a running server or a development deployment.
- Branch protection (require the check to pass on `main`) is a GitHub setting the owner turns on.

**Deploys.** The house is not deployed anywhere yet (no `vercel.json`, no `.vercel`), so no host install command changes. Spec 0004 moves it to Workers later. The funnel's deploy path (`deploy:pages`, then spec 0004's scripts) is untouched here.

**Value sourcing** (each value names where it comes from):

| Action | Value | Source |
|---|---|---|
| Install | Version of each shared library | The `catalog:` list in `pnpm-workspace.yaml` (spec 0005) |
| Install | Which pnpm runs | `packageManager` in the root `package.json` |
| Install, local and CI | Which Node runs | `.node-version` locally, the CI matrix in CI, floor in `engines.node` |
| Install | Minimum age of a release | `minimumReleaseAge` in `pnpm-workspace.yaml` |
| Install | Which packages may run build scripts | `allowBuilds` in `pnpm-workspace.yaml` |
| Install | The `nf3` pin | `overrides` in `pnpm-workspace.yaml` |
| `pnpm lint`, `pnpm format` | Which paths they touch | The explicit path lists in the root scripts, plus ESLint ignores and `.prettierignore` |
| Part tasks from the root | Which parts run | The pnpm filters `./apps/*` and `./packages/*` |
| Catalog check | Allowed exceptions | The constant in `scripts/check-catalog.mjs` |
| CI | Action versions | Full commit SHAs recorded in the workflow |

**Key invariants**:
- One lockfile, one package manager, one version per shared library (listed exceptions aside).
- A root command never edits files outside the house (`format` and `lint` touch the house only).
- Nothing in CI can reach a deployment, a secret, or student data.
- The funnel's live addresses, deploy scripts and behaviour are unchanged by this decision, and nothing in this spec runs a deploy.

**Security model**: supply chain controls are the point. A release younger than the age rule is not accepted, build scripts run only if approved, installs in CI are frozen, and CI has read only permission and no secrets. Compliance scope: personal data of students under 18, so no real student data, export or credential enters CI or the repo.

**Critical test scenarios** (each maps to an acceptance criterion):
- Happy path: delete every `node_modules` and run `pnpm install`, then `pnpm dev` and `pnpm dev:joining` both start, verifies **AC-1**, **AC-2**
- Happy path: `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm build:all` pass on a clean checkout (no `.grok` folder) on Windows and on Linux CI, verifies **AC-3**, **AC-4**, **AC-9**, **AC-11**
- Failure case: break a type in the funnel and the root `pnpm typecheck` fails, verifies **AC-4**
- Failure case: add a package with an unapproved build script and the install fails with the package named, verifies **AC-7**
- Failure case: pin a catalog library directly in the funnel and the catalog check fails, verifies **AC-6**
- Safety: on a clean tree run `pnpm format` and `pnpm lint:house --fix` and confirm `git status` shows nothing under `apps/` or `packages/`, verifies **AC-5**
- Regression: the funnel's Vitest suites and build pass as before, and `pnpm --filter dhirise exec convex --version` and `wrangler --version` resolve. No `deploy:*` runs, verifies **AC-10**

## Build plan

Ordered by Tracer Bullet: the first slice is the thinnest real thread (one workspace that installs and starts both parts), then each later slice thickens it.

1. **Workspace skeleton and one lockfile.** Add `pnpm-workspace.yaml` at the root with `packages`, the catalog start, `minimumReleaseAge`, `allowBuilds`, `overrides` and `engineStrict`, and merge the funnel's settings into it, deleting `apps/joining/pnpm-workspace.yaml`. Add `packageManager`, `.node-version`, `engines`, the renamed root package, and the `.gitignore` entries. Remove `package-lock.json`, `apps/joining/pnpm-lock.yaml` and every `node_modules`, then `pnpm install`. Add `dev` and `dev:joining`. Satisfies **AC-1**, **AC-2**, **AC-7**, **AC-8**
2. **Root commands and clean checkout tests.** Replace the `npm` call in the house `build`, rename the house tasks to `typecheck:house`, `lint:house` and `test:house`, add the root orchestrators and `build:all` as written above, add a `typecheck` script to the funnel, and fix the 18 house tests that fail on a clean checkout, as described under House tests on a clean checkout. Satisfies **AC-3**, **AC-4**, **AC-11**
3. **Scope lint and format.** Add the ESLint ignores, `.prettierignore`, the `endOfLine` setting, the explicit path lists, and the clean tree check. Satisfies **AC-5**
4. **Shared version list.** Create the catalog (`better-auth`, `vite`), point both parts at it, add `scripts/check-catalog.mjs` with its test and exception list, and wire it into `pnpm lint`. Satisfies **AC-6**, **AC-10**
5. **CI and sandbox.** Add the GitHub Actions workflow (SHA pinned actions, read only, matrix of `22.19.0` and `24`, including `build:all`) and switch `startup.sh` to pnpm in the same change. Satisfies **AC-9**, **AC-12**

## Migration plan

**Strategy**: strangler in spirit: the new workspace is built beside the old and the old lockfiles are removed only once the new install is proven. No live system is touched, because the funnel's deploy path is unchanged and nothing here deploys.

**Phases**:
1. On a branch, create the workspace files and run `pnpm install` from clean. Do not delete the old lockfiles yet. Start both parts and run the funnel's tests.
2. Add the root commands and run them on Windows, and through CI on Linux.
3. Delete the old lockfiles, the funnel's workspace file and every `node_modules`, reinstall, and re run the full checks. Then seed the new lockfile from the funnel's old one, taken from git history (`git show 41caeb6:apps/joining/pnpm-lock.yaml`, see Risks) so the funnel keeps its exact versions, align the house's React pair, and re run the checks.
4. Switch `startup.sh` to pnpm in the same change, and install the pinned pnpm in the sandbox with npm. The first run on the sandbox confirms the house preview starts. Merge needs a green CI on the branch (it passed on pull request #1). The sandbox run is a tracked follow-up, not a merge gate: only the sandbox preview is at risk, and the old npm path is one revert away.

**Rollback**: revert the merge commit. The old lockfiles come back with it, and a fresh `npm install` for the house and `pnpm install` for the funnel work as before.

**Risks**:
- `pnpm install` resolved different versions than the live funnel was built on. This happened: a fresh lockfile moved many funnel packages (Astro 7.3.7 to 7.4.0, Convex 1.46 to 1.47, Wrangler 4.148 to 4.151). The fix was to seed the new lockfile from the funnel's old one (rename its importer to `apps/joining`, add an empty root importer, then `pnpm install`). All 14 direct dependencies and all 496 old package versions are kept. One transitive peer moved, `react@19.3.0` to 19.3.1, because pnpm resolves peers from the workspace root, and the funnel never loads React. The same seeding pulled the house's `react` down but not `react-dom`, which React rejects, so both were aligned at 19.3.1. If the lockfile is ever regenerated from scratch, compare it with the live one before a deploy.
- The sandbox may not run pnpm the way a Windows machine does, which breaks the house preview there. Check on the first run.
- pnpm 12 is newer than much of its documentation. Resolved at the first install: pnpm 12.10.1 accepts `allowBuilds`, `engineStrict`, `minimumReleaseAge` and `overrides` in `pnpm-workspace.yaml`, and an unapproved install script fails the install.
- The funnel's Astro build may need `PUBLIC_CONVEX_URL` set. Resolved: it builds with no env files, locally and in CI.
- A passing install on an already installed tree does not re-check engines, so a Node floor is proved only by a fresh install, which CI does. The first CI run found the 22.19.0 floor this way.

## Consequences

**Positive**:
- One install, one lockfile and one set of commands for the whole repo.
- The backend package move in spec 0001 has a working home.
- The funnel's release age rule and build approvals now protect the house as well.
- Every change is built and checked before it reaches `main`.

**Negative / tradeoffs**:
- The house moves off npm. Its `npm run` habits, `startup.sh`, `AGENTS.md` commands and docs change, and the sandbox needs pnpm.
- The house lives at the root, so `pnpm -r` skips it. Its tasks need explicit names, which is a small permanent oddity until it moves into `apps/house`.
- One lockfile means a bad dependency change in either part affects both.
- Lint and format are per part, so the funnel, backend and engine stay unformatted and unlinted, and their style can drift until you opt in.
- CI is a new thing to maintain, and it does not yet run the browser tests or the auth check. Those need a development deployment and secrets, which CI deliberately does not have.
- Eight of the house's tests now skip on a clean checkout (they need gitignored `.grok` files), so they stop guarding those documents in CI. They still run in the sandbox.
- pnpm 12 is recent. Some settings (`allowBuilds`, the pin field) may differ from older guides.

**Neutral**:
- Root `AGENTS.md` (`## Commands`, `## Rules`), `scripts/AGENTS.md` and `apps/joining/AGENTS.md` need command updates once built. `/sync` does that.
- Spec 0005's wording on the release age rule and the Node floor was corrected to match this spec (one day, 1440 minutes; Node 22.19.0).
- Evidence: on pull request #1 the first CI run failed on Node 22.12.0 (the engines finding above) and the second run passed on Node 22.19.0 (54s) and Node 24 (59s), including a frozen install, typecheck, lint, test and build. The sandbox startup (AC-12) and the branch protection setting are still open.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Follow-up

- [x] Confirm the pnpm 12 settings at the first install: `allowBuilds`, `engineStrict`, `minimumReleaseAge` and `overrides` are accepted in `pnpm-workspace.yaml`, and `pnpm -r` skips the root so the root scripts name the house tasks. A filter that matches no project passes (CI ran with no `packages/` folder); only the case where both filters match nothing is untested.
- [ ] Make pnpm available in the Grok sandbox and confirm the house preview starts there.
- [ ] The sandbox run of `startup.sh` (AC-12) is a tracked follow-up, not a merge gate (see the migration plan).
- [ ] Turn on branch protection on `main` so the CI check must pass (a GitHub setting for the owner).
- [x] Correct spec 0005: the release age rule is one day, and the Node floor is 22.19.0.
- [ ] Decide later whether to add the browser tests and `check:auth` to CI, which needs a development deployment and scoped secrets, and whether to add a scheduled dependency audit.
- [ ] Decide whether the 4 doc pinning house tests (and the 4 tests that assert `.grok/app-env.json`) should be rewritten or removed, since they guard sandbox files that are not in the repo. Today they skip in CI.
- [ ] If the shared lockfile is ever regenerated from scratch, compare the funnel's direct dependencies and package versions with the live lockfile first (the seeding steps are under Risks).
- [ ] Revisit moving the house into `apps/house` once the dashboard build starts.
- [ ] Mass formatting of the house (53 files are not Prettier formatted today) is deliberately left out of this spec. Decide whether to do it as its own change.
- [ ] Revisit `devEngines.packageManager` once `pnpm/action-setup` is confirmed to read it.
- [ ] Run `/sync` before the merge to update the `## Commands` and `## Rules` lines in the `AGENTS.md` files: root `AGENTS.md` still says npm and that lint and format are not scoped away from `apps/joining`, which is now false.
