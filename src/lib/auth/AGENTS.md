# Auth (`src/lib/auth`)

## Overview

Self hosted Better Auth at same origin `/api/auth/*`, federated to the Grok auth broker, with sessions kept in the same Postgres (or PGLite) as app data. The files were pre wired by the app template. This is separate from the demo "house" gate (`src/lib/dhi/gate.tsx`, `src/lib/session.ts`), which is a placeholder and not the real auth design. Real DHI entry is invite only (see `BACKEND.md`).

## Key files

| File | Owns |
|---|---|
| `server.ts` | Better Auth instance (server only, do not import from client code). Header comment explains the three modes |
| `client.ts` | Browser auth client, `authEnabled` flag, `signIn` / `signOut`, preview bearer token |
| `verify.server.ts` | `requireUserId` style session check from request cookies; `DEV_USER_ID = "dev-user"` |
| `middleware.ts` | `authMiddleware` for server functions; supplies a verified user id |
| `use-current-user.ts` | `useCurrentUser` / `useCurrentUserState`; returns `DEV_USER` when auth is off |
| `gates.tsx` | `SignedIn`, `SignedOut`, `RedirectToSignIn`; `SIGN_IN_PATH` is `/login` (that route does not exist yet) |
| `email-password.ts` | The single flag that enables local email and password |
| `pglite-dialect.ts` | Kysely dialect so Better Auth uses the shared PGLite instance in preview |
| `popup.server.ts` | OAuth popup handler, mounted by the Vite plugin in `vite.config.ts` (not a React route) |
| `gate-*.server.ts` | Verifies the platform identity header (`x-grok-identity`) with `jose` |
| `providers.ts`, `preview.ts` | Sign in providers and the shared preview client |

## Conventions

- Components read the user through `@/lib/auth/use-current-user`. Server functions get the user id through `@/lib/auth/middleware`. Never trust a client supplied user id.
- Sign out with `signOut()` from `client.ts`, not `authClient.signOut()`. The raw call leaves the preview bearer token in place and the visitor stays signed in.
- Per user tables use `user_id TEXT NOT NULL` (text, not uuid, because the dev user id is the string `dev-user`) and every query is scoped to the verified user on the server.
- The auth schema is `migrations/auth/0001_auth.sql`. It is generated, do not edit it, and it is not applied automatically. Put app tables in new files directly under `migrations/`.

## Gotchas

- Sign in is on unless `VITE_AUTH_ENABLED` is exactly `"false"`. The flag comes from `.grok/app-env.json` through `scripts/with-app-env.mjs`, and that file is gitignored and absent in a fresh checkout.
- With auth off, `requireUserId` returns the dev user, but once `DATABASE_URL` is set it fails closed and rejects every request.
- In the live preview the app sits in an iframe with partitioned cookies, so auth uses a bearer token in `sessionStorage`. Deployed builds use cookies.
- PGLite is in memory. A dev server restart wipes sessions and data.
- Do not rewrite `server.ts`; the header says it is pre wired for preview and deploy.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
