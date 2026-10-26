// The photo of a blog post, the storage clean up that must leave it alone, and the study hour chat's 30 days (spec house/0014 and house/0015). Each test
// names the criterion it covers. Time is fixed with a fake clock.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { blogRoom } from "./blogRoom";
import { publishedTime } from "./blog";
import { MAX_PHOTO_BYTES, PHOTO_FRESH_MS, photoFileProblem } from "./blogRules";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-20T12:00:00+05:30");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

// The first bytes of each kind of picture, then padding.
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 1, 2, 3, 4];
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3, 4, 5];
const WEBP = [0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2, 3, 4];

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const classmate = await makeStudent(t, A.admin, a1, "classmate@alpha.test", false);
  await t.run(async (ctx) => {
    for (const p of [s, classmate]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, a1, teacher, s, classmate };
}
type World = Awaited<ReturnType<typeof world>>;
const upload = (w: World, bytes: number[], type = "image/png") => w.t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));
const exists = (w: World, id: Id<"_storage">) => w.t.run(async (ctx) => (await ctx.storage.get(id)) !== null);
const write = (w: World, photoId?: Id<"_storage">) =>
  w.s.as.mutation(api.blog.write, { title: "My week", tag: "idea", body: "Hello", ...(photoId ? { photoId } : {}) });

describe("the photo of a post (AC-7)", () => {
  test("covers AC-7: a post with a photo shows it to its author at once and to classmates and teachers only as the rules allow", async () => {
    const w = await world();
    const photoId = await upload(w, PNG);
    const postId = await write(w, photoId);
    const own = (await w.s.as.query(api.blog.list, {}))[0];
    expect(own.photoUrl).toEqual(expect.any(String));
    // A classmate sees nothing, and not the photo either, until a teacher approves.
    expect(await w.classmate.as.query(api.blog.list, {})).toEqual([]);
    const pending = (await w.teacher.as.query(api.blog.pendingForTeacher, {})).posts[0];
    expect(pending.photoUrl).toEqual(expect.any(String));
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    expect((await w.classmate.as.query(api.blog.list, {}))[0].photoUrl).toEqual(expect.any(String));
    // A post hidden again shows its photo to its author only.
    await w.teacher.as.mutation(api.blog.review, { postId, action: "hide" });
    expect(await w.classmate.as.query(api.blog.list, {})).toEqual([]);
    expect((await w.s.as.query(api.blog.list, {}))[0].photoUrl).toEqual(expect.any(String));
  });

  test("covers AC-7: a post without a photo has none", async () => {
    const w = await world();
    await write(w);
    expect((await w.s.as.query(api.blog.list, {}))[0].photoUrl).toBeNull();
  });

  test("covers AC-7: a file that is too big, is old, is already used or is not a file cannot be a photo", async () => {
    const w = await world();
    // The declared type is checked by photoFileProblem (unit tests below): the test file store keeps no type, so it is not checked here.
    // One byte over 1.5 MB.
    expect(await refusal(write(w, await upload(w, [...PNG, ...new Array(MAX_PHOTO_BYTES - PNG.length + 1).fill(0)])))).toBe("bad_photo");
    // Exactly 1.5 MB is fine.
    await write(w, await upload(w, [...PNG, ...new Array(MAX_PHOTO_BYTES - PNG.length).fill(0)]));
    // A file already held by a post cannot be held by a second one.
    const used = await upload(w, JPEG, "image/jpeg");
    await write(w, used);
    expect(await refusal(write(w, used))).toBe("bad_photo");
    // A file uploaded more than an hour ago is refused.
    const old = await upload(w, WEBP, "image/webp");
    vi.setSystemTime(NOW + 2 * HOUR);
    expect(await refusal(write(w, old))).toBe("bad_photo");
    // A storage id that is not a file at all.
    const gone = await upload(w, PNG);
    await w.t.run((ctx) => ctx.storage.delete(gone));
    expect(await refusal(write(w, gone))).toBe("bad_photo");
  });

  test("covers AC-7: a photo already held by a profile picture cannot be a post's photo", async () => {
    const w = await world();
    const held = await upload(w, JPEG, "image/jpeg");
    await w.t.run(async (ctx) => {
      const studentId = await ctx.db.insert("students", { authUserId: "x", email: "x@example.test", name: "X", age: 15, class: "Class 10" });
      await ctx.db.insert("avatars", { studentId, key: "k".repeat(22), storageId: held, sourceUrl: "https://lh3.googleusercontent.com/a", checkedAt: NOW, updatedAt: NOW });
    });
    expect(await refusal(write(w, held))).toBe("bad_photo");
  });

  test("covers AC-7: removing a post deletes its photo at once, and erasing a student deletes their photos", async () => {
    const w = await world();
    const first = await upload(w, PNG);
    const postId = await write(w, first);
    await w.teacher.as.mutation(api.blog.review, { postId, action: "remove" });
    expect(await exists(w, first)).toBe(false);
    expect((await w.t.run((ctx) => ctx.db.get(postId)))?.photoId).toBeUndefined();
    const second = await upload(w, JPEG, "image/jpeg");
    await write(w, second);
    const done = await w.t.run((ctx) => blogRoom.eraser(ctx, w.s.memberId, 10));
    expect(done.done).toBe(true);
    expect(await exists(w, second)).toBe(false);
  });

  test("covers AC-7: erasing a student also removes classmates' comments on their posts, so none points at a deleted post", async () => {
    const w = await world();
    const postId = await write(w);
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    await w.classmate.as.mutation(api.blog.comment, { postId, text: "Nice" });
    expect(await w.t.run(async (ctx) => (await ctx.db.query("blogComments").collect()).length)).toBe(1);
    const done = await w.t.run((ctx) => blogRoom.eraser(ctx, w.s.memberId, 10));
    expect(done.done).toBe(true);
    expect(await w.t.run((ctx) => ctx.db.get(postId))).toBeNull();
    expect(await w.t.run(async (ctx) => (await ctx.db.query("blogComments").collect()).length)).toBe(0);
  });

  test("covers AC-7: the download says a post had a photo and carries no file or address", async () => {
    const w = await world();
    await write(w, await upload(w, PNG));
    const page = await w.t.run((ctx) => blogRoom.exporter(ctx, w.s.memberId, null, 10));
    expect(page.rows[0]).toMatchObject({ hadPhoto: true });
    expect(JSON.stringify(page.rows)).not.toMatch(/https?:|storage/);
  });

  test("covers AC-7: only a student gets an upload address, and twelve an hour", async () => {
    const w = await world();
    for (const p of [w.teacher, w.A.admin, w.dhi]) expect(await refusal(p.as.mutation(api.blog.photoUploadUrl, {}))).toBe("forbidden");
    for (let i = 0; i < 12; i += 1) expect(await w.s.as.mutation(api.blog.photoUploadUrl, {})).toEqual(expect.any(String));
    expect(await refusal(w.s.as.mutation(api.blog.photoUploadUrl, {}))).toBe("slow_down");
  });
});

