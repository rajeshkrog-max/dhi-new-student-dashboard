# 0001. One platform for the funnel and the house: database, sign in, host and dependencies

**Date**: 2026-10-17
**Status**: Accepted

## Summary

The DhiRise funnel and the student house become one app on one platform. Convex is the single database and backend, Better Auth with Google sign in is the single account system, and Cloudflare Workers hosts both parts on the one dhirise.com address, with the funnel at `/dhiinterviews` and the house on the main address. The live funnel keeps its data where it is, so no student record moves. What moves is where the code lives and where it is served from. The backend code goes into a shared package, the funnel moves from Cloudflare Pages to Workers, and both parts share one pinned version list.

## Structure

This is an umbrella. The cross part rules sit here, and each part of the decision has its own child spec.

- [0002 Shared database](0002-shared-database.md): Convex is the one system of record, with one deployment per environment, the backend in a shared package, and the shared engine code in a second package.
- [0003 Shared sign in](0003-shared-sign-in.md): one Better Auth instance inside Convex, Google only, on one origin, and the house's Postgres and Grok broker pieces removed.
- [0004 Shared host and routing](0004-shared-host-and-routing.md): Cloudflare Workers for both parts, the funnel moves off Pages, and one domain split by path.
- [0005 Shared dependencies](0005-shared-dependencies.md): one pinned version list for the libraries both parts use, and what the house drops.
- [0007 The thin thread](0007-thin-thread.md): the build spec for phase 3 and scope row 6, the house `/thread` page that signs in, saves question 1 and reads it back on the shared platform.

The package manager, install and build commands, lint and format, and CI are not decided here. They belong to scope row 3 (shared workspace and tooling), and the build below assumes that row provides a workspace.

## Decision

**Chosen option**: Option 1: Convex, Better Auth and Cloudflare Workers for both parts.

Run both parts on one Convex deployment per environment, one Better Auth instance, one pinned set of shared dependencies and one Cloudflare account, served from one origin, and move the live funnel onto it in stages that keep the old setup as a working fallback until the new one is proven.

