/// <reference types="vite/client" />
// The mood room (spec house/0006). Each test names the criterion it covers. Time is fixed with a fake clock; the scheduler is fake too so an
// erase can run its pages.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MOOD_CODES, GUNA_OF, GUNAS, lineIxOf, MAX_MOOD_CHANGES } from "./moodRules";
import { makeBackend } from "../tests/convexTestUtils";
import { joinAs, makeClass, makeDhiAdmin, makeInstitute, makeStudent, makeTeacher, refusal, type Person } from "../tests/houseTestUtils";

const at = (iso: string) => Date.parse(iso);
const NOW = at("2026-10-19T10:00:00+05:30");
const TODAY = "2026-10-19";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
  process.env.ERASURE_HASH_SECRET = "test-erasure-secret";
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.ERASURE_HASH_SECRET;
});

async function world() {
  const t = makeBackend();
  const dhi = await makeDhiAdmin(t);
  const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
  const a1 = await makeClass(A.admin, "Class 10", "A");
  const teacher = await makeTeacher(t, A.admin, "teacher@alpha.test", [a1]);
  const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
  const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
  await dhi.as.mutation(api.invites.create, { role: "counselor", email: "counselor@dhi.test", name: "Counselor" });
  const counselor = await joinAs(t, "counselor@dhi.test", { name: "Counselor" });
  // Joined long ago, so the days used here are open.
  await t.run(async (ctx) => {
    for (const p of [s, s2]) await ctx.db.patch(p.memberId, { joinedAt: at("2026-09-01T10:00:00+05:30") });
  });
  return { t, dhi, A, a1, teacher, s, s2, counselor };
}
type World = Awaited<ReturnType<typeof world>>;

const save = (p: Person, mood: string, note = "") => p.as.mutation(api.moods.save, { mood, note });
const month = (p: Person, m: string) => p.as.query(api.moods.month, { month: m });
const eventsOf = (w: World, memberId: Id<"members">) => w.t.run(async (ctx) => await ctx.db.query("events").withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", memberId)).take(600));
const rowsOf = (w: World, memberId: Id<"members">) => w.t.run(async (ctx) => await ctx.db.query("moodDays").withIndex("by_memberId_and_day", (q) => q.eq("memberId", memberId)).take(600));

describe("save and read back (AC-1, AC-7)", () => {
  test("covers AC-1: a mood and a note are saved with one event that holds only the code, and read back from the month and the year", async () => {
    const w = await world();
    const r = await save(w.s, "determined", "I finished the paper.");
    expect(r).toEqual({ ok: true, day: TODAY, mood: "determined", note: "I finished the paper.", lineIx: lineIxOf(TODAY), changed: true });
    const rows = await rowsOf(w, w.s.memberId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ day: TODAY, mood: "determined", note: "I finished the paper.", changes: 0, instituteId: w.A.instituteId });
    const events = await eventsOf(w, w.s.memberId);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ room: "mood", type: "mood.logged", loggedFor: TODAY, payload: { mood: "determined" }, about: `mood:${rows[0]._id}`, eventKey: `mood:${rows[0]._id}-0`, late: false });
    expect(JSON.stringify(events)).not.toContain("finished the paper");
    expect(await month(w.s, "2026-10")).toEqual([{ day: TODAY, mood: "determined", note: "I finished the paper.", lineIx: lineIxOf(TODAY) }]);
    expect(await w.s.as.query(api.moods.year, { year: "2026" })).toEqual([{ day: TODAY, mood: "determined" }]);
  });

  test("covers AC-1: if the log refuses the event, the room's row is rolled back too", async () => {
    const w = await world();
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      for (let i = 0; i < 500; i++) {
        await ctx.db.insert("events", { memberId: w.s.memberId, actorId: "system", instituteId: m!.instituteId!, room: "test", type: "test.pong", schemaVer: 1, payload: { count: 1 }, occurredAt: NOW, loggedFor: TODAY, late: false, eventKey: `thing:f${i}` });
      }
    });
    expect(await refusal(save(w.s, "happy"))).toBe("day_full");
    expect(await rowsOf(w, w.s.memberId)).toHaveLength(0);
  });

  test("covers AC-7: the month and the year hold only the student's own days, oldest first, and a month with nothing or a future month is empty", async () => {
    const w = await world();
    await save(w.s, "happy", "mine");
    await save(w.s2, "sad", "theirs");
    expect((await month(w.s, "2026-10")).map((r) => r.note)).toEqual(["mine"]);
    expect((await month(w.s2, "2026-10")).map((r) => r.note)).toEqual(["theirs"]);
    expect(await month(w.s, "2026-09")).toEqual([]);
    expect(await month(w.s, "2030-01")).toEqual([]);
    expect(await w.s.as.query(api.moods.year, { year: "2025" })).toEqual([]);
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      for (let d = 1; d <= 31; d++) {
        if (d === 19) continue;
        await ctx.db.insert("moodDays", { memberId: w.s.memberId, instituteId: m!.instituteId!, day: `2026-10-${String(d).padStart(2, "0")}`, mood: "content", lineIx: d % 2, changes: 0 });
      }
    });
    const days = (await month(w.s, "2026-10")).map((r) => r.day);
    expect(days).toHaveLength(31);
    expect(days).toEqual([...days].sort());
    expect((await w.s.as.query(api.moods.year, { year: "2026" })).length).toBe(31);
  });

  test("covers AC-7: a bad month or year is refused", async () => {
    const w = await world();
    for (const bad of ["2026-13", "2026-00", "2026-1", "26-10", "2026-10-01", "", "1999-12"]) expect(await refusal(month(w.s, bad)), bad).toBe("bad_month");
    for (const bad of ["26", "20260", "abcd", "", "1999"]) expect(await refusal(w.s.as.query(api.moods.year, { year: bad })), bad).toBe("bad_year");
  });
});