describe("the day of the published event (AC-4)", () => {
  const published = (w: World) => w.t.run(async (ctx) => (await ctx.db.query("events").collect()).filter((e) => e.type === "blog.published"));

  test("covers AC-4: the event is dated to the day the student wrote the post, not the day the teacher approved it", async () => {
    const w = await world();
    const postId = await write(w);
    vi.setSystemTime(NOW + 2 * DAY);
    await w.teacher.as.mutation(api.blog.review, { postId, action: "approve" });
    const [event] = await published(w);
    expect(event.occurredAt).toBe(NOW);
    expect(event.loggedFor).toBe("2026-10-20");
  });

  test("covers AC-4: a post older than the log accepts is dated to the approval, so the approval is never refused for its age", () => {
    expect(publishedTime(NOW + 0.5, NOW + 2 * DAY)).toBe(NOW);
    expect(publishedTime(NOW, NOW + 6 * DAY)).toBe(NOW);
    expect(publishedTime(NOW, NOW + 8 * DAY)).toBe(NOW + 8 * DAY);
  });
});

describe("photoFileProblem (AC-7)", () => {
  const file = (over: Partial<{ size: number; contentType: string | undefined; _creationTime: number }> = {}) => ({
    size: 1000,
    contentType: "image/png" as string | undefined,
    _creationTime: NOW - 1000,
    ...over,
  });
  test("covers AC-7: size must be 1 byte to 1.5 MB", () => {
    expect(photoFileProblem(file({ size: 1 }), NOW)).toBeNull();
    expect(photoFileProblem(file({ size: MAX_PHOTO_BYTES }), NOW)).toBeNull();
    expect(photoFileProblem(file({ size: 0 }), NOW)).toBe("bad_photo");
    expect(photoFileProblem(file({ size: MAX_PHOTO_BYTES + 1 }), NOW)).toBe("bad_photo");
    expect(photoFileProblem(file({ size: Number.NaN }), NOW)).toBe("bad_photo");
  });
  test("covers AC-7: the file must be fresh, within one hour", () => {
    expect(photoFileProblem(file({ _creationTime: NOW - PHOTO_FRESH_MS }), NOW)).toBeNull();
    expect(photoFileProblem(file({ _creationTime: NOW - PHOTO_FRESH_MS - 1 }), NOW)).toBe("bad_photo");
  });
  test("covers AC-7: a declared type must be JPEG, PNG or WebP, and no declared type is allowed", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) expect(photoFileProblem(file({ contentType: type }), NOW), type).toBeNull();
    for (const type of ["text/html", "image/gif", "image/svg+xml", "application/pdf", ""]) expect(photoFileProblem(file({ contentType: type }), NOW), type).toBe("bad_photo");
    expect(photoFileProblem(file({ contentType: undefined }), NOW)).toBeNull();
  });
  test("covers AC-7: no file is a bad photo", () => {
    expect(photoFileProblem(null, NOW)).toBe("bad_photo");
  });
});

