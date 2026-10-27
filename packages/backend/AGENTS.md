# @dhi/backend

The Convex backend for the whole platform: the funnel today, the house later (spec 0001, child 0002). One Convex project, one deployment per environment. The functions, tables, sign in and their rules are described in [convex/AGENTS.md](convex/AGENTS.md).

## Rules

- Only this package runs the Convex CLI (`convex dev`, `convex deploy`, `convex run`). It reads `CONVEX_DEPLOYMENT` from `packages/backend/.env.local` (git ignored, format in `.env.example`). Apps read only `PUBLIC_CONVEX_URL` and `CONVEX_SITE_URL`.
- Apps import only the named exports in `package.json`: `@dhi/backend/api` (the generated API), `consentText`, `dayRules`, `moodRules`, `habitCodes`, `sleepRules`, `blogRules`, `foodRules`, `hourRules`, `deskRules`, `sessionRules`, `counselRules`, `brainCodes`, `feedbackRules`, `challengeRules`, `reportVersion`. An exported file has no imports of its own, because the house's node tests load it directly. Add an export when an app needs another file, never a deep import.
- This package must not import or read an app. A check that needs an app file lives in that app's tests.
- Development deployment only unless the owner says otherwise. A production deploy, `run --prod` or `env set` on production needs the owner's fresh yes in that session (see the `convex-deploy-guard` skill). The funnel's additive rule stays: a table or field is added in one release and removed in a later one.
- `deploy` is a pnpm built in, so the deploy script is `deploy:convex`.

## Commands

```bash
pnpm --filter @dhi/backend dev          # convex dev (dev deployment)
pnpm --filter @dhi/backend dev:once     # push once
pnpm --filter @dhi/backend typecheck
pnpm --filter @dhi/backend test         # convex-test suites in convex/*.test.ts
```

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