describe("edits, one entry a day (AC-2)", () => {
  test("covers AC-2: a new mood changes the same row and replaces the event, so the day reads as logged once", async () => {
    const w = await world();
    await save(w.s, "happy", "first");
    const r = await save(w.s, "tired", "first");
    expect(r).toMatchObject({ ok: true, mood: "tired", changed: true });
    const rows = await rowsOf(w, w.s.memberId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mood: "tired", changes: 1 });
    const events = await eventsOf(w, w.s.memberId);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ payload: { mood: "tired" }, replaces: events[0]._id, eventKey: `mood:${rows[0]._id}-1` });
    // Readers see one current event for the day.
    const { eventsForDay } = await import("./eventLog");
    const current = await w.t.run(async (ctx) => await eventsForDay(ctx, { memberId: w.s.memberId, day: TODAY }));
    expect(current.map((e) => (e.payload as { mood: string }).mood)).toEqual(["tired"]);
  });

  test("covers AC-2: a change of the note alone patches the row and writes no event", async () => {
    const w = await world();
    await save(w.s, "happy", "one");
    expect(await save(w.s, "happy", "two")).toMatchObject({ ok: true, note: "two", changed: true });
    expect((await rowsOf(w, w.s.memberId))[0]).toMatchObject({ note: "two", changes: 0 });
    expect(await eventsOf(w, w.s.memberId)).toHaveLength(1);
  });

  // Review of 2026-10-26: the event holds the note's word count, which the Brain reads for its note days, so a note edit that changes it is a new event.
  test("covers AC-2: a note edit that changes the word count writes a replacing event, and a later mood change still gets its own key", async () => {
    const w = await world();
    await save(w.s, "happy");
    expect(await save(w.s, "happy", "a much longer note today")).toMatchObject({ ok: true, changed: true });
    const all = await eventsOf(w, w.s.memberId);
    expect(all).toHaveLength(2);
    expect(all[1].payload).toEqual({ mood: "happy", noteWords: 5 });
    expect(all[1].replaces).toBe(all[0]._id);
    expect((await rowsOf(w, w.s.memberId))[0]).toMatchObject({ changes: 0, noteEdits: 1 });
    expect(await save(w.s, "sad", "a much longer note today")).toMatchObject({ ok: true, changed: true });
    expect(await save(w.s, "sad", "")).toMatchObject({ ok: true, changed: true });
    const after = await eventsOf(w, w.s.memberId);
    expect(after).toHaveLength(4);
    expect(new Set(after.map((e) => e.eventKey)).size).toBe(4);
    expect(after[3].payload).toEqual({ mood: "sad", noteWords: 0 });
  });

  test("covers AC-2: the same mood and note again writes no row and no event", async () => {
    const w = await world();
    await save(w.s, "happy", "same");
    const again = await save(w.s, "happy", "  same  ");
    expect(again).toMatchObject({ ok: true, mood: "happy", note: "same", changed: false });
    expect(await rowsOf(w, w.s.memberId)).toHaveLength(1);
    expect(await eventsOf(w, w.s.memberId)).toHaveLength(1);
  });

  test("covers AC-2: the mood can change at most 10 times a day, then too_many_changes; the note still can", async () => {
    const w = await world();
    await save(w.s, MOOD_CODES[0]);
    for (let i = 1; i <= MAX_MOOD_CHANGES; i++) expect(await save(w.s, MOOD_CODES[i % 10 === 0 ? 1 : i % 10]), `change ${i}`).toMatchObject({ ok: true });
    expect(await save(w.s, "heavy")).toEqual({ ok: false, code: "too_many_changes" });
    expect(await save(w.s, MOOD_CODES[MAX_MOOD_CHANGES % 10 === 0 ? 1 : MAX_MOOD_CHANGES % 10], "a note after")).toMatchObject({ ok: true, changed: true });
    // The note went from no words to three, so it is one more event (review of 2026-10-26); the cap is on mood changes only.
    expect((await eventsOf(w, w.s.memberId)).length).toBe(2 + MAX_MOOD_CHANGES);
  });

  test("covers AC-2: yesterday's entry is never touched by today's save", async () => {
    const w = await world();
    await save(w.s, "happy", "yesterday");
    vi.setSystemTime(at("2026-10-20T10:00:00+05:30"));
    await save(w.s, "sad", "today");
    const rows = await rowsOf(w, w.s.memberId);
    expect(rows.map((r) => [r.day, r.mood, r.note])).toEqual([[TODAY, "happy", "yesterday"], ["2026-10-20", "sad", "today"]]);
  });
});

