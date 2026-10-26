// The home screen's real data (spec house/0017): open exams, the DHI score with its inputs, and presence counts for mood and meals. The score is the
// Brain's three growth lamps (brainRules.ts, spec house/0020) over the student's own last 28 days, read from their stored daily values with today worked
// out live, and it is never stored. It reads only the signed in student's own rows. Every function starts with `requireMember`, so the consent gate applies.
import { v } from "convex/values";
import { query } from "./_generated/server";
import { windowRows } from "./brainDay";
import { LAMP_WINDOW, lampsOf, type LampInput } from "./brainRules";
import { dayOf } from "./dayRules";
import { fail } from "./helpers";
import { requireMember } from "./houseAuth";

const lampView = v.object({ name: v.string(), value: v.union(v.number(), v.null()), inputs: v.array(v.object({ label: v.string(), value: v.string() })) });

// What each input is called on the card, in plain words.
const LABELS: Record<string, string> = {
  A01: "Papers sat before the window closed",
  H12: "Days sat in the study hour, of the days one was open",
  H08: "Days with a habit tick, of the days one was open",
  A15: "Films kept, out of four in four weeks",
};
const NAMES: Record<string, string> = { sadhana: "Sadhana", niyam: "Niyam", viveka: "Viveka" };
const pct = (x: number | null) => (x === null ? "Not yet" : `${Math.round(x * 100)}%`);
const inputView = (i: LampInput) => ({ label: LABELS[i.metric] ?? i.metric, value: pct(i.value) });

export const summary = query({
  args: {},
  returns: v.object({
    name: v.string(),
    openExams: v.array(v.object({ attemptId: v.id("paperAttempts"), title: v.string(), dueAt: v.number() })),
    score: v.union(v.number(), v.null()),
    lamps: v.array(lampView),
    presence: v.object({ moodDays: v.number(), mealDays: v.number() }),
  }),
  handler: async (ctx) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const now = Date.now();
    const today = dayOf(now);

    // Open exams: the papers whose window is open now and that the student has not submitted.
    const attempts = await ctx.db.query("paperAttempts").withIndex("by_memberId", (q) => q.eq("memberId", mc.member._id)).order("desc").take(300);
    const openExams = [];
    for (const a of attempts) {
      if (a.opensAt <= now && now < a.dueAt && (a.status === "assigned" || a.status === "open")) {
        const paper = await ctx.db.get(a.paperId);
        if (paper) openExams.push({ attemptId: a._id, title: paper.title, dueAt: a.dueAt });
      }
    }

    // The score and the lamps, and presence only for mood and meals: the days in the window with a mood logged, and with a plate logged. What they
    // hold never reaches the score or this answer.
    const rows = await windowRows(ctx, mc.member, now, LAMP_WINDOW);
    const { score, lamps } = lampsOf(rows, today);
    return {
      name: mc.member.name,
      openExams: openExams.sort((a, b) => a.dueAt - b.dueAt),
      score,
      lamps: lamps.map((l) => ({ name: NAMES[l.lamp], value: l.value, inputs: l.inputs.map(inputView) })),
      presence: { moodDays: rows.filter((r) => r.v.E01 !== undefined).length, mealDays: rows.filter((r) => r.v.H02 !== undefined).length },
    };
  },
});