describe("the daily storage clean up (AC-7)", () => {
  test("covers AC-7: it deletes a file nobody holds after a day, and leaves a blog photo and a profile picture alone", async () => {
    const w = await world();
    const orphan = await upload(w, PNG);
    const photo = await upload(w, JPEG, "image/jpeg");
    await write(w, photo);
    const picture = await upload(w, WEBP, "image/webp");
    await w.t.run(async (ctx) => {
      const studentId = await ctx.db.insert("students", { authUserId: "y", email: "y@example.test", name: "Y", age: 15, class: "Class 10" });
      await ctx.db.insert("avatars", { studentId, key: "j".repeat(22), storageId: picture, sourceUrl: "https://lh3.googleusercontent.com/b", checkedAt: NOW, updatedAt: NOW });
    });
    // Within a day nothing goes.
    vi.setSystemTime(NOW + 12 * HOUR);
    await w.t.mutation(internal.reportCopy.sweep, {});
    expect(await exists(w, orphan)).toBe(true);
    vi.setSystemTime(NOW + 2 * DAY);
    await w.t.mutation(internal.reportCopy.sweep, {});
    expect(await exists(w, orphan)).toBe(false);
    expect(await exists(w, photo)).toBe(true);
    expect(await exists(w, picture)).toBe(true);
  });
});

describe("the study hour chat's 30 days (AC-8)", () => {
  test("covers AC-8: the daily house sweep deletes chat older than 30 days and keeps the rest", async () => {
    const w = await world();
    await w.dhi.as.mutation(api.studyHour.set, { opensAt: NOW - 10 * 60 * 1000, closesAt: NOW + 3 * HOUR });
    const message = (text: string, createdAt: number) =>
      w.t.run(async (ctx) => {
        const member = await ctx.db.get(w.s.memberId);
        const hour = (await ctx.db.query("studyHours").first())!;
        return await ctx.db.insert("chatMessages", { hourId: hour._id, instituteId: member!.instituteId!, authorMemberId: w.s.memberId, text, createdAt, reported: false, status: "shown" });
      });
    await message("old", NOW);
    // 31 days later a new message is written; the sweep keeps it and deletes the old one.
    vi.setSystemTime(NOW + 31 * DAY);
    const fresh = await message("fresh", NOW + 31 * DAY);
    await w.t.mutation(internal.retention.sweep, {});
    const left = await w.t.run(async (ctx) => (await ctx.db.query("chatMessages").collect()).map((m) => m._id));
    expect(left).toEqual([fresh]);
    // Twenty nine days is not old enough.
    vi.setSystemTime(NOW + 31 * DAY + 29 * DAY);
    await w.t.mutation(internal.retention.sweep, {});
    expect(await w.t.run(async (ctx) => (await ctx.db.query("chatMessages").collect()).length)).toBe(1);
  });
});