describe("the day (AC-3)", () => {
  test("covers AC-3: 03:59:59.999 belongs to the earlier day and 04:00 to the next, and the row day equals the event's day", async () => {
    const w = await world();
    vi.setSystemTime(at("2026-10-20T03:59:59.999+05:30"));
    await save(w.s, "happy");
    vi.setSystemTime(at("2026-10-20T04:00:00.000+05:30"));
    await save(w.s, "sad");
    const rows = await rowsOf(w, w.s.memberId);
    expect(rows.map((r) => r.day)).toEqual([TODAY, "2026-10-20"]);
    const events = await eventsOf(w, w.s.memberId);
    for (const row of rows) expect(events.find((e) => e.about === `mood:${row._id}`)?.loggedFor).toBe(row.day);
  });

  test("covers AC-3: the browser can name no day, and a save is never late", async () => {
    const w = await world();
    const sneaky = { mood: "happy", note: "x", day: "2026-10-01" } as unknown as { mood: string; note: string };
    await expect(w.s.as.mutation(api.moods.save, sneaky)).rejects.toThrow();
    await save(w.s, "happy");
    expect((await eventsOf(w, w.s.memberId))[0].late).toBe(false);
  });
});

describe("the note (AC-4)", () => {
  test("covers AC-4: 500 is allowed and 501 is not, an emoji counts once, the note is trimmed, and an empty note clears it", async () => {
    const w = await world();
    expect(await save(w.s, "happy", "a".repeat(500))).toMatchObject({ ok: true });
    expect(await save(w.s, "happy", "a".repeat(501))).toEqual({ ok: false, code: "note_too_long" });
    expect(await save(w.s, "happy", "😀".repeat(500))).toMatchObject({ ok: true, changed: true });
    expect(await save(w.s, "happy", "😀".repeat(501))).toEqual({ ok: false, code: "note_too_long" });
    expect(await save(w.s, "happy", `  line one\nline two  `)).toMatchObject({ ok: true, note: "line one\nline two" });
    expect(await save(w.s, "happy", "   ")).toMatchObject({ ok: true, note: "" });
    expect((await rowsOf(w, w.s.memberId))[0].note).toBeUndefined();
    expect((await month(w.s, "2026-10"))[0].note).toBe("");
  });

  test("covers AC-4: a wrong mood is bad_mood, never echoed, and the note appears in no event, log row or refusal", async () => {
    const w = await world();
    const secret = "my private secret words";
    const bad = await save(w.s, "<script>", secret);
    expect(bad).toEqual({ ok: false, code: "bad_mood" });
    expect(JSON.stringify(bad)).not.toContain("secret");
    await save(w.s, "happy", secret);
    await save(w.s, "sad", secret);
    const dump = JSON.stringify({
      events: await eventsOf(w, w.s.memberId),
      access: await w.t.run(async (ctx) => await ctx.db.query("accessLog").take(500)),
      view: await w.t.run(async (ctx) => await ctx.db.query("viewLog").take(500)),
      totals: await w.t.run(async (ctx) => await ctx.db.query("classTotals").take(500)),
    });
    expect(dump).not.toContain("secret");
  });
});

