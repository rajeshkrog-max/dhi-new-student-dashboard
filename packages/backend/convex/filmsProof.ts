// A development only helper for the browser proof of the Modules room (spec house/0013). A DHI admin cannot sign in with the test form, so this
// adds the six demo films, already approved, so a student has films to watch. It refuses to run where the test sign in is off (production), adds
// a film only if none of that title exists, and does nothing else. Run once after `demo:seed` and a sign in of the demo institute admin:
//   npx convex run filmsProof:seedDemo
import { env, internalMutation } from "./_generated/server";
import { fail } from "./helpers";

const FILMS = [
  { title: "The leaf kitchen", category: "academic", blurb: "Where sugar is cooked. Sit until the film closes.", cover: "/desk/leaf-kitchen.jpg", hostRef: "/landing/day.mp4" },
  { title: "The cell's hearth", category: "academic", blurb: "ATP is the coin. Watch it once, whole.", cover: "/desk/cell-story.jpg", hostRef: "/landing/night.mp4" },
  { title: "One quiet breath", category: "mental_health", blurb: "Nothing to solve. Stay until the end.", cover: "/mood/thought.jpg", hostRef: "/landing/night.mp4" },
  { title: "A plate is a practice", category: "self_help", blurb: "Food, without a lecture. The film keeps the pace.", cover: "/meals/thali.jpg", hostRef: "/landing/day.mp4" },
  { title: "Five small lamps", category: "self_help", blurb: "A habit is a film you finish, not a list you start.", cover: "/habits/grove.jpg", hostRef: "/landing/day.mp4" },
  { title: "When the day is heavy", category: "mental_health", blurb: "A room to sit in. No chat. No skip.", cover: "/mood/room.jpg", hostRef: "/landing/night.mp4" },
];

export const seedDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (env.TEST_SIGNIN_ENABLED !== "true") fail("proof_disabled");
    const admin = await ctx.db.query("members").withIndex("by_email", (q) => q.eq("email", "demo-admin@example.test")).first();
    if (!admin) fail("run_demo_seed_and_sign_in_first");
    let made = 0;
    const existing = await ctx.db.query("films").withIndex("by_status", (q) => q.eq("status", "approved")).take(200);
    for (const f of FILMS) {
      if (existing.some((e) => e.title === f.title)) continue;
      const filmId = await ctx.db.insert("films", { ...f, durationSec: 15, scoreValue: 10, status: "approved", uploadedBy: admin._id, approvedBy: admin._id, createdAt: Date.now() });
      if (f.category === "academic") {
        for (const order of [0, 1]) {
          await ctx.db.insert("filmChecks", { filmId, order, question: `Check question ${order + 1}`, options: ["One", "Two", "Three"], rightOption: 1 });
        }
      }
      made += 1;
    }
    return { made };
  },
});
