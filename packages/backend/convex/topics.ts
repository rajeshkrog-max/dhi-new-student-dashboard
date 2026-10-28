// The topics of the papers (house spec 0028; owner, 2026-10-28: teachers tag each paper question, students tap on the card). A teacher picks a subject
// from the fixed list and writes the topic in their own words; the first question of an institute with that subject and topic makes one `paperTopics`
// row, and every later one with the same words (any case, any spacing) finds it. Sending a paper to a class notes its topics in `classTopics`, so a
// student's desk card offers only the topics of their own class's papers. A student's event and Brain day name a topic only by its row id, never by
// its words. `forCard` is the one public function: the student's own class, one subject, the newest topics. No staff function reads a student's tap.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { fail } from "./helpers";
import { requireMember } from "./houseAuth";
import { isSubject, topicKeyOf, type Subject } from "./sessionRules";

// The most topics a card offers for one subject: the newest sent.
export const CARD_TOPICS = 12;

// The topic row of a subject and the teacher's words in an institute, made the first time.
export async function ensureTopic(ctx: MutationCtx, instituteId: Id<"institutes">, subject: Subject, name: string): Promise<Id<"paperTopics">> {
  const key = topicKeyOf(name);
  const found = await ctx.db
    .query("paperTopics")
    .withIndex("by_instituteId_and_subject_and_key", (q) => q.eq("instituteId", instituteId).eq("subject", subject).eq("key", key))
    .first();
  if (found) return found._id;
  return await ctx.db.insert("paperTopics", { instituteId, subject, key, name: name.trim() });
}

// Notes the topics of a paper as sent to a class, now. A topic sent again only moves its time.
export async function noteSent(ctx: MutationCtx, classId: Id<"classes">, topics: readonly { topicId: Id<"paperTopics">; subject: string }[], at: number): Promise<void> {
  const seen = new Set<string>();
  for (const t of topics) {
    if (seen.has(t.topicId)) continue;
    seen.add(t.topicId);
    const row = await ctx.db.query("classTopics").withIndex("by_classId_and_topicId", (q) => q.eq("classId", classId).eq("topicId", t.topicId)).first();
    if (row) await ctx.db.patch(row._id, { lastSentAt: at });
    else await ctx.db.insert("classTopics", { classId, topicId: t.topicId, subject: t.subject, lastSentAt: at });
  }
}

// Whether a topic was sent to a class and belongs to a subject: the check before a student's tap is kept.
export async function isClassTopic(ctx: QueryCtx | MutationCtx, classId: Id<"classes"> | undefined, topicId: Id<"paperTopics">, subject: string): Promise<boolean> {
  if (classId === undefined) return false;
  const row = await ctx.db.query("classTopics").withIndex("by_classId_and_topicId", (q) => q.eq("classId", classId).eq("topicId", topicId)).first();
  return row !== null && row.subject === subject;
}

// The topics a student's card offers for one subject: those sent to their own class, newest first.
export const forCard = query({
  args: { subject: v.string() },
  returns: v.array(v.object({ topicId: v.id("paperTopics"), name: v.string() })),
  handler: async (ctx, args) => {
    const mc = await requireMember(ctx);
    if (mc.role !== "student") fail("forbidden");
    const classId = mc.member.classId;
    if (!isSubject(args.subject) || classId === undefined) return [];
    const rows = await ctx.db
      .query("classTopics")
      .withIndex("by_classId_and_subject_and_lastSentAt", (q) => q.eq("classId", classId).eq("subject", args.subject))
      .order("desc")
      .take(CARD_TOPICS);
    const out: { topicId: Id<"paperTopics">; name: string }[] = [];
    for (const r of rows) {
      const topic = await ctx.db.get(r.topicId);
      if (topic && topic.instituteId === mc.member.instituteId) out.push({ topicId: topic._id, name: topic.name });
    }
    return out;
  },
});
