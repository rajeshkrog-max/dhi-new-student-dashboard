// The blog room (spec house/0014). Each test names the criterion it covers.
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import { blogRoom } from "./blogRoom";
import { cleanBody } from "./blogRules";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const a2 = await makeClass(A.admin, "Class 10", "B");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const otherTeacher = await makeTeacher(t, A.admin, "other@alpha.test", [a2]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const classmate = await makeStudent(t, A.admin, a1, "classmate@alpha.test", false);
  const schoolmate = await makeStudent(t, A.admin, a2, "schoolmate@alpha.test", false);
  const B = await makeInstitute(t, dhi, "Beta School", "admin-b@beta.test");
  const b1 = await makeClass(B.admin, "Class 10", "A");
  const outsider = await makeStudent(t, B.admin, b1, "outsider@beta.test", false);
  return { t, teacher, otherTeacher, s, classmate, schoolmate, outsider };
}


describe("the blog room", () => {
  test("covers AC-2: disallowed markup is removed, and the allowed markup is kept, on the server", () => {
    expect(cleanBody("<b>Hi</b> <i>there</i>")).toBe("<b>Hi</b> <i>there</i>");
    expect(cleanBody("<script>alert(1)</script>hello")).not.toContain("<script");
    expect(cleanBody("<img src=x onerror=alert(1)>text")).not.toContain("<img");
    expect(cleanBody("<ol><li>one</li></ol>")).toBe("<ol><li>one</li></ol>");
    expect(cleanBody("a < b & c")).toBe("a &lt; b &amp; c");
  });

  test("covers AC-1 and AC-3: an author sees their own pending post, and a classmate does not", async () => {
    const { s, classmate } = await world();
    await s.as.mutation(api.blog.write, { title: "My week", tag: "reflection", body: "<b>Good</b> week" });
    const own = await s.as.query(api.blog.list, {});
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({ title: "My week", status: "pending", mine: true });
    expect(await classmate.as.query(api.blog.list, {})).toEqual([]);
  });

  test("covers AC-4: a teacher of the author's class approves, and then the whole institute can read the post", async () => {
    const { s, teacher, classmate, schoolmate } = await world();
    const postId = await s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello" });
    await teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    expect((await classmate.as.query(api.blog.list, {})).map((p) => p.title)).toEqual(["My week"]);
    expect((await schoolmate.as.query(api.blog.list, {})).map((p) => p.title)).toEqual(["My week"]);
  });

  test("covers AC-5: a student of another institute cannot read the post", async () => {
    const { s, teacher, outsider } = await world();
    const postId = await s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello" });
    await teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    expect(await outsider.as.query(api.blog.list, {})).toEqual([]);
  });

  test("covers AC-4: a teacher of another class cannot review the post, and a student cannot review at all", async () => {
    const { s, otherTeacher, classmate } = await world();
    const postId = await s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello" });
    expect(await refusal(otherTeacher.as.mutation(api.blog.review, { postId, action: "approve" }))).toBe("forbidden");
    expect(await refusal(classmate.as.mutation(api.blog.review, { postId, action: "approve" }))).toBe("forbidden");
  });

  test("covers AC-4: a hidden post is read by its author only", async () => {
    const { s, teacher, classmate } = await world();
    const postId = await s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello" });
    await teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    await teacher.as.mutation(api.blog.review, { postId, action: "hide" });
    expect(await classmate.as.query(api.blog.list, {})).toEqual([]);
    expect((await s.as.query(api.blog.list, {}))[0].status).toBe("hidden");
  });

  test("covers AC-6: a comment is pending until reviewed, and only an approved post takes comments", async () => {
    const { t, s, teacher, classmate } = await world();
    const postId = await s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello" });
    expect(await refusal(classmate.as.mutation(api.blog.comment, { postId, text: "Nice" }))).toBe("not_found");
    await teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    const commentId = await classmate.as.mutation(api.blog.comment, { postId, text: "<b>Nice</b>" });
    expect((await classmate.as.query(api.blog.list, {}))[0].comments.map((c) => c.status)).toEqual(["pending"]);
    await teacher.as.mutation(api.blog.reviewComment, { commentId, action: "approve" });
    const after = (await s.as.query(api.blog.list, {}))[0].comments;
    expect(after).toHaveLength(1);
    expect(after[0].text).toBe("&lt;b&gt;Nice&lt;/b&gt;");
  });

  test("covers AC-1: a bad tag, a long title and an empty body are refused", async () => {
    const { s } = await world();
    expect(await refusal(s.as.mutation(api.blog.write, { title: "x", tag: "nope", body: "x" }))).toBe("bad_tag");
    expect(await refusal(s.as.mutation(api.blog.write, { title: "x".repeat(81), tag: "idea", body: "x" }))).toBe("bad_title");
    expect(await refusal(s.as.mutation(api.blog.write, { title: "x", tag: "idea", body: "<script></script>" }))).toBe("bad_body");
  });

  test("covers AC-7 and AC-8: the export holds the student's posts, and erase removes them", async () => {
    const { t, s } = await world();
    await s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello" });
    const page = await t.run((ctx) => blogRoom.exporter(ctx, s.memberId, null, 10));
    expect(page.rows).toHaveLength(1);
    expect(Object.keys(page.rows[0] as object).sort()).toEqual(["body", "createdAt", "hadPhoto", "kind", "status", "tag", "title"]);
    // The next page holds the student's own comments (none yet), and then the download is over.
    expect(page.next).toBe("c:0");
    expect(await t.run((ctx) => blogRoom.exporter(ctx, s.memberId, page.next, 10))).toEqual({ rows: [], next: null });
    await t.run((ctx) => blogRoom.eraser(ctx, s.memberId, 10));
    expect(await s.as.query(api.blog.list, {})).toEqual([]);
  });
});

