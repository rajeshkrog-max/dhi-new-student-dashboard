import assert from "node:assert/strict";
import { test } from "node:test";
import { parseClassList, parseUnder18, splitLine } from "./class-list.ts";
import { BAD_ROW_WORDS, ROLE_LABEL, badRowWords, codeOf, refusalWords } from "./house-words.ts";

test("spec house/0002: a pasted class list reads as rows, with or without a header", () => {
  const withHeader = "Name,Email,Class,Under 18\nAsha Rao,asha@x.edu,10A,no\nMeera Iyer,meera@x.edu,Class 10 B,yes\n";
  const expected = [
    { name: "Asha Rao", email: "asha@x.edu", class: "10A", under18: false },
    { name: "Meera Iyer", email: "meera@x.edu", class: "Class 10 B", under18: true },
  ];
  assert.deepEqual(parseClassList(withHeader), expected);
  assert.deepEqual(parseClassList(withHeader.split("\n").slice(1).join("\n")), expected);
});

test("a spreadsheet's semicolons, a paste's tabs, a BOM and Windows line endings all work", () => {
  assert.equal(parseClassList("﻿Asha;asha@x.edu;9A;no\r\nMeera;meera@x.edu;9A;yes\r\n").length, 2);
  assert.deepEqual(parseClassList("Asha Rao\tasha@x.edu\t9A\tYes"), [{ name: "Asha Rao", email: "asha@x.edu", class: "9A", under18: true }]);
});

test("a name with a comma in quotes stays one cell, and blank lines are skipped", () => {
  assert.deepEqual(splitLine('"Rao, Asha",asha@x.edu,9A,no', ","), ["Rao, Asha", "asha@x.edu", "9A", "no"]);
  assert.deepEqual(splitLine('"She said ""hi""",a@x.edu', ","), ['She said "hi"', "a@x.edu"]);
  assert.equal(parseClassList("\n\nAsha,asha@x.edu,9A,no\n\n").length, 1);
  assert.deepEqual(parseClassList(""), []);
});

test("under 18 reads yes or no in plain words, and anything else is left for the server to name", () => {
  for (const yes of ["yes", "Y", "TRUE", "1", " Under 18 "]) assert.equal(parseUnder18(yes), true);
  for (const no of ["no", "N", "false", "0"]) assert.equal(parseUnder18(no), false);
  for (const odd of ["", "maybe", undefined]) assert.equal(parseUnder18(odd), null);
});

test("a short row is passed on with what is there, so the server can say what is wrong", () => {
  assert.deepEqual(parseClassList("Asha,asha@x.edu"), [{ name: "Asha", email: "asha@x.edu", class: "", under18: null }]);
});

test("the words cover every role and every reason, and never say where an address is in use", () => {
  for (const role of ["student", "teacher", "institute_admin", "dhi_admin", "counselor"] as const) assert.ok(ROLE_LABEL[role]);
  for (const reason of ["bad_name", "bad_email", "duplicate_in_file", "email_in_use", "class_not_found", "class_not_in_scope", "under18_missing"]) {
    assert.ok(BAD_ROW_WORDS[reason], reason);
  }
  assert.equal(badRowWords("something_new"), "This row needs fixing.");
  assert.equal(refusalWords("anything_unknown"), "Something went wrong. Please try again.");
  // The refusal for an address that cannot be invited does not say whether it is a member, already invited, or anything else.
  for (const text of [refusalWords("email_in_use"), badRowWords("email_in_use")]) assert.ok(!/already|member|taken|exists|in use|pending/i.test(text), text);
  // No dash or hyphen as punctuation in what a student reads.
  for (const text of [...Object.values(BAD_ROW_WORDS), refusalWords("rate_limited"), refusalWords("last_admin")]) assert.ok(!/ [-–—] /.test(text));
});

test("the code of a thrown server error is read from its data", () => {
  assert.equal(codeOf({ data: { code: "forbidden" } }), "forbidden");
  assert.equal(codeOf(new Error("boom")), undefined);
  assert.equal(codeOf(null), undefined);
});
