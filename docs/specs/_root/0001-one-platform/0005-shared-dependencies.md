# 0005. Shared dependencies: one pinned version list, and what the house drops

## Summary

The libraries both parts use are named once, with one version each, and both parts follow that list. The funnel's habit of waiting out a brand new release for one day (1440 minutes) before accepting it is kept for the whole repo. The house drops everything that existed only for Postgres and the Grok sign in broker. The package manager and CI are scope row 3's job.

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): one shared list, pinned.

**What is decided**:
- **One list, one place.** A single catalog in the workspace names each shared library's version, and each part refers to it. It is a pnpm `catalog:` list in `pnpm-workspace.yaml` (spec 0006).
- **Pinned.** Exact or tilde versions, not open ranges, and the funnel's rule of not accepting a release younger than one day (`minimumReleaseAge: 1440`, written down explicitly) stays (today `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` carries one exception, `astro@7.3.7`).
- **Shared list, starting values.** Today's versions differ, so each row names the one to land on.

| Library | Funnel today | House today | Shared choice |
|---|---|---|---|
| Node | `>=22.12.0` (never accurate: `undici@8.11.2` needs 22.19.0) | no engines field, `@types/node` 22 | `>=22.19.0` for both |
| TypeScript | `^7.0.2` | `^5.7.0` | **Settled 2026-10-18 (spec 0007, AC-13): `6.0.3`, pinned exactly, for the house and the shared packages (`packages/backend`, `packages/engine`).** The house type check accepts TypeScript 7.0.2, but `typescript-eslint` (8.71.2, still the latest) refuses to load on it ("does not support TS 7.0") and declares support only below 6.1, so the house cannot lint on 7. 6.0.3 is the highest version both accept. The funnel stays on `^7.0.2`, untouched until its own row (see "TypeScript, one version again") |
| Vite | `8.3.3` | `^8.2.0` | `8.3.3` |
| Better Auth | `~1.6.33` | `~1.6.30` | `~1.6.33` |
| Convex | `^1.46.0` | not used | The funnel's, pinned |
| `@convex-dev/better-auth` | `^0.12.5` | not used | The funnel's, pinned. The house adds only the integration its docs name for TanStack Start |
| Wrangler | `^4.148.0` | not used | The funnel's, pinned, used by both Workers |
| React | not used | `^19.2.0` (now `^19.3.1`, spec 0006) | House only, no shared row |
| Astro | `^7.3.7` | not used | Funnel only, no shared row |

- **TypeScript, one version again.** Until then two versions exist on purpose: 6.0.3 in the house and the shared packages, 7.0.2 in the funnel. Only the type check differs, because the built output of the funnel does not depend on the TypeScript version, and the funnel's type check reads the backend's types fine under 7. The funnel moves to the shared version in scope row 17 (the funnel built as a Worker), in the same change that already edits `apps/joining/package.json`, on the staging branch, proven by the funnel's own suite and `pnpm typecheck`. It never moves inside the freeze window around the cutover (spec 0001, cutover day controls). If `typescript-eslint` adds TypeScript 7 support before row 17, everyone moves to 7 instead, and `typescript` joins the shared `catalog:` list in the same change. When the funnel moves, the `typescript` entry in `EXCEPTIONS` in `scripts/check-catalog.mjs` is removed. Until then `check-catalog` carries that one entry, with its reason. (basis: spec 0007 AC-13 and AC-14; the funnel is not edited before the cutover)
- **The house drops** (and nothing else depends on them): `pg`, `@types/pg`, `@electric-sql/pglite`, `kysely` (the Better Auth database dialect), the `nitro` dev dependency and its Vercel preset, `migrations/auth/0001_auth.sql`, `src/lib/db.ts`, `scripts/migrate.mjs`, `scripts/migration-plan.mjs` and their tests, the Postgres dialect and Grok broker code in `src/lib/auth/` (`server.ts`, `popup.server.ts`, `providers.ts`, `preview.ts`, `email-password.ts`, `pglite-dialect.ts`, `gate-*.server.ts`), the `authPopupPlugin` in `vite.config.ts`, and the `jose` header check for the platform identity. The migration step leaves the house `build` script (`node scripts/migrate.mjs`).
- **Removed with Nitro.** Nitro's `serverDir` is what wires `server/middleware/grok-pwa.ts` and `server/virtual-grok-og-identity.d.ts`, so both go with it. That is the deployed half of the sandbox install page, which production does not need. The dev half (`scripts/grok-pwa-plugin.mjs`) stays. The spike confirms nothing else reads them.
- **The house keeps** `src/lib/auth/isolation.server.ts` and `src/lib/app-data/` for now (the connector client uses the same site check). Whether the unused Grok connector client stays is a follow up in the umbrella.
- **The house keeps** the preview tooling (`preview-host-bridge`, `grok-pwa-plugin`, `app-env-plugin`, `with-app-env`, `startup.sh`) only while it is built in the Grok sandbox. They have no part in the shared platform and can go when that stops.
- **The house gains** the Convex client and the Better Auth Convex integration, `@cloudflare/vite-plugin`, and Wrangler.
- **Tests.** The funnel's Vitest with `convex-test` covers the backend. How the house's `node:test` suite and the funnel's Vitest suite share one command is decided in spec 0006: each part keeps its own runner, and the root `pnpm test` runs them all.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Install | Version of each shared library | The one catalog in the workspace |
| Accepting a new release | Minimum age | The existing release age rule, applied repo wide |
| House build | Which Vite and framework plugins | The house's own `vite.config.ts`, with the Nitro and PGLite plugins removed and the Cloudflare plugin added |

**Key invariants**:
- No library that both parts use appears at two versions. The one named exception is TypeScript (6.0.3 and 7.0.2), which ends in scope row 17.
- A shared version changes in one place, and both parts are tested before it lands.
- No house dependency remains whose only user was Postgres or the broker.

**Security model**: fewer database and auth packages means less to audit. The release age rule limits exposure to a freshly published malicious version.

## Short rationale

The two parts already use three of the same libraries at slightly different versions, and Better Auth sits in the sign in path for both, so a drift would show up as a sign in bug. One list stops that. The house's Postgres and broker pieces are template parts that production never uses, so removing them is a safe reduction, not a change of behaviour. (basis: your funnel's release age rule and pinning, spec 0001 of the funnel)
