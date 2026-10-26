// The pure rules of the house (spec house/0002), no database.
import { describe, expect, test } from "vitest";
import { cleanName } from "./helpers";
import {
  BATCH_MAX,
  INVITE_MS,
  ACCESS_CODES,
  canInviteRole,
  checkRowShape,
  cleanSection,
  isExpired,
  mayClaimUnverified,
  memberShapeProblem,
  normaliseEmail,
  parseClassLabel,
  type Role,
} from "./houseCore";

const ROLES: Role[] = ["student", "teacher", "institute_admin", "dhi_admin", "counselor"];

describe("who may invite whom", () => {
  test("covers AC-8: a DHI admin invites anyone, an institute admin teachers and students, a teacher students, nobody else invites", () => {
    const allowed: Record<Role, Role[]> = {
      dhi_admin: ROLES,
      institute_admin: ["teacher", "student"],
      teacher: ["student"],
      student: [],
      counselor: [],
    };
    for (const actor of ROLES) for (const target of ROLES) expect(canInviteRole(actor, target)).toBe(allowed[actor].includes(target));
  });
});

describe("emails", () => {
  test("an address is lowercased and trimmed, and typing mistakes are refused", () => {
    expect(normaliseEmail("  Asha.Rao@School.EDU ")).toBe("asha.rao@school.edu");
    for (const bad of ["", "asha", "asha@", "@school.edu", "asha@school", "a b@school.edu", "asha@school.edu, b@x.com", "a@b@c.com"]) {
      expect(normaliseEmail(bad)).toBeNull();
    }
    expect(normaliseEmail("a@b.c".padEnd(300, "x") + ".com")).toBeNull();
  });

  test("covers AC-6: an unverified session may claim only a test inbox, only on a test sign in deployment, never a DHI admin or counselor invite", () => {
    expect(mayClaimUnverified({ testSignin: true, email: "kid@example.test", role: "student" })).toBe(true);
    expect(mayClaimUnverified({ testSignin: true, email: "t@example.test", role: "teacher" })).toBe(true);
    expect(mayClaimUnverified({ testSignin: false, email: "kid@example.test", role: "student" })).toBe(false);
    expect(mayClaimUnverified({ testSignin: true, email: "kid@example.com", role: "student" })).toBe(false);
    expect(mayClaimUnverified({ testSignin: true, email: "boss@example.test", role: "dhi_admin" })).toBe(false);
    expect(mayClaimUnverified({ testSignin: true, email: "c@example.test", role: "counselor" })).toBe(false);
  });
});

describe("member shape rules", () => {
  test("student, teacher and institute admin need an institute; DHI admin and counselor have none; only a student has a class and an under 18 flag", () => {
    expect(memberShapeProblem({ role: "student", instituteId: "i", classId: "c", under18: false })).toBeNull();
    expect(memberShapeProblem({ role: "teacher", instituteId: "i" })).toBeNull();
    expect(memberShapeProblem({ role: "institute_admin", instituteId: "i" })).toBeNull();
    expect(memberShapeProblem({ role: "dhi_admin" })).toBeNull();
    expect(memberShapeProblem({ role: "counselor" })).toBeNull();
    expect(memberShapeProblem({ role: "student" })).toBe("institute_required");
    expect(memberShapeProblem({ role: "teacher" })).toBe("institute_required");
    expect(memberShapeProblem({ role: "dhi_admin", instituteId: "i" })).toBe("institute_not_allowed");
    expect(memberShapeProblem({ role: "counselor", instituteId: "i" })).toBe("institute_not_allowed");
    expect(memberShapeProblem({ role: "teacher", instituteId: "i", classId: "c" })).toBe("student_only_fields");
    expect(memberShapeProblem({ role: "institute_admin", instituteId: "i", under18: true })).toBe("student_only_fields");
  });
});

describe("class labels and sections", () => {
  test("the class column reads as a grade and a section", () => {
    expect(parseClassLabel("Class 9 A")).toEqual({ grade: "Class 9", section: "A" });
    expect(parseClassLabel("9A")).toEqual({ grade: "Class 9", section: "A" });
    expect(parseClassLabel("class 10-b")).toEqual({ grade: "Class 10", section: "b" });
    expect(parseClassLabel("10/C")).toEqual({ grade: "Class 10", section: "C" });
    expect(parseClassLabel("  Class   12   Rose ")).toEqual({ grade: "Class 12", section: "Rose" });
    expect(parseClassLabel("College B")).toEqual({ grade: "College", section: "B" });
    for (const bad of ["", "Class 7 A", "Class 13 A", "Class 9", "9", "nine A", "Class 9 A B", "College"]) expect(parseClassLabel(bad)).toBeNull();
  });

  test("a section is a short plain word", () => {
    expect(cleanSection(" A ")).toBe("A");
    expect(cleanSection("Rose")).toBe("Rose");
    for (const bad of ["", "   ", "A B", "A-1", "ThirteenChars1"]) expect(cleanSection(bad)).toBeNull();
  });
});

describe("class list rows", () => {
  test("covers AC-4: each row reports one fixed reason, and a repeat inside the file is its own reason", () => {
    const seen = new Set<string>();
    const ok = { name: "Asha Rao", email: "asha@x.edu", class: "9A", under18: false };
    expect(checkRowShape(ok, seen, cleanName)).toEqual({ ok: true, name: "Asha Rao", email: "asha@x.edu", under18: false });
    expect(checkRowShape({ ...ok, email: "ASHA@x.edu" }, seen, cleanName)).toEqual({ ok: false, reason: "duplicate_in_file" });
    expect(checkRowShape({ ...ok, name: "  ", email: "b@x.edu" }, seen, cleanName)).toEqual({ ok: false, reason: "bad_name" });
    expect(checkRowShape({ ...ok, email: "nope" }, seen, cleanName)).toEqual({ ok: false, reason: "bad_email" });
    expect(checkRowShape({ ...ok, email: "c@x.edu", under18: undefined }, seen, cleanName)).toEqual({ ok: false, reason: "under18_missing" });
    expect(checkRowShape({ ...ok, email: "d@x.edu", under18: null }, seen, cleanName)).toEqual({ ok: false, reason: "under18_missing" });
  });
});

describe("limits and codes", () => {
  test("an invite lives 14 days and expires only after its time", () => {
    expect(INVITE_MS).toBe(14 * 24 * 60 * 60 * 1000);
    expect(isExpired({ expiresAt: 1000 }, 1000)).toBe(false);
    expect(isExpired({ expiresAt: 1000 }, 1001)).toBe(true);
    expect(BATCH_MAX).toBe(300);
  });

  test("covers AC-12: the access codes are exactly the list in the spec", () => {
    expect([...ACCESS_CODES].sort()).toEqual(
      [
        "invite.create", "invite.claim", "invite.revoke", "invite.extend", "invite.update", "member.remove", "member.reinstate", "member.class",
        "member.under18", "member.move", "class.create", "class.archive", "class.pause", "class.resume", "class.assign", "class.unassign", "inst.create", "inst.suspend", "inst.reinstate",
        // Added by house spec 0005.
        "consent.parent", "consent.parentWithdrawn", "consent.parentRestored", "sharing.set", "data.erase", "totals.read",
        // Added by house spec 0022.
        "sharing.link", "sharing.unlink",
      ].sort(),
    );
  });
});
