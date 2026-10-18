# Auth (`src/lib/auth`)

## Overview

The house signs in through the one shared Better Auth account system that lives in the shared Convex deployment (`packages/backend`, spec 0003 and 0007). The house has no auth server, no database and no broker of its own. The browser talks only to its own address, `/api/auth/*`, which the dev server and the preview forward to the Convex site address (`scripts/auth-proxy.mjs`, `scripts/auth-proxy-preview.mjs`), so the session cookie stays on one address. This is separate from the demo gate (`src/lib/dhi/gate.tsx`, `src/lib/session.ts`), which only drives the demo rooms.

## Key files

| File | Owns |
|---|---|
| `client.ts` | The browser auth client (`authClient`, with the Convex plugin), `signInWithGoogle`, `testSignIn` (dev only email and password), `signOutNow` and `refreshSession`. `testSignInOffered` is true only when `VITE_TEST_SIGNIN` is `"true"` |

The pages that use it are the front door `src/routes/enter.tsx`, the dashboard `src/routes/dashboard.tsx` and the Enter screen `src/components/dhi/enter-screen.tsx`. `ConvexSession` (`src/components/dhi/convex-session.tsx`) is the one place the Convex client and the sign in provider are joined.

## Conventions

- Signed in state is read in the browser only. A route that needs the student sets `ssr: false`, sits inside `ConvexSession`, and asks `students.me` only once `useConvexAuth` says the page is signed in. Never fetch anything about a student while signed out or loading.
- Sign out with `signOutNow()`, and act only when it answers true. It must never claim a sign out while the cookie is alive.
- No function takes a student id from the browser. The backend finds the student from the session.
- `VITE_TEST_SIGNIN` defaults to off. The real gate is `TEST_SIGNIN_ENABLED` on the Convex deployment (development only, never production).

## Gotchas

- The Convex integration's `AuthClient` type wrongly narrows `useSession().data` to `never` for a client built with only the Convex plugin. The one cast lives in `convex-session.tsx`.
- `authClient` takes `window.location.origin` as its base address, so on the server (where the module is only imported) it is undefined.
- The Cloudflare preview ignores Vite's `preview.proxy`, which is why `/api/auth` has its own preview plugin.
- Google sign in needs the house address on the Google redirect list (`http://localhost:8080/api/auth/callback/google`) and `BETTER_AUTH_TRUSTED_ORIGINS` on the Convex deployment.

## Related specs

[0003 shared sign in](../../../docs/specs/_root/0001-one-platform/0003-shared-sign-in.md) · [0007 thin thread](../../../docs/specs/_root/0001-one-platform/0007-thin-thread.md) · [0008 interview first entry](../../../docs/specs/_root/0001-one-platform/0008-interview-first-entry.md)

_Drafted by /sync from the introducing change, worth a quick human pass._
