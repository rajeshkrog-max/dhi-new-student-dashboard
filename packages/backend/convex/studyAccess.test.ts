/// <reference types="vite/client" />
// Who may reach the study rooms (house specs 0012 to 0015 and 0018): the films, the study hour, the after session card, the blog and the sitting
// of a paper. The rooms' own tests cover another class and another institute; these add every role and every lock. The functions that take no id are
// called as each caller; for every function, a scan proves it starts with the entry check and then its role check, so no lock is skipped.
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const other = await makeStudent(t, B.admin, b1, "o@beta.test", false);
  await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counselor@dhi.test", name: "Counselor" });
  const counselor = await joinAs(t, "counselor@dhi.test", { name: "Counselor" });
  return { t, dhi, A, B, a1, teacher, other, counselor };
}

// Every student function of the study rooms that takes no id.
const CALLS: Record<string, (p: Person) => Promise<unknown>> = {
  "films.list": (p) => p.as.query(api.films.list, {}),
  "studyHour.current": (p) => p.as.query(api.studyHour.current, {}),
  "studyHour.enter": (p) => p.as.mutation(api.studyHour.enter, { mode: "live" }),
  "studyHour.beat": (p) => p.as.mutation(api.studyHour.beat, {}),
  "studyHour.leave": (p) => p.as.mutation(api.studyHour.leave, {}),
  "studyHour.seats": (p) => p.as.query(api.studyHour.seats, {}),
  "studyHour.chat": (p) => p.as.mutation(api.studyHour.chat, { text: "hello" }),
  "studyHour.messages": (p) => p.as.query(api.studyHour.messages, {}),
  "sessionFeedback.pending": (p) => p.as.query(api.sessionFeedback.pending, {}),
  "blog.photoUploadUrl": (p) => p.as.mutation(api.blog.photoUploadUrl, {}),
  "blog.write": (p) => p.as.mutation(api.blog.write, { title: "A post", tag: "study", body: "<p>Hello</p>" }),
  "blog.list": (p) => p.as.query(api.blog.list, {}),
};

describe("the study rooms are the student's own", () => {
  test("every staff role is refused with forbidden, and a signed out caller with not_signed_in", async () => {
    const w = await world();
    for (const [name, call] of Object.entries(CALLS)) {
      for (const p of [w.teacher, w.A.admin, w.dhi, w.counselor]) expect(await refusal(call(p)), `${name} as staff`).toBe("forbidden");
      expect(await refusal(call({ as: w.t } as unknown as Person)), `${name} signed out`).toBe("not_signed_in");
    }
  });

  test("a student at the gate, one who withdrew, a removed one and one of a paused institute are refused by every function", async () => {
    const w = await world();
    const gate = await makeStudent(w.t, w.A.admin, w.a1, "gate@alpha.test", false, { consent: false });
    const left = await makeStudent(w.t, w.A.admin, w.a1, "left@alpha.test", false);
    const removed = await makeStudent(w.t, w.A.admin, w.a1, "removed@alpha.test", false);
    await left.as.mutation(api.consent.withdraw, {});
    await w.A.admin.as.mutation(api.members.remove, { memberId: removed.memberId });
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.B.instituteId, status: "suspended" });
    for (const [name, call] of Object.entries(CALLS)) {
      expect(await refusal(call(gate)), `${name} at the gate`).toBe("consent_required");
      expect(await refusal(call(left)), `${name} withdrawn`).toBe("consent_withdrawn");
      expect(await refusal(call(removed)), `${name} removed`).toBe("removed");
      expect(await refusal(call(w.other)), `${name} paused institute`).toBe("institute_suspended");
    }
  });

  test("every public function of the study rooms starts with the entry check, then its role check", () => {
    const files = import.meta.glob(["./films.ts", "./studyHour.ts", "./sessionFeedback.ts", "./blog.ts", "./exams.ts", "./papers.ts"], {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(files)).toHaveLength(6);
    let seen = 0;
    for (const [file, text] of Object.entries(files)) {
      const parts = text.split(/^export const (\w+) = (?:query|mutation)\(\{/m);
      for (let i = 1; i < parts.length; i += 2) {
        const name = parts[i];
        seen += 1;
        const body = parts[i + 1].split(/^export /m)[0];
        const handler = body.slice(body.indexOf("handler:"));
        const first = handler.split("\n").slice(1).find((l) => l.trim() && !l.trim().startsWith("//")) ?? "";
        expect(/await require(Member|DhiAdmin)\(ctx\)/.test(first), `${file} ${name} starts with: ${first.trim()}`).toBe(true);
        if (/requireMember/.test(first)) expect(/mc\.role (!==|===) "/.test(handler.split("\n").slice(1, 5).join("\n")), `${file} ${name} has no role check`).toBe(true);
      }
    }
    // Every function of the six files was read (the rooms have about 40 between them), so the scan cannot pass by finding none.
    expect(seen).toBeGreaterThan(30);
  });
});
