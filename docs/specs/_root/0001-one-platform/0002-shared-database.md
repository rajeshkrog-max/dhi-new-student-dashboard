# 0002. Shared database: Convex for both parts

## Summary

Convex is the one place data lives, for the funnel today and the house later. The funnel's data stays where it is. The backend code moves out of `apps/joining/convex` into a shared package so both parts use it, and there is one Convex deployment per environment. The house reads and writes through it from the browser with the signed in token, and every rule lives inside Convex functions. (basis: the funnel already runs on it, spec 0001 of the funnel)

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): Convex for both.

**What is decided**:
- **One project, one deployment per environment.** Production keeps its current deployment (`abundant-caiman-975`) and development keeps `proper-camel-616`. House tables are added to the same schema later, additively. No second Convex project.
- **Two shared packages, so no package depends on an app.** The backend imports funnel files today (`scoring.ts` loads the engine scripts, `reportCopy.ts` and `sharePayload.ts` import `result.ts`, and the Convex tests import test helpers). Moving `convex/` alone would make the package depend on the funnel app, a loop. So:
  - `packages/engine/` holds the pure shared code: `questions.js`, `score.js` (the scoring engine, plain ES5 scripts that fall back to `globalThis`) and `result.ts` (the pure parts of the saved result). The funnel build copies the two engine scripts to `public/dhiinterviews/js/engine/` at the same public addresses, so page addresses do not change. That copy is generated, git ignored, and a test fails if it is missing or differs. `session.ts` imports `result.ts` from the package.
  - `packages/backend/` holds `convex/`, its `convex.json`, its tests, and the Convex test helpers and fixtures (`convexTestUtils.ts`, `fakeSheets.ts`, `fixtures/score-lock.json`). The browser script tests stay in the funnel. Pages already import `consentText.ts` and `feedbackRules.ts` from the backend, which is the allowed direction (app to package).
  - The folder names are the working choice. The workspace from scope row 3 decides the final tooling.
- **One Convex CLI home.** `convex.json` (with `"functions": "convex/"`) sits in `packages/backend/`. Only that package runs `convex dev` and `convex deploy`, and `.env.local` is written there. The apps never run the CLI: they read only `PUBLIC_CONVEX_URL` and `CONVEX_SITE_URL`. They import the generated API through one named export of the package. `_generated/` stays committed. This stops two apps from running two watchers against `proper-camel-616`.
- **Browser access.** The browser talks to Convex with the signed in token. No function takes a student id, email or auth user id as input, as the funnel's rule already says. The one allowed exception is the funnel's team functions behind the team check (funnel spec 0008).
- **Tenancy.** Every row a person owns carries `student_id` and `institute_id` (`institute_id` is empty for a funnel only student). Convex has no row level policy, so every query and mutation scopes by the verified identity inside the function. Scope row 4 and the dashboard work design the institute and role model on top.
- **Additive rule stays.** A table or field is added in one release and removed in a later one. Saved rows meant to be final (`results`, `resultFlags`, `consents`, `consentTexts`) are never patched or deleted by app code, except the erase path of funnel spec 0014.
- **The house's Postgres, PGLite and Neon are removed** (see 0005). Nothing is copied from them: they hold no real data.

**Value sourcing** (where each value comes from, nothing left to invent):

| Action | Value | Source |
|---|---|---|
| Any signed in call | Who the person is | The verified Better Auth session in the Convex auth context, never an argument |
| Any house read or write (later) | `institute_id` | The person's account record in Convex, set when the account is created or invited, never a client value |
| Production versus other environments | Which deployment to use | The Worker variable `CONVEX_SITE_URL` and the public Convex URL, set per environment (see 0004) |
| Backend deploy | Which deployment is targeted | The Convex deployment named in the environment, with the funnel's deploy guard: a production deploy needs fresh explicit consent |

**Key invariants**:
- No student data is copied or rewritten by this decision.
- Production data is never touched by a test, a preview or the development deployment.
- An erase of a student follows the funnel's data map (spec 0023) for every table, including house tables added later: each new table gets a class (`erased`, `kept`, `patched`, `system`) in the same release.

**Security model**: the browser is untrusted. Convex functions check the verified identity, ownership and tenant on every call. Public reads (the leaderboard, the shared report) use dedicated functions that return only the allowed fields. Compliance scope: personal data of students under 18 in India (parental consent, no personal data in logs).

**Configuration required**:
- Existing Convex environment variables stay as they are, per deployment (funnel spec 0001, configuration and secrets).
- New: `BETTER_AUTH_TRUSTED_ORIGINS` as a Convex environment variable per deployment (see 0003).
- New, deploy only: a production Convex deploy key, held on the owner's machine or deploy environment, never in the repo and never in a Worker variable (see 0004).

## Short rationale

The funnel already holds the only real data, a live ranking and minors' consent records, on Convex. Moving it to another database in 13 days is the highest risk path and gains nothing the deadline needs. The house has no data, so choosing Convex costs it nothing today. The price is paid later and is named in the umbrella: no database constraints, and reporting built from rollups. (basis: strangler pattern, move the live thing last or not at all)
