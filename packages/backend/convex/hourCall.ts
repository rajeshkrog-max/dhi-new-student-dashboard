"use node";
// The study hour call on Stream Video (house spec 0027; the owner's answers of 2026-10-28): camera and voice, recorded on Stream, one call for each
// hour and institute. The only file besides counselCall.ts that talks to Stream. A join hands out a short lived token for that one call, signed here
// with the API secret, which never leaves the deployment. The recordings stay on Stream: that institute's teachers and a DHI admin open them through
// `recordings` (each look written for the students seated in that hour), and a student opens one shared with them. A daily job deletes recordings
// after RECORDING_KEEP_DAYS. Needs STREAM_API_KEY and STREAM_API_SECRET on the deployment, and `setupCallType` run once.
import { StreamClient } from "@stream-io/node-sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, env, internalAction } from "./_generated/server";
import { HOUR_CALL_MAX, HOUR_CALL_TYPE, callIdOf } from "./hourCallRules";

type Person = { id: string; name: string };
type JoinAccess = { ok: false; code: string } | { ok: true; me: Person; role: "call_member" | "moderator"; hourId: Id<"studyHours">; instituteId: Id<"institutes">; closesAt: number };
type WatchAccess = { ok: false; code: string } | { ok: true; viewerId: Id<"members">; viewerRole: string; staff: boolean };
type JoinReply = { ok: false; code: string } | { ok: true; apiKey: string; token: string; user: Person; callType: string; callId: string; moderator: boolean };
type MediaItem = { filename: string; url: string; startedAt: number; endedAt: number };
type MediaReply = { ok: false; code: string } | { ok: true; items: MediaItem[] };
const refused = v.object({ ok: v.literal(false), code: v.string() });

function stream(): StreamClient | null {
  const key = (env.STREAM_API_KEY ?? "").trim();
  const secret = (env.STREAM_API_SECRET ?? "").trim();
  return key && secret ? new StreamClient(key, secret, { timeout: 15000 }) : null;
}

// A student in a Live seat, or a teacher or DHI admin (naming the institute) joins the call of the hour open now. The caller is added to the call's
// members (a student as `call_member`, staff as `moderator`), and gets a token for this call only, ending when the hour closes.
export const joinHourCall = action({
  args: { instituteId: v.optional(v.id("institutes")) },
  returns: v.union(
    refused,
    v.object({ ok: v.literal(true), apiKey: v.string(), token: v.string(), user: v.object({ id: v.string(), name: v.string() }), callType: v.string(), callId: v.string(), moderator: v.boolean() }),
  ),
  handler: async (ctx, args): Promise<JoinReply> => {
    const now = Date.now();
    const access: JoinAccess = await ctx.runQuery(internal.hourShares.joinAccess, { now, ...(args.instituteId ? { instituteId: args.instituteId } : {}) });
    if (!access.ok) return access;
    const client = stream();
    if (!client) return { ok: false as const, code: "calls_not_set_up" };
    const callId = callIdOf(access.hourId, access.instituteId);
    try {
      await client.upsertUsers([{ id: access.me.id, name: access.me.name, role: "user" }]);
      const call = client.video.call(HOUR_CALL_TYPE, callId);
      await call.getOrCreate({ data: { created_by_id: access.me.id } });
      await call.updateCallMembers({ update_members: [{ user_id: access.me.id, role: access.role }] });
      const seconds = Math.max(60, Math.ceil((access.closesAt - now) / 1000) + 600);
      const token = client.generateCallToken({ user_id: access.me.id, call_cids: [`${HOUR_CALL_TYPE}:${callId}`], validity_in_seconds: seconds });
      return { ok: true as const, apiKey: (env.STREAM_API_KEY ?? "").trim(), token, user: access.me, callType: HOUR_CALL_TYPE, callId, moderator: access.role === "moderator" };
    } catch (error) {
      // Stream's own message (ids and codes, no words of a person), so a failed join can be read in the logs.
      console.log(`hourCall.joinHourCall: ${String((error as Error)?.message ?? error).slice(0, 300)}`);
      return { ok: false as const, code: "calls_unavailable" };
    }
  },
});

