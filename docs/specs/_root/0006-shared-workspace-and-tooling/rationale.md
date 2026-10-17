# 0006. Rationale: Shared workspace and tooling

## Context

> ⚠️ Premise note: the house stays at the repo root while the funnel and the packages sit under `apps/` and `packages/`. That is the least movement, and it keeps the Grok sandbox preview working, but it leaves the root as both the workspace and an app. Recursive pnpm commands skip the root by default, so the house's tasks must be named explicitly. It works, and it is a small permanent oddity until the house moves into `apps/house`. You chose this on purpose, so the spec records the cost instead of arguing it.

The repo holds two parts that were built separately. The house (the dashboard, at the root) uses npm, a `package-lock.json`, ESLint 9 with Prettier, and `node:test` suites. The funnel (`apps/joining`, a copy of the live DhiRise app) uses pnpm with its own lockfile and workspace file, Vitest with `convex-test` and Playwright, and no linter or formatter. There is no CI, no git hooks, and no shared command. Today the root `npm run lint` and `npm run format` also reach into `apps/joining`, so a format run would rewrite the live funnel's files.

Spec 0001 needs more from the repo: the backend moves into `packages/backend`, shared scoring code into `packages/engine`, and one pinned version list (spec 0005) is shared by both parts. None of that works with two package managers and two lockfiles. The workspace also has to land before the funnel moves hosts, which is the main work before the challenge ends on 2026-10-30.

Without a decision, the backend package move has no home, the two parts drift in dependency versions (Better Auth and TypeScript already differ), and a routine format command can alter live code. The audience is students under 18, so changes should be checked before they reach `main`.

## Options considered

### Option 1: pnpm workspace, house at the root, plain pnpm commands, per part lint and format, GitHub Actions (chosen)

One `pnpm-workspace.yaml`, one lockfile, `apps/*` and `packages/*`. Root scripts fan out with pnpm's own recursive and filter commands. Each part keeps its own lint and format. CI runs the same commands.

**Pros**:
- It is already the funnel's tool, so the live part changes least.
- Catalogs, the release age rule and build approvals, all needed by spec 0005, are confirmed pnpm features in its documentation.
- No extra tool to learn or operate, and nothing to cache or configure beyond pnpm.
- Nothing about the funnel's formatting or deploy path changes.

**Cons**:
- The house moves off npm, and the Grok sandbox needs pnpm.
- Root is an app, so recursive commands skip it and the house's tasks need special names.
- Per part lint and format leave the funnel unlinted.

### Option 2: npm workspaces for everything

Move the funnel to npm, use the house's `package-lock.json` and tools.

**Pros**:
- The house's current tool, no new tool for the sandbox.

**Cons**:
- The funnel's release age rule and build approvals are pnpm features with no direct npm equivalent.
- No catalog for a single version list, so spec 0005 would need another mechanism.
- Less strict about what a package may import, so shared code can quietly depend on undeclared libraries.
- It changes the funnel's tool right before its deadline.

### Option 3: bun workspaces for everything

Use bun as the package manager and task runner for both parts.

**Pros**:
- Fast installs and a single tool. Its documentation lists workspaces, `--filter`, catalogs, a `minimumReleaseAge` setting, a script allow list (`trustedDependencies`) and an official GitHub Action.
- A text lockfile, so diffs are readable.

**Cons**:
- Nothing in this repo runs on bun: the funnel runs on Cloudflare Workers and Convex, and its tools (Wrangler, the Convex CLI, Astro, Vite, Vitest, Playwright) are Node tools that bun would only install.
- The check could not confirm Windows stability from an official source, nor official support for Convex, Wrangler, Astro or Playwright under bun, nor named catalogs or the root as a workspace member.
- The installed version on this machine (1.3.14) is older than the version the documentation describes (1.4.3), so some documented settings may not exist locally.
- Both parts would change tools before the deadline.

### Option 4: pnpm plus Turborepo or Nx

Same workspace, with a task runner for caching and a pipeline file.

**Pros**:
- Task caching and dependency aware ordering.

**Cons**:
- Another tool and config for a two app, two package repo, with no slow build yet to cure.

### Option 5: move the house into `apps/house`

Root becomes only the workspace.

**Pros**:
- The standard shape, and no root oddity.

**Cons**:
- Every house path, doc and the sandbox startup move now, before the deadline, for no gain the house needs yet.

## Rationale

The funnel is the live part and already runs on pnpm. The spec 0005 version list, release age rule and build approvals map straight onto pnpm features, so Option 1 adds no new tool to the part that carries the deadline. Option 2 moves the live part to a tool that lacks those rules. Option 3 is a credible tool, and your question was a fair one, but its strengths (install speed, running code on bun) are not what this repo needs, and the points that matter here are unconfirmed. If you later decide installs are your pain, the move is small because both tools use text lockfiles and similar workspace files.

