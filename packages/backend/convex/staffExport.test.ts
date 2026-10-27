/// <reference types="vite/client" />
// A staff member's own download (dataRights.exportStaffMine; the gap named in docs/launch/HARDENING.md): who they are, their classes, the papers they
// built with how many sittings they marked, their films and their own actions, and never a student's name, email, answer or mark.
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

type File = { schema: string; profile: { email: string; role: string }; classes: string[]; papers: { title: string; questions: number }[]; actions: { action: string; at: number }[] };

describe("the staff download", () => {
  test("a teacher's file holds their profile, classes, papers and actions, and nothing of a student", async () => {
    const t = makeBackend();
    const dhi = await makeDhiAdmin(t);
    const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
    const a1 = await makeClass(A.admin, "Class 10", "A");
    const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
    await makeStudent(t, A.admin, a1, "asha@alpha.test", false);
    await teacher.as.mutation(api.papers.create, {
      title: "Term test",
      questions: [{ kind: "mcq", subject: "Maths", topic: "Fractions", text: "What is half of four?", options: ["one", "two", "three"], rightOption: 1, tags: [null, null, null] }],
    });
    const r = (await teacher.as.mutation(api.dataRights.exportStaffMine, {})) as { ok: true; file: File };
    expect(r.ok).toBe(true);
    expect(r.file.schema).toBe("dhi-house-staff-export-v1");
    expect(r.file.profile).toMatchObject({ email: "teacher@alpha.test", role: "teacher" });
    expect(r.file.classes).toEqual(["Class 10 A"]);
    expect(r.file.papers).toMatchObject([{ title: "Term test", questions: 1 }]);
    expect(JSON.stringify(r.file)).not.toContain("asha@alpha.test");

    const admin = (await A.admin.as.mutation(api.dataRights.exportStaffMine, {})) as { ok: true; file: File };
    expect(admin.file.actions.length).toBeGreaterThan(0);
    expect(Object.keys(admin.file.actions[0]).sort()).toEqual(["action", "at"]);
  });

  test("a student is refused (they have their own download), and so is a signed out caller", async () => {
    const t = makeBackend();
    const dhi = await makeDhiAdmin(t);
    const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
    const a1 = await makeClass(A.admin, "Class 10", "A");
    const s = await makeStudent(t, A.admin, a1, "asha@alpha.test", false);
    expect(await refusal(s.as.mutation(api.dataRights.exportStaffMine, {}))).toBe("forbidden");
    expect(await refusal(t.mutation(api.dataRights.exportStaffMine, {}))).toBe("not_signed_in");
  });
});
