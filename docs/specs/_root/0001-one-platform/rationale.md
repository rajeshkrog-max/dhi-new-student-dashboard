# 0001. Rationale: One platform for the funnel and the house

## Context

> ⚠️ Premise note: the shared data is relational (students, answers, referrals, and later institutes, papers and reports) and the chosen database is a document store. That is the "document store for relational data" pattern, which usually costs database enforced constraints and joins. It is acceptable here only because the funnel already runs on it with real data, Convex runs each mutation as a serial transaction (so uniqueness and referral rules hold when checked in code), and moving a live ranking with minors' data in 13 days is the larger risk. The cost returns later, when the Master Spec's reports have to be built as rollups. Funnel spec 0001 carried the same note.
>
> ⚠️ Premise note: you chose to keep the current Convex plan. Periodic backups need the Pro plan, so recovery depends on exports you run yourself while the data is live student data. And you chose to move both the funnel host and the backend home within the same 13 days as a live challenge. Neither is wrong, but each is a risk you are consciously taking, and the staged plan and the untouched Pages fallback exist to contain the second one.

DHI is one product with two parts in one repo. The DhiRise funnel is live at dhirise.com/dhiinterviews, brings students in, and holds real data: Google accounts, saved checks and results, leads, consents for students under 18, report copies, and a Founding Circle Challenge with a live ranking that ends on 2026-10-30. The student house (the dashboard) is a set of screens on demo data with a backend brief, and it is not being built yet.

Today the two parts share almost nothing underneath. The funnel is Astro on Cloudflare Pages with a Convex backend and Better Auth through a Convex component. The house is TanStack Start on a Vercel preset, with Postgres (Neon, or an in memory PGLite locally) and its own Better Auth server that signs in through a platform broker. Both use Better Auth, at slightly different versions.

