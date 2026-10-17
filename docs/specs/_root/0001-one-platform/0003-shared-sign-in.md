# 0003. Shared sign in: Better Auth inside Convex, Google only

## Summary

There is one account system: Better Auth running inside Convex through its Convex component, with Google as the only sign in method for now. A student who signs in on the funnel is already known to the house, because both parts use the same session on the same origin. The house drops its own Better Auth server, its Postgres store and the Grok broker. Staff roles and invites are not decided here. (basis: the funnel's live sign in, funnel spec 0002)

## Decision

**Chosen option**: Option 1 of [rationale.md](rationale.md): Better Auth on the shared database with its own Google sign in.

**What is decided**:
- **One auth server.** The Better Auth instance in the shared backend package is the only one. It is served at the site's own `/api/auth/*` through the funnel Worker's forwarder, so the session cookie sits on one origin and works for both parts. (basis: funnel spec 0001, browsers block cookies set across two addresses)
- **House uses it.** The house stops running `src/lib/auth/server.ts` (its own Better Auth, `pg`, PGLite and the Grok broker through `genericOAuth`). It reads the session through the Convex Better Auth integration for TanStack Start, which the Convex component documents as supported. The funnel stays on its current Astro wiring, which that page does not list, so it keeps using the site's own `/api/auth/*` as today.
- **Method.** Google only. Email and password, magic links and invites are not enabled by this decision. The house's `email-password` flag stays off.
- **Addresses.** The redirect address list is in the umbrella contract. Google does not allow wildcards, so every address is listed exactly.
- **Trusted origins, a code change in `convex/auth.ts`.** Today `baseURL` and `trustedOrigins` come from the single value `BETTER_AUTH_URL`, but one deployment must now serve `https://dhirise.com`, `https://staging.dhirise.com`, `http://localhost:4321` and `http://localhost:8080`. Add a Convex variable `BETTER_AUTH_TRUSTED_ORIGINS` (a comma list, trimmed and lowercased, exactly those four on the development deployment and only `https://dhirise.com` on production). The base address is taken from the forwarded host header only when that origin is in the list. Otherwise it falls back to `BETTER_AUTH_URL`. A forwarded host that is not in the list is refused, never trusted.
- **House session token.** The house reads the Convex token on the client from `/api/auth/convex/token` (the Better Auth Convex plugin's token route, served through the funnel Worker's `/api/*` forwarder), not by calling `https://dhirise.com/api/...` from its own server, because one Worker cannot fetch another Worker on the same zone without a service binding. The spike confirms the route name against the component version in use. If server side rendering of signed in house pages is needed later, that is decided then, with a service binding as the likely answer.
- **Local development.** The house's `vite.config.ts` gets a `/api/auth` proxy to the development Convex site, like the funnel's Astro config, with the forwarded host headers for `localhost:8080`. Local sign in is per app: two localhost ports are two origins, so no session is shared locally.
- **Preview.** Other environments use the funnel's test only sign in (a fake student, on development and preview only, switched off in production by `TEST_SIGNIN_ENABLED`). The house's sandbox sign in popup and its preview bearer token path belong to its own auth server, so they go with it (see 0005). In the Grok sandbox the house runs signed out on demo data until the dashboard work decides otherwise.
- **Account record.** One Better Auth user per person. The funnel's `students` table is keyed to it. Scope row 4 decides how the house's roles (student, teacher, institute admin, DHI admin, counselor) and `institute_id` attach to the same user.
- **Sign out.** The house uses the funnel's sign out rule: the device copy is wiped only after the server confirms the session ended.

**Value sourcing**:

| Action | Value | Source |
|---|---|---|
| Sign in | Google client id and secret | Convex environment variables per deployment (existing) |
| Sign in | Site address for callbacks and cookies | `BETTER_AUTH_URL`, set per deployment to the site address |
| Any house call | The signed in person | The session read from the cookie by the Convex integration, passed to Convex as a token |
| Local development of the house | Forwarded host so cookies match | The same `x-better-auth-forwarded-host` and proto headers the funnel's local proxy already sets, for `localhost:8080` |

**Key invariants**:
- A person never has two accounts because they used both parts.
- No client supplied user id is trusted anywhere.
- No secret reaches the browser or git.
- A student under 18 cannot reach the challenge or leave a phone number without the consent step the funnel already enforces.

**Security model**: sessions are cookie based on one origin. Better Auth rate limits and the funnel's per student limits stay on. The Google consent screen stays in Production mode and links the privacy page. Compliance scope: personal data of minors.

## Short rationale

Both parts already use Better Auth, so the question was only which instance survives. The funnel's has real students, a working Google client and a Convex component already carrying them. The house's is a template piece that depends on a platform broker and a Postgres store that production will not have. Keeping one instance means no second account and no migration. (basis: Better Auth Convex component lists TanStack Start as supported)
