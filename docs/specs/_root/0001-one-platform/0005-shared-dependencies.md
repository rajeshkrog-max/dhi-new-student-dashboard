# 0005. Shared dependencies: one pinned version list, and what the house drops

## Summary

The libraries both parts use are named once, with one version each, and both parts follow that list. The funnel's habit of waiting out a brand new release for a few days before accepting it is kept for the whole repo. The house drops everything that existed only for Postgres and the Grok sign in broker. The package manager and CI are scope row 3's job.

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): one shared list, pinned.

**What is decided**:
- **One list, one place.** A single catalog in the workspace names each shared library's version, and each part refers to it. The exact mechanism follows the package manager that scope row 3 picks.
- **Pinned.** Exact or tilde versions, not open ranges, and the funnel's rule of not accepting a release younger than a few days stays (today `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` carries one exception, `astro@7.3.7`).
- **Shared list, starting values.** Today's versions differ, so each row names the one to land on.

| Library | Funnel today | House today | Shared choice |
|---|---|---|---|
| Node | `>=22.12.0` | no engines field, `@types/node` 22 | `>=22.12.0` for both |
| TypeScript | `^7.0.2` | `^5.7.0` | One version. Start from the funnel's. If the house's lint and type check do not accept it, both stay on the highest version both accept (decided in the first thin thread) |
| Vite | `8.3.3` | `^8.2.0` | `8.3.3` |
| Better Auth | `~1.6.33` | `~1.6.30` | `~1.6.33` |
| Convex | `^1.46.0` | not used | The funnel's, pinned |
| `@convex-dev/better-auth` | `^0.12.5` | not used | The funnel's, pinned. The house adds only the integration its docs name for TanStack Start |
| Wrangler | `^4.148.0` | not used | The funnel's, pinned, used by both Workers |
| React | not used | `^19.2.0` | House only, no shared row |
| Astro | `^7.3.7` | not used | Funnel only, no shared row |

- **The house drops** (and nothing else depends on them): `pg`, `@types/pg`, `@electric-sql/pglite`, `kysely` (the Better Auth database dialect), the `nitro` dev dependency and its Vercel preset, `migrations/auth/0001_auth.sql`, `src/lib/db.ts`, `scripts/migrate.mjs`, `scripts/migration-plan.mjs` and their tests, the Postgres dialect and Grok broker code in `src/lib/auth/` (`server.ts`, `popup.server.ts`, `providers.ts`, `preview.ts`, `email-password.ts`, `pglite-dialect.ts`, `gate-*.server.ts`), the `authPopupPlugin` in `vite.config.ts`, and the `jose` header check for the platform identity. The `db:migrate` step leaves `npm run build`.
- **Removed with Nitro.** Nitro's `serverDir` is what wires `server/middleware/grok-pwa.ts` and `server/virtual-grok-og-identity.d.ts`, so both go with it. That is the deployed half of the sandbox install page, which production does not need. The dev half (`scripts/grok-pwa-plugin.mjs`) stays. The spike confirms nothing else reads them.
- **The house keeps** `src/lib/auth/isolation.server.ts` and `src/lib/app-data/` for now (the connector client uses the same site check). Whether the unused Grok connector client stays is a follow up in the umbrella.
- **The house keeps** the preview tooling (`preview-host-bridge`, `grok-pwa-plugin`, `app-env-plugin`, `with-app-env`, `startup.sh`) only while it is built in the Grok sandbox. They have no part in the shared platform and can go when that stops.
- **The house gains** the Convex client and the Better Auth Convex integration, `@cloudflare/vite-plugin`, and Wrangler.
- **Tests.** The funnel's Vitest with `convex-test` covers the backend. How the house's `node:test` suite and the funnel's Vitest suite share one command is scope row 3.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Install | Version of each shared library | The one catalog in the workspace |
| Accepting a new release | Minimum age | The existing release age rule, applied repo wide |
| House build | Which Vite and framework plugins | The house's own `vite.config.ts`, with the Nitro and PGLite plugins removed and the Cloudflare plugin added |

**Key invariants**:
- No library that both parts use appears at two versions.
- A shared version changes in one place, and both parts are tested before it lands.
- No house dependency remains whose only user was Postgres or the broker.

**Security model**: fewer database and auth packages means less to audit. The release age rule limits exposure to a freshly published malicious version.

## Short rationale

The two parts already use three of the same libraries at slightly different versions, and Better Auth sits in the sign in path for both, so a drift would show up as a sign in bug. One list stops that. The house's Postgres and broker pieces are template parts that production never uses, so removing them is a safe reduction, not a change of behaviour. (basis: your funnel's release age rule and pinning, spec 0001 of the funnel)
