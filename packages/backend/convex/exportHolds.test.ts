/// <reference types="vite/client" />
// The download holds the student's own rows that the erase deletes (spec house/0005, AC-12): the review of 2026-10-26 found four kinds the erase took
// but the file left out (study hour chat messages, custom dishes, hidden patterns and the desk coins). Each is now a page of its room's export, and
// another student's rows never come with it.
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { makeBackend } from "../tests/convexTestUtils";
import { makeClass, makeDhiAdmin, makeInstitute, makeStudent, type Person } from "../tests/houseTestUtils";

type Page = { ok: true; section: string; rows: Record<string, unknown>[]; next: string | null };

async function download(p: Person) {
  const rooms: Record<string, Record<string, unknown>[]> = {};
  let cursor: string | null | undefined = undefined;
  for (let i = 0; i < 100; i++) {
    const r = (await p.as.mutation(api.dataRights.exportMine, cursor === undefined ? {} : { cursor })) as Page;
    expect(r.ok).toBe(true);
    expect(r.rows.length).toBeLessThanOrEqual(100);
    rooms[r.section] = [...(rooms[r.section] ?? []), ...r.rows];
    if (r.next === null) return rooms;
    cursor = r.next;
  }
  throw new Error("the export never ended");
}

async function giveRows(t: ReturnType<typeof makeBackend>, who: Person, instituteId: Id<"institutes">, tag: string, hours: Id<"studyHours">) {
  await t.run(async (ctx) => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await ctx.db.insert("chatMessages", { hourId: hours, instituteId, authorMemberId: who.memberId, text: `${tag} message ${i}`, createdAt: now, reported: false, status: "shown" });
    }
    await ctx.db.insert("foods", {
      status: "custom", nameEn: `${tag} dish`, group: "dal", processing: "home_cooked", energyKcal: 1, carbsG: 1, proteinG: 1, fatG: 1, serving: "1 bowl",
      source: "student", licence: "own", ownerMemberId: who.memberId, createdAt: now,
    });
    await ctx.db.insert("brainHides", { memberId: who.memberId, patternId: `${tag}-pattern`, until: now + 1000 });
    await ctx.db.insert("deskWallets", { memberId: who.memberId, instituteId, balance: tag === "mine" ? 42 : 7, grantedMonth: "2026-10" });
  });
}

describe("the download holds what the erase takes (AC-12)", () => {
  test("chat messages, custom dishes, hidden patterns and the coin balance are in the file, and nothing of another student", async () => {
    const t = makeBackend();
    const dhi = await makeDhiAdmin(t);
    const A = await makeInstitute(t, dhi, "Alpha School", "admin-a@alpha.test");
    const a1 = await makeClass(A.admin, "Class 10", "A");
    const s = await makeStudent(t, A.admin, a1, "s@alpha.test", false);
    const s2 = await makeStudent(t, A.admin, a1, "s2@alpha.test", false);
    const hour = await t.run((ctx) =>
      ctx.db.insert("studyHours", { opensAt: Date.now() - 1000, closesAt: Date.now() + 1000, setBy: dhi.memberId, createdAt: Date.now() }),
    );
    await giveRows(t, s, A.instituteId, "mine", hour);
    await giveRows(t, s2, A.instituteId, "theirs", hour);

    const rooms = await download(s);
    const text = JSON.stringify(rooms);
    expect((rooms.hour ?? []).filter((r) => typeof r.message === "string")).toHaveLength(3);
    expect((rooms.meals ?? []).some((r) => r.dish === "mine dish")).toBe(true);
    expect((rooms.brain ?? []).some((r) => r.hiddenPattern === "mine-pattern")).toBe(true);
    expect((rooms.desk ?? []).some((r) => (r.wallet as { balance?: number } | undefined)?.balance === 42)).toBe(true);
    expect(text).not.toContain("theirs");
  });
});
