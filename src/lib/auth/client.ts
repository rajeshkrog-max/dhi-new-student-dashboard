// Browser side of the shared sign in (spec 0007, built on spec 0003). One Better Auth account system lives in the shared Convex
// deployment; the page talks only to its own address, `/api/auth/*`, which the dev server and the preview forward there
// (scripts/auth-proxy.mjs), so the session cookie stays on one address. The page keeps no token copy of its own: the Convex plugin
// reads one from `/api/auth/convex/token` and `ConvexBetterAuthProvider` hands it to Convex.
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // The page's own address, never the Convex one. The route is not rendered on the server, but its module is still imported there.
  baseURL: typeof window === "undefined" ? undefined : window.location.origin,
  plugins: [convexClient()],
});

// True only when the build flag asks for the test email form. It defaults to off, and the server's TEST_SIGNIN_ENABLED is the real gate.
export const testSignInOffered = import.meta.env.VITE_TEST_SIGNIN === "true";

// Starts Google sign in. The browser leaves for Google and comes back to `callbackURL`.
export async function signInWithGoogle(callbackURL: string, errorCallbackURL: string): Promise<{ ok: boolean }> {
  const { error } = await authClient.signIn.social({ provider: "google", callbackURL, errorCallbackURL });
  return { ok: !error };
}

// Fake sign in for automated tests, modelled on apps/joining/src/lib/session.ts: sign in, and make the account the first time.
// The server refuses it unless TEST_SIGNIN_ENABLED is on (development only).
export async function testSignIn(email: string, password: string): Promise<{ ok: boolean }> {
  const first = await authClient.signIn.email({ email, password });
  if (!first.error) return { ok: true };
  const second = await authClient.signUp.email({ email, password, name: "Test Student" });
  return { ok: !second.error };
}

// Ends the session. True only when the server says it worked, so the page never claims to be signed out while the cookie is alive.
export async function signOutNow(): Promise<boolean> {
  try {
    const { error } = await authClient.signOut();
    return !error;
  } catch {
    return false;
  }
}

// One forced look at the session, for the moment the server says `not_signed_in`: it clears a dead cookie so the page can return to
// the sign in view instead of retrying with a token that no longer works.
export async function refreshSession(): Promise<void> {
  try {
    await authClient.getSession({ query: { disableCookieCache: true } });
  } catch {
    /* the page goes to the sign in view either way */
  }
}