describe("who may use the room (AC-5, AC-6)", () => {
  test("covers AC-5: a student at the gate, one who withdrew, and every other role are refused", async () => {
    const w = await world();
    const gate = await makeStudent(w.t, w.A.admin, w.a1, "gate@alpha.test", false, { consent: false });
    expect(await refusal(save(gate, "happy"))).toBe("consent_required");
    expect(await refusal(month(gate, "2026-10"))).toBe("consent_required");
    await w.s.as.mutation(api.consent.withdraw, {});
    expect(await refusal(save(w.s, "happy"))).toBe("consent_withdrawn");
    expect(await refusal(month(w.s, "2026-10"))).toBe("consent_withdrawn");
    for (const p of [w.teacher, w.A.admin, w.dhi, w.counselor]) {
      expect(await refusal(save(p, "happy"))).toBe("forbidden");
      expect(await refusal(month(p, "2026-10"))).toBe("forbidden");
      expect(await refusal(p.as.query(api.moods.year, { year: "2026" }))).toBe("forbidden");
    }
    expect(await refusal(w.t.mutation(api.moods.save, { mood: "happy", note: "" }))).toBe("not_signed_in");
  });

  test("covers AC-5: a removed student and one of a paused institute are refused", async () => {
    const w = await world();
    await w.A.admin.as.mutation(api.members.remove, { memberId: w.s.memberId });
    expect(await refusal(save(w.s, "happy"))).toBe("removed");
    await w.dhi.as.mutation(api.institutes.update, { instituteId: w.A.instituteId, status: "suspended" });
    expect(await refusal(save(w.s2, "happy"))).toBe("institute_suspended");
  });

  test("covers AC-6: no source reads the mood table except the room's own files, the schema and the data map", () => {
    const files = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
    const allowed = ["./moods.ts", "./moodRoom.ts", "./schema.ts", "./dataMap.ts", "./moodProof.ts", "./home.ts"]; // moodProof.ts: dev only, test sign in guarded. home.ts counts the student's own days with a mood, never the mood or the note (checked in home.test.ts)
    for (const [name, text] of Object.entries(files)) {
      if (name.endsWith(".test.ts")) continue;
      const code = text.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
      if (/moodDays/.test(code)) expect(allowed, `${name} touches moodDays`).toContain(name);
    }
    // The room's functions are the only public ones that return a mood, and the year never returns a note.
    const moods = files["./moods.ts"];
    expect(moods).toMatch(/rows\.map\(\(r\) => \(\{ day: r\.day, mood: r\.mood \}\)\)/);
  });
});

