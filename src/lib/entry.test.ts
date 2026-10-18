import assert from "node:assert/strict";
import { test } from "node:test";
import { entryTarget, type EntryMe } from "./entry.ts";

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
