// Registers the Better Auth component, which keeps its own tables (users, sessions, accounts) inside Convex.
// Also declares the app's own environment variables (read through `env` from ./_generated/server).
// BETTER_AUTH_SECRET is read by Better Auth itself, so it is not declared here.
import { defineApp } from "convex/server";
import { v } from "convex/values";
import betterAuth from "@convex-dev/better-auth/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp({
  env: {
    BETTER_AUTH_URL: v.optional(v.string()),
    // The origins that may sign in, comma separated (spec 0007). Unset or empty means only BETTER_AUTH_URL, as before.
    BETTER_AUTH_TRUSTED_ORIGINS: v.optional(v.string()),
    GOOGLE_CLIENT_ID: v.optional(v.string()),
    GOOGLE_CLIENT_SECRET: v.optional(v.string()),
    TEST_SIGNIN_ENABLED: v.optional(v.string()),
    // The copy to the team's Google Sheet (spec 0004). Both optional: a deployment with no Sheet still deploys.
    // Each deployment has its own pair, so a dev deployment can never write to the production Sheet.
    GOOGLE_SERVICE_ACCOUNT_KEY: v.optional(v.string()),
    SHEET_ID: v.optional(v.string()),
    // The saved report PDF (spec 0006). All optional: a deployment without them still deploys, and the copy ends
    // `failed` with `render_not_configured` while the report itself keeps working. Secrets are set per deployment.
    CLOUDFLARE_ACCOUNT_ID: v.optional(v.string()),
    CLOUDFLARE_API_TOKEN: v.optional(v.string()), // custom token with only "Browser Rendering - Edit"
    REPORT_RENDER_SECRET: v.optional(v.string()), // signs the 2 minute render tokens; different on dev and production
    REPORT_RENDER_BASE_URL: v.optional(v.string()), // the public site address Browser Run opens (never localhost)
    // The team link to the saved report (spec 0008): comma separated Google emails allowed to open any ready report.
    // Unset or empty means nobody. Read on every team request, so removing an email takes effect at once. Set per deployment.
    TEAM_EMAILS: v.optional(v.string()),
    // The Google profile picture (spec 0011). On by default; `false` turns the whole feature off: no notice, no fetch, no picture, and the
    // image route answers 404.
    PROFILE_PICTURE_ENABLED: v.optional(v.string()),
    // `true` brings back the spec's asked flow: the picture waits for the student's v4 consent and existing students get the one time
    // notice. Unset (the default) means nobody is asked and every student's picture is fetched and shown.
    PICTURE_CONSENT_REQUIRED: v.optional(v.string()),
    // `true` lets live leaderboard rows carry pictures (scope row 12). Leave it off until the team can review pictures.
    LEADERBOARD_PICTURES_ENABLED: v.optional(v.string()),
    // The private link to a student's report (spec 0010). Signs the link codes; a different value on dev and production. Unset means no
    // link can be made or opened (so leave it unset on production until the share row, the notice and Stop sharing have shipped).
    SHARE_LINK_SECRET: v.optional(v.string()),
    // The server side switch of the private report link (review 2026-10-11): links are made and opened only when this is `true` (also `1`,
    // `yes`, `on`). Unset means off, whatever the browser's `publicShare` says, so nobody can make a link by calling `shares.enable` themselves.
    PUBLIC_SHARE_ENABLED: v.optional(v.string()),
    // The live Founding Circle Challenge (spec 0015). `true` (also `1`, `yes`, `on`) lets students join and records referrals. Unset means off:
    // nobody can join, no referral is made and the job does nothing. Leave it unset on production until the words and the lawyer check are in.
    CHALLENGE_LIVE: v.optional(v.string()),
    // When the challenge ends, as an ISO date with an offset (`2026-10-30T23:59:00+05:30`). Unset or empty means it never ends (spec 0008).
    CHALLENGE_ENDS_AT: v.optional(v.string()),
    // Keys the hash of an erased student's email for the 30 day block (house spec 0005, AC-13): HMAC SHA 256 of the trimmed lowercase address. The
    // same name the funnel's erase spec uses, so one secret can serve both. A different value on development and production. Unset means the
    // house erase refuses with `erase_not_configured`.
    ERASURE_HASH_SECRET: v.optional(v.string()),
    // The DHI desk (house spec 0016). The model key is a secret set per deployment (never in code or git); unset means the desk answers `model_not_chosen`.
    // `DESK_MODEL` names the model (default `gpt-4o-mini`). `DESK_LIVE` must be `true` (also `1`, `yes`, `on`) for the desk to call the model at all.
    OPENAI_API_KEY: v.optional(v.string()),
    DESK_MODEL: v.optional(v.string()),
    DESK_LIVE: v.optional(v.string()),
  },
});
app.use(betterAuth);
app.use(rateLimiter);

export default app;
