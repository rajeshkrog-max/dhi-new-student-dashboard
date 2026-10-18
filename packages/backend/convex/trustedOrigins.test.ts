// The sign in origin list (spec 0007, AC-10). Pure rules, so no deployment is needed. AC-6 (one saved answer per question) is covered
// by the existing checks.test.ts "same option again is a no op, a different option changes the answer in place" test.
import { describe, expect, test } from "vitest";
import { hostOfUrl, isForbiddenForwardedHost, parseOriginList, signInOrigins } from "./trustedOrigins";

const SITE = "https://dhirise.com";
const LIST = "https://dhirise.com,https://staging.dhirise.com,http://localhost:4321,http://localhost:8080";

describe("parseOriginList", () => {
  test("covers AC-10: trims padding, lowercases, drops empty parts and trailing slashes, keeps order without repeats", () => {
    expect(parseOriginList("  HTTPS://Dhirise.com/ , http://LOCALHOST:8080 ,, https://dhirise.com ")).toEqual([
      "https://dhirise.com",
      "http://localhost:8080",
    ]);
  });
  test("covers AC-10: unset, empty and blank are an empty list", () => {
    expect(parseOriginList(undefined)).toEqual([]);
    expect(parseOriginList("")).toEqual([]);
    expect(parseOriginList("  , ,")).toEqual([]);
  });
});

describe("signInOrigins", () => {
  test("covers AC-10: an unset or empty list behaves exactly as today, base address BETTER_AUTH_URL and nothing checked", () => {
    for (const raw of [undefined, "", "   ", ", ,"]) {
      expect(signInOrigins(SITE, raw)).toEqual({ baseURL: SITE, trustedOrigins: [SITE], allowedHosts: [] });
    }
  });
  test("covers AC-10: a list becomes the allowed hosts with BETTER_AUTH_URL as the fallback, and trustedOrigins always equals the list", () => {
    const o = signInOrigins(SITE, LIST);
    expect(o.trustedOrigins).toEqual(parseOriginList(LIST));
    expect(o.allowedHosts).toEqual(["dhirise.com", "staging.dhirise.com", "localhost:4321", "localhost:8080"]);
    expect(o.baseURL).toEqual({ allowedHosts: o.allowedHosts, fallback: SITE });
  });
  test("covers AC-10: mixed case and padding give the same result as a clean list", () => {
    expect(signInOrigins(SITE, "  HTTP://LocalHost:8080 , https://DHIRISE.com/ ")).toEqual(
      signInOrigins(SITE, "http://localhost:8080,https://dhirise.com"),
    );
  });
  test("covers AC-10: an entry that is not an address is kept in trustedOrigins but names no host", () => {
    expect(signInOrigins(SITE, "not a url,http://localhost:8080").allowedHosts).toEqual(["localhost:8080", "dhirise.com"]);
  });
  test("review 2026-10-18: the site's own address is always allowed, even when the list forgets it, so the funnel's forwarder is never locked out", () => {
    const o = signInOrigins(SITE, "http://localhost:8080");
    expect(o.allowedHosts).toEqual(["localhost:8080", "dhirise.com"]);
    expect(isForbiddenForwardedHost("dhirise.com", o.allowedHosts)).toBe(false);
    expect(isForbiddenForwardedHost("evil.example", o.allowedHosts)).toBe(true);
    // and it is not listed twice when the list already has it
    expect(signInOrigins(SITE, LIST).allowedHosts.filter((h) => h === "dhirise.com")).toHaveLength(1);
  });
});

describe("isForbiddenForwardedHost", () => {
  const hosts = signInOrigins(SITE, LIST).allowedHosts;
  test("covers AC-10: no forwarded host header is never a refusal (the base address is BETTER_AUTH_URL)", () => {
    expect(isForbiddenForwardedHost(null, hosts)).toBe(false);
    expect(isForbiddenForwardedHost("", hosts)).toBe(false);
    expect(isForbiddenForwardedHost("   ", hosts)).toBe(false);
  });
  test("covers AC-10: a forwarded host on the list passes, in any case and with padding", () => {
    expect(isForbiddenForwardedHost("localhost:8080", hosts)).toBe(false);
    expect(isForbiddenForwardedHost(" LocalHost:8080 ", hosts)).toBe(false);
    expect(isForbiddenForwardedHost("dhirise.com", hosts)).toBe(false);
  });
  test("covers AC-10: a forwarded host not on the list is refused, including the right name on the wrong port", () => {
    expect(isForbiddenForwardedHost("evil.example", hosts)).toBe(true);
    expect(isForbiddenForwardedHost("localhost:9999", hosts)).toBe(true);
    expect(isForbiddenForwardedHost("dhirise.com.evil.example", hosts)).toBe(true);
  });
  test("covers AC-10: the deployment's own host, which the platform puts in the header when no proxy did, counts as no header", () => {
    const own = hostOfUrl("https://proper-camel-616.ap-southeast-2.convex.site");
    expect(own).toBe("proper-camel-616.ap-southeast-2.convex.site");
    expect(isForbiddenForwardedHost("proper-camel-616.ap-southeast-2.convex.site", hosts, own)).toBe(false);
    expect(isForbiddenForwardedHost("evil.example", hosts, own)).toBe(true);
    expect(hostOfUrl(undefined)).toBeNull();
    expect(hostOfUrl("not a url")).toBeNull();
  });
  test("covers AC-10: with an unset list nothing is refused, so production behaves as it does today", () => {
    expect(isForbiddenForwardedHost("evil.example", signInOrigins(SITE, undefined).allowedHosts)).toBe(false);
    expect(isForbiddenForwardedHost("evil.example", signInOrigins(SITE, "").allowedHosts)).toBe(false);
  });
});
