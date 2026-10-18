// Sign in: Google only (spec 0001). The browser talks to the site's own address (/api/auth/*), which forwards
// to this deployment (functions/api/auth/[[path]].ts), so sign in cookies stay on one address.
// Needs env vars (per deployment): BETTER_AUTH_URL (the site address), BETTER_AUTH_SECRET,
// GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. TEST_SIGNIN_ENABLED=true (dev only) also turns on a fake
// email and password sign in for automated tests. Leave it unset in production.
// BETTER_AUTH_TRUSTED_ORIGINS (optional, spec 0007): comma list of the origins that may sign in, for example the funnel and the
// house on localhost. Unset or empty behaves as today: only BETTER_AUTH_URL. See trustedOrigins.ts.
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { env } from "./_generated/server";
import authConfig from "./auth.config";
import { hostOfUrl, isForbiddenForwardedHost, signInOrigins } from "./trustedOrigins";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl = env.BETTER_AUTH_URL;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !siteUrl) {
    throw new Error("Sign in is not configured: set BETTER_AUTH_URL, GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on this deployment.");
  }
  const origins = signInOrigins(siteUrl, env.BETTER_AUTH_TRUSTED_ORIGINS);
  const ownHost = hostOfUrl(env.CONVEX_SITE_URL);
  return betterAuth({
    baseURL: origins.baseURL,
    trustedOrigins: origins.trustedOrigins,
    // The app never edits an account's name or picture address. Better Auth's `/update-user` would let a student set `image` to any
    // address on Google's picture hosts, and `avatars.ensure` trusts that address as their own Google photo (spec 0011, AC-10, AC-11).
    disabledPaths: ["/update-user"],
    database: authComponent.adapter(ctx),
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // always show the account chooser, so a shared phone does not silently reuse the last account
        prompt: "select_account",
        // Rewrite the account's name and picture address at every Google sign in, so a changed photo is noticed (spec 0011, AC-6).
        // `students.name` is a separate copy and never changes.
        overrideUserInfoOnSignIn: true,
      },
    },
    // Google tokens are stored encrypted. No offline access is asked for: the app never calls Google on the student's behalf.
    account: { encryptOAuthTokens: true },
    emailAndPassword: {
      enabled: env.TEST_SIGNIN_ENABLED === "true",
      requireEmailVerification: false,
    },
    plugins: [
      convex({ authConfig }),
      {
        // Anyone can send a forwarded host header straight to the .convex.site address, so the list is the control: a host that is
        // not on it is refused (spec 0007, AC-10). No header (the platform then fills in this deployment's own host), or no list,
        // passes through untouched.
        id: "forwarded-host-allow-list",
        onRequest: async (request) =>
          isForbiddenForwardedHost(request.headers.get("x-forwarded-host"), origins.allowedHosts, ownHost)
            ? { response: new Response("Forbidden", { status: 403 }) }
            : undefined,
      },
    ],
  });
};