You asked for the two to use the same databases and dependencies, with the live interviews staying functional, and to move before the challenge ends. The funnel needs to keep serving at its current addresses with the same sign in cookie. The house will later need one account for the same students. The audience is students from Class 8 to college in India, many under 18, so verifiable parental consent applies (India's Digital Personal Data Protection Act, section 9) and no personal data may go into a log.

Without a decision, the house would be built against a database and sign in system that the live funnel does not use, and every later report that needs a funnel student would join across two systems.

## Options considered

### Option 1: Convex, Better Auth and Cloudflare Workers for both (chosen)

One Convex deployment, one Better Auth instance, both parts on Cloudflare Workers under one domain. The funnel's data stays, the house's Postgres and broker pieces are removed.

**Pros**:
- No student record moves, so the live ranking and consent records are not at risk from a data copy.
- One account and one origin: one cookie works for both parts.
- One host and one account to operate for a very small team.

**Cons**:
- No database constraints, and heavy reporting built from rollups instead of SQL.
- No India region, and the region cannot be changed later.
- Vendor lock in to Convex.

### Option 2: Postgres (Neon) and Better Auth for both

Move the funnel's backend and data to Postgres, matching the house's current database and the Master Spec's SQL style.

**Pros**:
- Real constraints, joins and SQL for rankings, exports, cohort reports and erasure across tables.
- Portable if the host changes.

**Cons**:
- 51 backend source files and 24 test files, the scheduled jobs, the Sheet copy queue and the board job would be rewritten and re tested, and live minors' data moved, in 13 days with a live ranking.
- No India region on the common Postgres hosts either (the funnel's earlier review found the nearest at Singapore).
- Loses live queries unless rebuilt.

### Option 3: Two databases, one account

Convex keeps the funnel, Postgres serves the house, and only sign in is shared.

**Pros**:
- Nothing live is touched.
- Each part keeps the database that suits it.

**Cons**:
- It is not the shared database you asked for, and cross part features join across two systems.
- Two sets of backups, secrets and migrations to operate.
- A student's identity would still need a bridge between the two stores.

### Option 4: Vercel for both parts

Keep the house on Vercel and move the funnel there too, or keep Convex and Better Auth in place.

**Pros**:
- The house already targets it.

**Cons**:
- The funnel's address rules, headers, forwarders and the Browser Run report job would have to be rebuilt on a second host, and Browser Run stays on Cloudflare anyway.
- Two vendors and two sets of secrets for a team of one.

## Rationale

The deadline decides the database. The funnel's data is the only real data in either part, and it sits on Convex, with a live ranking and consent records for minors. Option 2 puts that data and 51 files of tested backend logic through a rewrite and a move in the same 13 days, which is the failure pattern of a big bang rewrite of a production system. Option 1 moves nothing. The house has no data yet, so it is the cheapest time to align it. The cost, named above, is the Master Spec's reporting built as incremental rollups and scheduled jobs, which Convex can do, and which the Master Spec's own design (events, daily values stored as a numerator and denominator, frozen periods) already suits.

Sign in follows the database. Both parts use Better Auth, so only one instance can survive, and the funnel's has the live accounts, the Google client and the Convex component. The house's instance depends on a platform broker and a Postgres store that production will not have.

On the host, the house's framework officially deploys to Cloudflare Workers, not to Pages, and Cloudflare says new projects start on Workers. The domain and Browser Run are already on Cloudflare. That makes one host the simplest operation for one person. You chose to move the funnel to Workers now and the backend into a shared package now. The Staff recommendation was to leave both until after the challenge, since neither is needed for the house to start and both add risk during a live ranking. You asked for them now, so the spec sequences them so that the live funnel is unchanged until the domain switch, the Pages project stays as an instant fallback, and the backend only gains things so the old front end still works if you switch back.

Convex's region and plan limits are real. They are accepted, not hidden: the region goes into the privacy notice, and Pro for scheduled backups is listed as follow up to take before an institute's real data arrives.

## Evidence

### What the house removes, and why each is safe

| Item | Why it exists | Why removing is safe |
|---|---|---|
| `pg`, `@types/pg`, `kysely`, `@electric-sql/pglite`, `src/lib/db.ts`, `src/lib/auth/pglite-dialect.ts` | The template's Postgres store for app data and sessions | The house stores demo data in the browser only. Its migrations folder holds only the generated auth schema |
| `migrations/auth/0001_auth.sql`, `scripts/migrate.mjs`, `scripts/migration-plan.mjs` | Applies the schema at build | There is nothing to apply once Postgres is gone |
| Grok broker code in `src/lib/auth/` (`genericOAuth`, `providers.ts`, `preview.ts`, `gate-*.server.ts`, `jose` header check) | Signs in through the platform broker and trusts the platform identity header | Production signs in through the funnel's own Google client |
| `nitro` and the Vercel preset in `vite.config.ts` | Builds the house for Vercel | Replaced by the Cloudflare Vite plugin |
| `npm run db:migrate` step in `npm run build` | Runs the migrator after build | No database migrations remain |

### Facts that decided specific points (checked 2026-10-17)

- TanStack Start's hosting page lists Cloudflare Workers as an official partner through the Cloudflare Vite plugin and Wrangler. It does not name a Nitro Cloudflare preset, and whether one is still supported is not confirmed.
- Cloudflare's Pages page says: "Workers is Cloudflare's primary platform for building applications. Start new projects with Workers." It also still presents Pages Functions as current, with no deprecation notice.
- The Convex Better Auth component page lists React, Expo, TanStack Start, Next.js and SvelteKit as supported. Astro is not listed.
- Convex periodic backups require the Pro plan (daily kept 7 days, weekly 14 days). Export through the CLI and dashboard exists. Plan names read "Pro" and "Professional" on different pages, and pricing was not confirmed from the official pricing page.
- Convex regions are N. Virginia, Ireland, Sydney and Canada. There is no India, Singapore or Mumbai region, and a region cannot be changed later, only moved by export and import.
- Convex has an official TanStack Start quickstart, which notes the framework is in release candidate.

## References

**Project sources**:
- Root `AGENTS.md` and `apps/joining/AGENTS.md`: the two stacks and the student data rules
- `apps/joining/docs/specs/0001-adopt-astro-convex-cloudflare-stack/` (stack choice, sign in addresses, environments), `0006` (report copy), `0014` (data export and erasure), `0021` (error monitoring), `0023` (data model map)
- `docs/scope/_root/scope.md`, row 2 and the surrounding rows
- `docs/DHI Master Spec - Metrics Storage Insights and Build Roadmap v1.pdf`: the reporting the database must later serve
- The installed Convex, Better Auth and Cloudflare skills in `apps/joining/.claude/skills/`

**Practices & standards**:
- Strangler pattern: build the new beside the old and keep the old until proven
- Additive (expand then contract) changes for a live backend
- Verifiable parental consent for a child's personal data
- Same origin cookies for one shared session

**Links** (each page was fetched and checked on 2026-10-17):
- [TanStack Start, hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting): Cloudflare Workers through the Cloudflare Vite plugin
- [Cloudflare Pages overview](https://developers.cloudflare.com/pages/): Workers is the primary platform, start new projects with Workers
- [Cloudflare, migrate from Pages to Workers](https://developers.cloudflare.com/workers/static-assets/migrate-from-pages/): the migration steps
- [Convex Better Auth component](https://labs.convex.dev/better-auth): supported frameworks, including TanStack Start
- [Convex, backups and restore](https://docs.convex.dev/database/backup-restore): periodic backups need Pro
- [Convex, regions](https://docs.convex.dev/production/regions): the available regions
- [Convex quickstart for TanStack Start](https://docs.convex.dev/quickstart/tanstack-start): the official integration guide
- [Strangler Fig Application, Martin Fowler](https://martinfowler.com/bliki/StranglerFigApplication.html): the practice behind the staged move
- [Digital Personal Data Protection Act, 2023, section 9](https://indiankanoon.org/doc/98869575/): an unofficial mirror. Check the official text and whether the Act is in force before relying on it

Not confirmed by the check: a Nitro Cloudflare preset, Convex official pricing, and the behaviour of Workers route precedence and static asset headers. The first spike verifies the last two.