describe("the blog room, the Brain's event and the allowance (spec house/0014)", () => {
  const publishedOf = async (w: Awaited<ReturnType<typeof world>>) => (await w.t.run((ctx) => ctx.db.query("events").collect())).filter((e) => e.type === "blog.published");

  test("covers AC-4: approving a post writes one event of the tag, the word count and the list flag, and none of the writing", async () => {
    const w = await world();
    const postId = await w.s.as.mutation(api.blog.write, { title: "Secret title", tag: "idea", body: "<ol><li>first</li><li>second</li></ol> three four" });
    expect(await publishedOf(w)).toHaveLength(0);
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    const events = await publishedOf(w);
    expect(events).toHaveLength(1);
    expect(events[0].payload).toEqual({ tag: "idea", words: 4, list: true, paragraphs: false });
    expect(JSON.stringify(events[0])).not.toMatch(/Secret|first|second/);
  });

  test("covers AC-4: a post hidden and approved again keeps its first event, and a hidden or removed pending post writes none", async () => {
    const w = await world();
    const postId = await w.s.as.mutation(api.blog.write, { title: "My week", tag: "study", body: "Some words here" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "hide" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    expect(await publishedOf(w)).toHaveLength(1);
    const other = await w.s.as.mutation(api.blog.write, { title: "Not shown", tag: "idea", body: "Words" });
    await w.teacher.as.mutation(api.blog.review, { postId: other, action: "remove" });
    expect(await publishedOf(w)).toHaveLength(1);
  });

  test("covers AC-4: the teacher of another class cannot publish a post, so no event is written for it", async () => {
    const w = await world();
    const postId = await w.s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello" });
    expect(await refusal(w.otherTeacher.as.mutation(api.blog.review, { postId, action: "approve" }))).toBe("forbidden");
    expect(await publishedOf(w)).toHaveLength(0);
  });

  test("covers AC-6: a student can write six posts an hour and 30 comments an hour, and then is slowed down", async () => {
    const w = await world();
    let postId = null as Awaited<ReturnType<typeof w.s.as.mutation<typeof api.blog.write>>> | null;
    for (let i = 0; i < 6; i += 1) postId = await w.s.as.mutation(api.blog.write, { title: `Post ${i}`, tag: "idea", body: "Hello" });
    expect(await refusal(w.s.as.mutation(api.blog.write, { title: "One too many", tag: "idea", body: "Hello" }))).toBe("slow_down");
    await w.teacher.as.mutation(api.blog.review, { postId: postId!, action: "approve" });
    for (let i = 0; i < 30; i += 1) await w.classmate.as.mutation(api.blog.comment, { postId: postId!, text: `Nice ${i}` });
    expect(await refusal(w.classmate.as.mutation(api.blog.comment, { postId: postId!, text: "One too many" }))).toBe("slow_down");
    // The refused post was not stored.
    expect((await w.s.as.query(api.blog.list, {})).filter((p) => p.title === "One too many")).toHaveLength(0);
  });
});


describe("a student who withdrew, and the download of comments (AC-9, review of 2026-10-22)", () => {
  test("covers AC-9: a student who withdrew vanishes from classmates and teachers, and a teacher is not told why", async () => {
    const w = await world();
    const postId = await w.s.as.mutation(api.blog.write, { title: "Before", tag: "idea", body: "Hello" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    const waiting = await w.s.as.mutation(api.blog.write, { title: "Waiting", tag: "idea", body: "Hello again" });
    expect((await w.classmate.as.query(api.blog.list, {})).map((p) => p.title)).toEqual(["Before"]);
    await w.s.as.mutation(api.consent.withdraw, {});
    // Classmates no longer see the approved post, the teacher no longer sees the waiting one, and approving it is a plain "not found".
    expect(await w.classmate.as.query(api.blog.list, {})).toEqual([]);
    expect((await w.teacher.as.query(api.blog.pendingForTeacher, {})).posts).toEqual([]);
    expect(await refusal(w.teacher.as.mutation(api.blog.review, { postId: waiting, action: "approve" }))).toBe("not_found");
    // A classmate cannot comment on the post of a student who withdrew.
    expect(await refusal(w.classmate.as.mutation(api.blog.comment, { postId, text: "Hi" }))).toBe("not_found");
    // Hiding or removing stays possible for the teacher.
    await w.teacher.as.mutation(api.blog.review, { postId: waiting, action: "remove" });
    // Bringing the consent back brings the approved post back.
    await w.s.as.mutation(api.consent.restore, {});
    expect((await w.classmate.as.query(api.blog.list, {})).map((p) => p.title)).toEqual(["Before"]);
  });

  test("covers AC-9: a comment of a student who withdrew is not shown, and cannot be approved", async () => {
    const w = await world();
    const postId = await w.s.as.mutation(api.blog.write, { title: "Post", tag: "idea", body: "Hello" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    const commentId = await w.classmate.as.mutation(api.blog.comment, { postId, text: "Nice one" });
    await w.teacher.as.mutation(api.blog.reviewComment, { commentId, action: "approve" });
    expect((await w.s.as.query(api.blog.list, {}))[0].comments.map((c) => c.text)).toEqual(["Nice one"]);
    const pending = await w.classmate.as.mutation(api.blog.comment, { postId, text: "Second" });
    await w.classmate.as.mutation(api.consent.withdraw, {});
    expect((await w.s.as.query(api.blog.list, {}))[0].comments).toEqual([]);
    expect((await w.teacher.as.query(api.blog.pendingForTeacher, {})).comments).toEqual([]);
    expect(await refusal(w.teacher.as.mutation(api.blog.reviewComment, { commentId: pending, action: "approve" }))).toBe("not_found");
  });

  test("covers AC-9: the download holds the student's own comments too, in a page of their own", async () => {
    const w = await world();
    const postId = await w.s.as.mutation(api.blog.write, { title: "Post", tag: "idea", body: "Hello" });
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    await w.classmate.as.mutation(api.blog.comment, { postId, text: "Good <b>one</b>" });
    const posts = await w.t.run((ctx) => blogRoom.exporter(ctx, w.classmate.memberId, null, 10));
    expect(posts).toEqual({ rows: [], next: "c:0" });
    const comments = await w.t.run((ctx) => blogRoom.exporter(ctx, w.classmate.memberId, posts.next, 10));
    expect(comments.rows).toHaveLength(1);
    expect(comments.rows[0]).toMatchObject({ kind: "comment", status: "pending" });
    expect((comments.rows[0] as { text: string }).text).toContain("Good");
    expect(comments.next).toBeNull();
    // A page holds at most its limit, and the next page carries on after the last row.
    await w.classmate.as.mutation(api.blog.comment, { postId, text: "Second" });
    const first = await w.t.run((ctx) => blogRoom.exporter(ctx, w.classmate.memberId, "c:0", 1));
    expect(first.rows).toHaveLength(1);
    expect(first.next).toEqual(expect.stringMatching(/^c:/));
    const second = await w.t.run((ctx) => blogRoom.exporter(ctx, w.classmate.memberId, first.next, 1));
    expect(second.rows).toHaveLength(1);
    expect(second.next).toBeNull();
  });
});