Options 4 and 5 add moving parts for a repo this size. Plain pnpm filters do the job, and the house stays at the root so the Grok sandbox preview, which starts the app from the repo root, keeps working. The cost is the explicit house task names.

Per part lint and format are the safe reading of "lint and format cannot rewrite the other part". Mass reformatting the funnel's plain ES5 scripts, Astro files and Convex files would produce a very large diff days before the cutover, in code that is live. So the funnel and the two packages made from its code opt in later, one at a time.

CI follows from the data: this is a GA tier project with minors' data, and the repo has no check at all. The workflow is deliberately small and credential free, so it can never touch a deployment or student data. The browser tests need a development deployment and secrets, so they stay out until you decide how to scope those secrets.

## Evidence

### Current state of the repo (read 2026-10-17)

| Item | House (root) | Funnel (`apps/joining`) |
|---|---|---|
| Package manager and lockfile | npm, `package-lock.json` | pnpm, `pnpm-lock.yaml` and its own `pnpm-workspace.yaml` (`allowBuilds`: esbuild, workerd; release age exception `astro@7.3.7`) |
| Tests | `node --test` over `scripts/**/*.test.mjs` plus four `src/lib` tests | Vitest projects `convex` (edge runtime) and `pages`, Playwright in `e2e/` |
| Lint and format | ESLint 9 flat config, Prettier (`.prettierrc`: double quotes, semicolons, trailing commas, 100 columns) | none |
| Type check | `tsc --noEmit` | `pnpm exec tsc --noEmit` (no script) |
| Dev ports | 8080 | 4321 |
| CI and hooks | none | none |
| Node | no engines field, `@types/node` 22 | `engines.node >=22.12.0` |

Machine: Node 24.18, npm 11.18, pnpm 12.10.1, bun 1.3.14, corepack 0.35.

### Facts that decided specific points (checked 2026-10-17)

- pnpm documents `catalog:` in `pnpm-workspace.yaml` for one shared version list, and `minimumReleaseAge` with `minimumReleaseAgeExclude` for the release age rule. Recursive commands exclude the root project unless `includeWorkspaceRoot` is true.
- Build script approval is `allowBuilds` in pnpm's settings. Its exact syntax and relation to older names was not confirmed, so the first install is the test.
- Pinning pnpm: sources disagree between `packageManager` and `devEngines.packageManager`, so the build confirms which the installed version writes.
- `pnpm/action-setup` reads the pinned pnpm version when `version` is omitted, and does not set up Node. `actions/setup-node` documents `cache: pnpm`. pnpm's own CI page also shows a newer `pnpm/setup` action and says a frozen install is automatic in CI. The spec uses `pnpm/action-setup` and an explicit frozen install, which is harmless.
- Bun: workspaces, `--filter`, catalogs, `minimumReleaseAge` in `bunfig.toml` and `trustedDependencies` are documented. Windows stability and tool compatibility were not confirmed.

## References

**Project sources**:
- Root `AGENTS.md`, `scripts/AGENTS.md` and `apps/joining/AGENTS.md`: the commands, rules and the Linux only sandbox scripts
- `apps/joining/pnpm-workspace.yaml` and `apps/joining/package.json`: the funnel's pnpm settings and scripts
- Spec 0001 and its children 0002 (the shared packages) and 0005 (the shared version list), `docs/scope/_root/scope.md` row 3
- `startup.sh` and `vite.config.ts`: the sandbox start and the house's build

**Practices & standards**:
- One lockfile and one package manager per repo
- Pin the package manager and Node versions
- Frozen installs in CI, least privilege CI permissions, and pin third party actions to a commit
- Supply chain controls: a minimum release age and approved build scripts

**Links** (each page was fetched and checked on 2026-10-17):
- [pnpm, running commands in many projects](https://pnpm.io/cli/recursive): recursive runs skip the root project by default
- [pnpm, settings](https://pnpm.io/settings): workspace and build settings including `includeWorkspaceRoot` and `allowBuilds`
- [pnpm, catalogs](https://pnpm.io/catalogs): the shared version list
- [pnpm, dependency resolution settings](https://pnpm.io/settings/dependency-resolution): `minimumReleaseAge` and its exclusions
- [pnpm, continuous integration](https://pnpm.io/continuous-integration): CI setup and automatic frozen installs
- [pnpm/action-setup](https://github.com/pnpm/action-setup): the setup action and its version resolution
- [actions/setup-node, advanced usage](https://github.com/actions/setup-node/blob/main/docs/advanced-usage.md): the pnpm cache option
- [Bun workspaces](https://bun.com/docs/pm/workspaces), [bun install](https://bun.com/docs/pm/cli/install), [Bun lifecycle scripts](https://bun.com/docs/pm/lifecycle), [Bun installation](https://bun.com/docs/installation): the alternative that was checked

Not confirmed by the checks: the exact `allowBuilds` syntax, the pnpm pin field for version 12, whether Corepack is still the recommended route on Node 24, Bun on Windows, and Bun's support for Convex, Wrangler, Astro and Playwright.