// One hour's recordings for one institute, with Stream's signed links. A staff look is written for every student seated in that hour.
export const recordings = action({
  args: { hourId: v.id("studyHours"), instituteId: v.id("institutes") },
  returns: v.union(refused, v.object({ ok: v.literal(true), items: v.array(v.object({ filename: v.string(), url: v.string(), startedAt: v.number(), endedAt: v.number() })) })),
  handler: async (ctx, args): Promise<MediaReply> => {
    const access: WatchAccess = await ctx.runQuery(internal.hourShares.watchAccess, args);
    if (!access.ok) return access;
    const client = stream();
    if (!client) return { ok: false as const, code: "calls_not_set_up" };
    let items: MediaItem[];
    try {
      const list = (await client.video.call(HOUR_CALL_TYPE, callIdOf(args.hourId, args.instituteId)).listRecordings()).recordings ?? [];
      const time = (d: Date | string | undefined) => (d ? new Date(d).getTime() : 0);
      items = list.map((r) => ({ filename: r.filename, url: r.url, startedAt: time(r.start_time), endedAt: time(r.end_time) }));
    } catch {
      return { ok: false as const, code: "calls_unavailable" };
    }
    if (access.staff && items.length > 0) await ctx.runMutation(internal.hourShares.recordWatch, { ...args, viewerId: access.viewerId, viewerRole: access.viewerRole });
    return { ok: true as const, items };
  },
});

// Run once per deployment (and again to apply a change): the private call type. Only a call's members may join; every call is recorded (no
// transcript); members may send audio, video and screen share; moderators may also mute and remove; at most HOUR_CALL_MAX people.
//   npx convex run hourCall:setupCallType
export const setupCallType = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), detail: v.string() }),
  handler: async () => {
    const client = stream();
    if (!client) return { ok: false, detail: "STREAM_API_KEY and STREAM_API_SECRET are not set" };
    const base = (await client.video.getCallType({ name: "default" })).grants ?? {};
    const userGrants = base.user ?? [];
    const grants: Record<string, string[]> = {
      ...base,
      call_member: [...new Set([...(base.call_member ?? []), ...userGrants])],
      moderator: [...new Set([...(base.moderator ?? []), ...userGrants])],
      user: [],
    };
    const settings = {
      recording: { mode: "auto-on" as const, quality: "720p" as const, audio_only: false },
      transcription: { mode: "disabled" as const },
      screensharing: { enabled: true, access_request_enabled: false, target_resolution: { width: 1280, height: 720, bitrate: 1500000 } },
      audio: { default_device: "speaker" as const, mic_default_on: false, noise_cancellation: { mode: "available" as const } },
      // A group of up to 50 cameras: a smaller picture than counseling's, to keep each one light.
      video: { enabled: true, camera_default_on: false, camera_facing: "front" as const, target_resolution: { width: 640, height: 480, bitrate: 800000 } },
      limits: { max_participants: HOUR_CALL_MAX },
      backstage: { enabled: false },
    };
    const exists = (await client.video.listCallTypes()).call_types?.[HOUR_CALL_TYPE] !== undefined;
    if (exists) await client.video.updateCallType({ name: HOUR_CALL_TYPE, grants, settings });
    else await client.video.createCallType({ name: HOUR_CALL_TYPE, grants, settings });
    return { ok: true, detail: `${exists ? "updated" : "created"} ${HOUR_CALL_TYPE}` };
  },
});

// Daily: deletes on Stream the recordings of hours that closed more than RECORDING_KEEP_DAYS ago.
export const sweepRecordings = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const client = stream();
    if (!client) return 0;
    const calls: { hourId: Id<"studyHours">; instituteId: Id<"institutes"> }[] = await ctx.runQuery(internal.hourShares.oldCalls, { now: Date.now() });
    let deleted = 0;
    for (const c of calls) {
      try {
        const call = client.video.call(HOUR_CALL_TYPE, callIdOf(c.hourId, c.instituteId));
        for (const r of (await call.listRecordings()).recordings ?? []) {
          await call.deleteRecording({ session: r.session_id, filename: r.filename });
          deleted += 1;
        }
      } catch {
        // A call nobody joined has nothing to delete.
      }
    }
    console.log(`hourCall.sweepRecordings: ${deleted} file(s) deleted on Stream`);
    return deleted;
  },
});
