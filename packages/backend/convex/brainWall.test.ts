/// <reference types="vite/client" />
// The wall around the Brain (house specs 0019, 0020, 0022, 0023; the owner's answers of 2026-10-24): the Brain is the student's alone. No teacher,
// institute admin, DHI admin or counselor function reads a daily value, a pattern, a lamp or a connection, there are no staff class totals of it, and
// the one opening is the weekly parent page. This file proves it three ways: every Brain function refuses every staff role; the access rule gives
// every staff viewer nothing of the kind `brain`; and a scan finds every file that reads the Brain and checks that none of them offers a staff function.
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { canView } from "./accessRules";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

// The only files that may read the Brain's days, rules or connections, and why.
const READERS: Record<string, string> = {
  "./brain.ts": "the student's own report",
  "./brainDay.ts": "the shared reader",
  "./brainRollup.ts": "the only writer",
  "./brainRules.ts": "the pure rules",
  "./connectionRules.ts": "the pure connections",
  "./brainFixtures.ts": "hand made days for tests and the dev proof",
  "./brainProof.ts": "dev only, refuses where the test sign in is off",
  "./home.ts": "the student's own score on Home",
  "./parentReport.ts": "the weekly parent page",
  "./parentRules.ts": "what the parent page may hold",
};

describe("the Brain is the student's alone", () => {
  test("every Brain function refuses a teacher, an institute admin, a DHI admin and a counselor", async () => {
    const t = makeBackend();
    const dhi = await makeDhiAdmin(t);
    const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
    const a1 = await makeClass(A.admin, "Class 10", "A");
    const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
    await makeStudent(t, A.admin, a1, "s@alpha.test", false);
    await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counselor@dhi.test", name: "Counselor" });
    const counselor = await joinAs(t, "counselor@dhi.test", { name: "Counselor" });
    for (const p of [teacher, A.admin, dhi, counselor]) {
      expect(await refusal(p.as.query(api.brain.report, {}))).toBe("forbidden");
      expect(await refusal(p.as.mutation(api.brain.hide, { id: "dragging_mood" }))).toBe("forbidden");
      expect(await refusal(p.as.mutation(api.brain.show, { id: "dragging_mood" }))).toBe("forbidden");
      expect(await refusal(p.as.query(api.home.summary, {}))).toBe("forbidden");
      expect(await refusal(p.as.query(api.parentLink.mine, {}))).toBe("forbidden");
    }
  });

  test("the access rule gives no staff viewer anything of the Brain, whatever the relation", () => {
    for (const viewer of ["teacher", "institute_admin", "dhi_admin", "counselor"] as const) {
      for (const relation of ["assigned_class", "same_institute", "none"] as const) {
        expect(canView(viewer, relation, "brain", { standing: "ok", parentLevel: "summary" }), `${viewer} ${relation}`).toBe("none");
      }
    }
  });

  test("only the listed files read the Brain, and none of them offers a function to a staff role", () => {
    const files = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const readers = Object.entries(files).filter(
      ([name, text]) => !name.endsWith(".test.ts") && /from "\.\/(brainDay|brainRules|connectionRules|metricRules|brainFixtures)"|["']brainDays["']|["']brainHides["']/.test(text),
    );
    expect(readers.length).toBeGreaterThan(5);
    for (const [name, text] of readers) {
      if (name === "./metricRules.ts" || name === "./dataMap.ts" || name === "./schema.ts" || name === "./brainRoom.ts") continue; // the catalog, the map, the tables, the student's own export and erase
      expect(Object.keys(READERS), `${name} reads the Brain`).toContain(name);
      // No function in a Brain reader lets a staff role through: every role check names the student, and none names a staff role.
      const code = text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      expect(/role\s*===\s*["'](teacher|institute_admin|dhi_admin|counselor)["']/.test(code), `${name} lets a staff role in`).toBe(false);
      // A call, not an import: parentReport.ts borrows the standing helper from staffRead.ts and never calls staffRead itself.
      expect(/requireDhiAdmin\(|staffRead\(|classTotal\(/.test(code), `${name} uses a staff path`).toBe(false);
    }
  });
});