describe("the limit (AC-10)", () => {
  test("covers AC-10: the 31st save in an hour is rate_limited, and every attempt counted", async () => {
    const w = await world();
    const codes: string[] = [];
    for (let i = 0; i < 31; i++) codes.push(await refusal(save(w.s, i % 2 ? "happy" : "sad", `n${i}`)));
    expect(codes.slice(0, 30).every((c) => c === "ok" || c === "too_many_changes")).toBe(true);
    expect(codes[30]).toBe("rate_limited");
    // A refused attempt (bad mood) still takes a token for another student.
    for (let i = 0; i < 30; i++) await save(w.s2, "nope");
    expect(await save(w.s2, "happy")).toEqual({ ok: false, code: "rate_limited" });
  });
});

describe("export and erase (AC-9)", () => {
  async function fill(w: World, n: number) {
    await w.t.run(async (ctx) => {
      const m = await ctx.db.get(w.s.memberId);
      for (let i = 0; i < n; i++) {
        const d = new Date(Date.UTC(2025, 0, 1 + i));
        await ctx.db.insert("moodDays", { memberId: w.s.memberId, instituteId: m!.instituteId!, day: d.toISOString().slice(0, 10), mood: MOOD_CODES[i % 10], note: `n${i}`, lineIx: 0, changes: 0 });
      }
    });
  }

  test("covers AC-9: the export holds the student's moods in pages of at most 100, day, mood and note only", async () => {
    const w = await world();
    await fill(w, 230);
    await save(w.s2, "happy", "not mine");
    const rows: { day: string; mood: string; note: string }[] = [];
    let cursor: string | null | undefined = undefined;
    const sections: string[] = [];
    for (let i = 0; i < 30; i++) {
      const r = (await w.s.as.mutation(api.dataRights.exportMine, { cursor })) as { ok: true; section: string; rows: { day: string; mood: string; note: string }[]; next: string | null };
      sections.push(r.section);
      if (r.section === "mood") {
        expect(r.rows.length).toBeLessThanOrEqual(100);
        rows.push(...r.rows);
      }
      if (r.next === null) break;
      cursor = r.next;
    }
    expect(sections).toEqual(["header", "events", "mood", "mood", "mood", "habits", "sleep", "exams", "blog", "blog", "meals", "modules", "hour", "brain", "desk", "counsel"]); // the habits and sleep rooms add their own (empty here) sections after
    expect(rows).toHaveLength(230);
    expect(new Set(rows.map((r) => r.day)).size).toBe(230);
    expect(Object.keys(rows[0]).sort()).toEqual(["day", "mood", "note"]);
    expect(JSON.stringify(rows)).not.toContain("not mine");
  });

  test("covers AC-9: an erase with more than one page of days leaves none, and another student's moods stay", async () => {
    const w = await world();
    await fill(w, 230);
    await save(w.s2, "happy", "stays");
    expect(await w.s.as.mutation(api.dataRights.eraseMine, { confirm: true })).toEqual({ ok: true });
    await w.t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await rowsOf(w, w.s.memberId)).toHaveLength(0);
    expect(await rowsOf(w, w.s2.memberId)).toHaveLength(1);
    const receipts = await w.t.run(async (ctx) => await ctx.db.query("houseErasures").take(5));
    expect(receipts[0].counts).toMatchObject({ events: 0, mood: 230 });
  });
});

describe("the words and the map (AC-8)", () => {
  test("covers AC-8: every mood has a guna, all three gunas are used, and the map is complete", () => {
    expect(Object.keys(GUNA_OF).sort()).toEqual([...MOOD_CODES].sort());
    expect(new Set(Object.values(GUNA_OF))).toEqual(new Set(GUNAS));
    expect(lineIxOf("2026-10-19")).toBe(1);
    expect(lineIxOf("2026-10-20")).toBe(0);
  });

  test("covers AC-9: the mood room is registered with its kind and its table is in the data map", async () => {
    const { ROOM_ENTRIES } = await import("./roomRegistry");
    expect(ROOM_ENTRIES.find((e) => e.room === "mood")).toMatchObject({ table: "moodDays", kinds: ["mood"] });
    const { DATA_MAP } = await import("./dataMap");
    expect(DATA_MAP.moodDays.class).toBe("erased");
    const { eventDef } = await import("./eventRegistry");
    expect(eventDef("mood", "mood.logged")?.version).toBe(2);
  });
});
