import assert from "node:assert/strict";
import { test } from "node:test";
import { backToHouse, entryTarget, houseTarget, interviewUrl, referralParam, type EntryMe } from "./entry.ts";

const signedIn = { isLoading: false, isAuthenticated: true };
const finished: EntryMe = { state: "ready", check: { completedAt: 1_700_000_000_000 } };
const started: EntryMe = { state: "ready", check: { completedAt: null } };

test("spec 0008: a page still finding out who is here waits and shows nothing about anyone", () => {
  assert.equal(entryTarget({ isLoading: true, isAuthenticated: false }, undefined), "waiting");
  assert.equal(entryTarget({ isLoading: true, isAuthenticated: true }, finished), "waiting");
  assert.equal(entryTarget(signedIn, undefined), "waiting");
});

test("spec 0008: a visitor with no session sees the sign in form", () => {
  assert.equal(entryTarget({ isLoading: false, isAuthenticated: false }, undefined), "sign-in");
  assert.equal(entryTarget({ isLoading: false, isAuthenticated: false }, finished), "sign-in");
});

test("spec 0008: a stale cookie (token accepted, server sees no session) goes back to sign in", () => {
  assert.equal(entryTarget(signedIn, { state: "signedOut" }), "sign-in");
});

test("spec 0008: an account with no data goes to the interview", () => {
  assert.equal(entryTarget(signedIn, { state: "needsProfile" }), "interview");
});

test("spec 0008: an account that began the check but has not finished goes back to the interview", () => {
  assert.equal(entryTarget(signedIn, started), "interview");
});

test("spec 0008: an account that finished the check goes to the dashboard", () => {
  assert.equal(entryTarget(signedIn, finished), "dashboard");
});

test("spec 0008: a referral code in the address is kept only when it looks like one", () => {
  assert.equal(referralParam("ABC1234"), "ABC1234");
  assert.equal(referralParam(" abc1234 "), "ABC1234", "trimmed and in capitals, as the funnel's landing page reads it");
  for (const bad of [undefined, null, 12, "", "ab", "A".repeat(17), "ABC 123", "ABC-123", "<script>", "ABC1234&x=1", "../x"]) {
    assert.equal(referralParam(bad), undefined, String(bad));
  }
});

test("spec 0008: the interview address carries the referral code, or none", () => {
  assert.equal(interviewUrl(), "/dhiinterviews/landing.html");
  assert.equal(interviewUrl("ABC1234"), "/dhiinterviews/landing.html?ref=ABC1234");
});

test("spec house/0003: Back to the house leads to the front door from /enter and to the dashboard from anywhere else", () => {
  assert.equal(backToHouse("/enter"), "/");
  assert.equal(backToHouse("/enter/nothing-here"), "/");
  assert.equal(backToHouse("/dashboard/nothing-here"), "/dashboard");
  assert.equal(backToHouse("/anything"), "/dashboard");
});

test("spec house/0002: a member goes to their own place, an invited person to Join, and everyone else to the funnel's rule", () => {
  assert.equal(houseTarget(undefined), "waiting");
  assert.equal(houseTarget({ state: "signedOut" }), "funnel");
  assert.equal(houseTarget({ state: "noHouse" }), "funnel");
  assert.equal(houseTarget({ state: "invitePending", role: "student", instituteName: "Alpha" }), "join");
  assert.equal(houseTarget({ state: "active", role: "student" }), "dashboard");
  for (const role of ["teacher", "institute_admin", "dhi_admin", "counselor"] as const) assert.equal(houseTarget({ state: "active", role }), "staff");
  assert.equal(houseTarget({ state: "removed" }), "dashboard");
  assert.equal(houseTarget({ state: "suspended", role: "teacher" }), "dashboard");
});
