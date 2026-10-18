// The forwarded host guard, through the real HTTP route (spec 0007, AC-10; review 2026-10-18). The pure rules are in trustedOrigins.test.ts;
// this proves the guard is wired into `createAuth`, reads the right header, and answers before Better Auth does anything with the request.
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { makeBackend } from "../tests/convexTestUtils";

const ENV = {
  BETTER_AUTH_URL: "https://dhirise.test",
  CONVEX_SITE_URL: "https://deployment.convex.site",
  GOOGLE_CLIENT_ID: "id",
  GOOGLE_CLIENT_SECRET: "secret",
  BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:8080,https://staging.dhirise.test",
};
beforeEach(() => {
  Object.assign(process.env, ENV);
});
afterEach(() => {
  for (const k of Object.keys(ENV)) delete process.env[k];
});

const session = (headers: Record<string, string> = {}) => makeBackend().fetch("/api/auth/get-session", { headers });

describe("forwarded host guard", () => {
  test("covers AC-10: a forwarded host that is not on the list is refused with 403", async () => {
    const res = await session({ "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" });
    expect(res.status).toBe(403);
  });

  test("covers AC-10: the right name on the wrong port is refused too", async () => {
    expect((await session({ "x-forwarded-host": "localhost:9999" })).status).toBe(403);
  });

  test("covers AC-10: hosts on the list pass the guard, and so does the site's own address even though the list does not name it", async () => {
    for (const host of ["localhost:8080", "staging.dhirise.test", "dhirise.test"]) {
      expect((await session({ "x-forwarded-host": host, "x-forwarded-proto": "http" })).status, host).not.toBe(403);
    }
  });

  test("covers AC-10: no forwarded host header is never a refusal", async () => {
    expect((await session()).status).not.toBe(403);
  });

  test("covers AC-10: with the list unset nothing is checked, so an unlisted host is not refused by the guard", async () => {
    delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
    expect((await session({ "x-forwarded-host": "evil.example" })).status).not.toBe(403);
  });
});
