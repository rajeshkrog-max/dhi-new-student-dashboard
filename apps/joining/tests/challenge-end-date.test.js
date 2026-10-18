// The page side of the optional challenge end date (spec 0008). js/api.js reads `endsAt` from window.DHI_CHALLENGE: empty means the challenge has
// no end, so the page never decides it is over and no countdown exists. api.js is a plain browser script, so it is loaded the way a page loads it.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const load = async (config) => {
  vi.resetModules();
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  delete globalThis.DhiApi;
  if (config === undefined) delete globalThis.DHI_CHALLENGE;
  else globalThis.DHI_CHALLENGE = config;
  await import("../public/dhiinterviews/js/api.js");
  return globalThis.DhiApi;
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2031-06-01T00:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  delete globalThis.DHI_CHALLENGE;
});

describe("the challenge end date on the page (spec 0008)", () => {
  test("an empty endsAt means no end date: endsAtMs is null and isOver is false, even years later", async () => {
    const api = await load({ endsAt: "", prize: {} });
    expect(api.endsAtMs()).toBeNull();
    expect(api.isOver()).toBe(false);
  });

  test("no config at all, or an endsAt that is not a date, also means no end date", async () => {
    expect((await load(undefined)).isOver()).toBe(false);
    const api = await load({ endsAt: "someday" });
    expect(api.endsAtMs()).toBeNull();
    expect(api.isOver()).toBe(false);
  });

  test("a set end date is read in milliseconds, and the page says over only after it", async () => {
    const api = await load({ endsAt: "2026-10-30T23:59:00+05:30" });
    expect(api.endsAtMs()).toBe(Date.parse("2026-10-30T18:29:00Z"));
    expect(api.isOver()).toBe(true); // the fake clock is in 2031

    vi.setSystemTime(new Date("2026-10-30T18:29:00Z"));
    expect(api.isOver()).toBe(false); // exactly at the end is still on time

    vi.setSystemTime(new Date("2026-10-30T18:29:01Z"));
    expect(api.isOver()).toBe(true);
  });

  test("an unreachable end date in the future is not over", async () => {
    const api = await load({ endsAt: "2099-01-01T00:00:00Z" });
    expect(api.isOver()).toBe(false);
  });
});
