// The first DHI admin (spec house/0002, AC-1). The owner runs this once from a terminal with a Google email:
//   npx convex run bootstrap:dhiAdmin '{"email":"owner@example.com","name":"Owner"}'
// It makes a DHI admin invite with no institute, and that person claims it through the same Join step as everyone else. No list of powerful
// emails is kept in the environment, and the function is internal, so a browser can never call it. Run twice for the same address it
// answers `email_in_use`.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { cleanName, fail } from "./helpers";
import { emailTaken, insertInvite } from "./inviteCore";
import { normaliseEmail } from "./houseCore";

export const dhiAdmin = internalMutation({
  args: { email: v.string(), name: v.string() },
  returns: v.object({ inviteId: v.id("invites") }),
  handler: async (ctx, args) => {
    const email = normaliseEmail(args.email);
    if (!email) fail("bad_email");
    const name = cleanName(args.name);
    if (!name) fail("bad_name");
    if (await emailTaken(ctx, email)) fail("email_in_use");
    const inviteId = await insertInvite(ctx, { draft: { role: "dhi_admin" }, email, name, createdBy: "owner" });
    return { inviteId };
  },
});