**Implementation skills**: `convex` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex/`) · `convex-auth` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-auth/`) · `convex-authz` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-authz/`) · `convex-env` (`get-convex/agent-skills`, `apps/joining/.claude/skills/convex-env/`) · `better-auth-best-practices` (`better-auth/skills`, `apps/joining/.claude/skills/better-auth-best-practices/`) · `better-auth-security-best-practices` (`better-auth/skills`, `apps/joining/.claude/skills/better-auth-security-best-practices/`) · `workers-best-practices` (`cloudflare/skills`, `apps/joining/.claude/skills/workers-best-practices/`) · `wrangler` (`cloudflare/skills`, `apps/joining/.claude/skills/wrangler/`)

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript, strict, one version for both parts. Funnel page scripts stay plain JavaScript | Both parts already use it, and one version stops shared code from compiling two ways |
| Database and backend | One Convex project. One production deployment, one development deployment, preview deployments follow the funnel rule | The funnel's real data already lives there, so nothing moves before the deadline, and the house has no data yet |
| Auth | Better Auth through the Convex component, Google sign in only for now, served at the site's own `/api/auth/*` | Both parts already use Better Auth, and the funnel's live accounts stay valid |
| Funnel framework | Astro 7, static output, unchanged | Rewriting 37 working page scripts adds risk and no value |
| House framework | TanStack Start (React 19), built for Workers with the Cloudflare Vite plugin, replacing the Nitro Vercel preset | The official Cloudflare route for this framework, and Convex has an official quickstart for it |
| Hosting | Cloudflare Workers for both parts. The funnel moves from Pages to Workers with static assets. The house is its own Worker | One host and one account, and Cloudflare says new projects should start on Workers. Browser Run for the report PDF is already there |
| Routing | One domain, one origin. At cutover the funnel Worker owns `dhirise.com/*`. When the house ships, the funnel keeps its specific routes and the house takes the rest | One sign in cookie works for both parts, and funnel spec 0001 already kept the main address free |
| Data access from the browser | Browser talks to Convex with the signed in token, every rule inside Convex functions | The funnel's model, and it gives live updates for the study hour and the desk |
| Background jobs | Convex scheduled functions | Already in use for the Sheet copy, report copies and the board job |
| File storage | Convex file storage for report PDFs. Static assets stay on Cloudflare | Already in use, unchanged |
| Shared dependencies | One pinned version list, see 0005 | The two parts differ today (Better Auth, TypeScript, Vite) |
| Observability | Not decided here. Scope row 5 decides it | Row 5 owns environments, secrets and alerts |

## Cross part contract

Every child spec and every later row must keep these.

- **One origin.** The funnel owns `/dhiinterviews*` (with no trailing slash too), `/s/*`, `/api/*` and `/_astro/*`. The house owns every other path once it ships. The `/api/*` forwarders stay in the funnel Worker and serve both parts, because both parts use one Convex site address. House server routes never use `/api/*`; they use `/app-api/*` (the house code that calls `/api/rtc` moves to it).
- **One account.** A person has one Better Auth account. The house reads the same session as the funnel. Roles, invites and institutes are decided in scope row 4 and the dashboard work, not here.
- **One backend.** There is one `convex/` source, in `packages/backend/`, with its own `convex.json`. Only that package runs `convex dev` and `convex deploy`. Apps read only `PUBLIC_CONVEX_URL` and `CONVEX_SITE_URL`, and import the generated API through a named package export. A table or field is added in one release and removed in a later one (the funnel's additive rule stays).
- **No data moves.** No student, check, result, lead, consent or challenge row is copied or rewritten by this decision. Any later step that would do so must stop and come back to `/architect`.
- **Fallback until proven.** The Cloudflare Pages project and its deployment stay intact and switchable until the Workers setup has served the live domain without incident and the team calls it stable.
- **Sign in addresses.** Google needs each redirect address listed exactly: `https://dhirise.com/api/auth/callback/google`, `https://staging.dhirise.com/api/auth/callback/google`, `http://localhost:4321/api/auth/callback/google` (funnel) and `http://localhost:8080/api/auth/callback/google` (house). The Better Auth trusted origins list (see 0003) holds the same four, and no other.
- **Environment mapping.** Production talks to the production Convex deployment. Every other environment talks to the development deployment, so test data never mixes with real students.
- **Student data rules stay.** Rows owned by a person carry `student_id` and `institute_id`, never return another institute's rows, no ability or rank labels, flags stay private, and the funnel's consent rules for students under 18 stay in force.

## Migration plan

**Strategy**: strangler. Build the new layout and host beside the live one, prove it on a staging address, then switch with a small, reversible step. The old setup stays ready to switch back to.

**Phases**:
1. Backend and engine move, development only, no live change. The workspace comes from row 3. `convex/` moves into `packages/backend/`, and the shared pure code moves into `packages/engine/` (see 0002). The funnel's `deploy:pages` script is split so the Pages only deploy (`wrangler pages deploy dist`) keeps working on its own, and the old `convex/` folder is deleted in the same change, so nothing can push a stale tree to production. Push to the development deployment only, and run every funnel test.
2. Funnel on Workers at `staging.dhirise.com`. Build the funnel as a Worker with static assets and the `/api/*` forwarders, with the headers and redirect rules carried over. It talks to the development deployment. Run the full browser tests and the live path checks (scope row 11) against that address.
3. House on Workers, development only. Remove the house's database and broker pieces (see 0005), build it for Workers, and run the thin thread (scope row 6): sign in, save an answer, read it back, against the development deployment. No house route is added to the live domain.
4. Cutover (scope row 13), the funnel Worker only. The production backend is not redeployed that day, because the 5 minute board job is running. Steps: export production first (see handling below), run the synthetic check against production as it stands, add the Worker route `dhirise.com/*` to the funnel Worker, run the synthetic check again. The Pages custom domain and its DNS record stay in place.
5. Production backend from the new package, after the board freezes (after 2026-10-30 23:59 IST). The first production deploy from `packages/backend/` is a normal additive release with the deploy guard's fresh explicit consent.
6. Stabilise, then retire. After the team calls the move stable, retire the Pages project (scope row 14).

**Cutover day controls**:
- **Window.** A weekday morning in IST when traffic is lowest, not in the last three days before the deadline. Target on or before 2026-10-27.
- **Change freeze.** No merges to the funnel or the backend from 24 hours before until 24 hours after.
- **Synthetic check, right after the switch.** One script calls all eight forwarders (`health`, `auth`, `avatar`, `files`, `referral`, `render`, `shared`, `team`) and checks each expected status and header (including the `x-visitor` header on the referral check), checks that `/` redirects to the landing page with `?ref=` intact, and opens a `/s/<code>` page. It never uses a real student. Signing in the test student is checked on a development build only.
- **Rollback trigger.** The owner decides, within 15 minutes of the switch. Any synthetic check failure, a failed sign in, or a wrong referral count is an automatic yes.
- **Production export handling.** The export is a file of minors' data. Keep it on an encrypted disk, outside the repo and outside any sync folder, named with its date, and never open it in an AI session. The owner deletes it 30 days after the move is called stable.

**Rollback**: delete the Worker route. Traffic returns to the Pages project, which was never touched. The backend only gains things in this plan, and on cutover day it is not changed at all, so no data restore is needed.

**Risks**:
- A route must beat the Pages custom domain on this zone. The first spike proves that Worker routes take precedence, and that deleting the route restores Pages, before any live change.
- A misrouted `/api/referral` or a missing `x-visitor` header quietly loses referral credit in a live ranking, and that cannot be fixed afterwards. The synthetic check covers it.
- The Google OAuth callback must land on the funnel Worker. The `/api/*` route and the callback address list cover it.
- The funnel's headers, redirects and forwarders must behave identically on Workers. Row 11 is the guard.
- The Convex plan stays as it is (see Consequences). A traffic spike can hit the call limit, and there is no scheduled backup on this plan.

## Consequences

**Positive**:
- No student record moves, so the live ranking and minors' consent records are not touched by a data copy.
- One account, one backend, one origin: a student who signs in on the funnel is already known to the house.
- Dead weight leaves the house (Postgres, PGLite, the Grok broker), shrinking its dependency list and audit surface.
- One host and one set of secrets to operate for a very small team.

**Negative / tradeoffs**:
- The data is relational but Convex is a document store with no database level constraints. Uniqueness and tenant isolation (`student_id`, `institute_id`) live in code inside mutations, and a missed check is a real bug. The Master Spec's reporting (medians, spread, cohort rollups, a weekly bootstrap test) becomes incremental rollups and scheduled jobs, not ad hoc SQL.
- Vendor lock in: Convex functions do not port to another database without a rewrite.
- No India region exists for Convex, and a region cannot be changed later. Student data may live outside India. The privacy notice must say where, and an institute that demands India only storage reopens the database choice.
- The current Convex plan has no scheduled backups. Periodic backups need the Pro plan. You chose to stay on the current plan, so recovery depends on manual exports you run yourself until that changes. This is a conscious risk with live minors' data.
- Moving the funnel host and the backend home in the same 13 days as a live challenge is the riskier path. The fallback and the staged order exist to contain it.
- The house's rule that database code is server only no longer holds. Rules move into Convex functions, and a mistake there is visible to the browser.
- The house framework is a release candidate (TanStack Start), so its API can still change.
- **Compliance scope**: students under 18 in India, so verifiable parental consent applies (India's DPDP Act, section 9). Audit logging of access to personal data is not negotiable: the funnel's team audit table and its rule that no personal data goes into a log carry over to the shared platform.

**Neutral**:
- Scope rows 7 to 10 (moving the check, leads, reports and the challenge onto the shared platform) collapse. That data layer is already Convex, so those rows become verification under the new layout and host. Scope row 12 (live data copy) shrinks to an export, a backup and a counts check. Run `/scope` to reconcile.
- Root `AGENTS.md` (`## Stack`, the database server only rule, the Postgres mentions) is stale once this is built. `/sync` updates it.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Follow-up

- [ ] Run `/scope` to reconcile rows 7 to 12 with this decision: the data does not move, so those rows shrink.
- [ ] Scope row 3 must land a workspace before the backend moves into a shared package (phase 1).
- [ ] The first Workers spike must verify: that Worker routes take precedence over the Pages custom domain and that deleting the route restores Pages, `_headers` and `_redirects` behaviour in static assets, `html_handling` matching Pages for `/page` and `/page.html`, and the staging environment mapping to the development deployment.
- [ ] Create `staging.dhirise.com` (DNS and a Worker custom domain), and add it to the Google OAuth client, the trusted origins list and the development `REPORT_RENDER_BASE_URL`.
- [ ] Create the deploy credentials (see 0004): a Cloudflare token limited to Workers scripts and zone routes, and a production Convex deploy key, each with its own scope and neither in the repo.
- [ ] Decide whether the house's Grok connectors client (`src/lib/app-data/`) stays. It is unused today and sits on the Grok connector hosts.
- [ ] Confirm production Convex's region and plan, and write the region into the privacy notice (funnel spec 0021 and the privacy page).
- [ ] Add the house's localhost redirect address and the staging address to the Google OAuth client, and to the trusted origins list.
- [ ] The installed Convex, Better Auth and Cloudflare skills sit under `apps/joining/.claude/skills/`, so they do not reach house work at the repo root. Put them where both parts see them, and add an `## Agent skills` section to root `AGENTS.md`.
- [ ] Revisit the Convex plan (Pro for scheduled backups) before the first institute's real data arrives.
- [x] Decide the TypeScript version once the first thin thread proves the house's lint and type check on it (see 0005). Settled 2026-10-18: 6.0.3 for the house and shared packages, and the funnel moves in scope row 17.
