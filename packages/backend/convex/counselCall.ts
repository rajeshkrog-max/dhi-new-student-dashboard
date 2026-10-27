"use node";
// The counseling call on Stream Video (spec house/0024; the owner's answers of 2026-10-27). The only file that talks to Stream. A booking's call has
// exactly two members, the student and their counselor, in the private call type `dhi_counsel`, where only a call's members may join; each call
// is recorded and transcribed on Stream. A join hands out a short lived call token for that one call, signed here with the API secret, which never
// leaves the deployment. The recording and the transcript stay on Stream: the counselor of the session, and the people they shared it with, open
// them through `media`. Needs STREAM_API_KEY and STREAM_API_SECRET on the deployment, and `setupCallType` run once.
import { StreamClient } from "@stream-io/node-sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, env, internalAction } from "./_generated/server";
import { CALL_MAX_SECONDS, CALL_TYPE } from "./counselRules";

const TOKEN_SECONDS = 2 * 60 * 60;

// What `counsel.callAccess` returns, written out so this file's own type does not depend on its own references (the Convex guidelines).
type Person = { id: string; name: string };
type Access = { ok: false; code: string } | { ok: true; me: Person; counselor: Person; student: Person; mayJoin: boolean; mayWatch: boolean };
type JoinReply = { ok: false; code: string } | { ok: true; apiKey: string; token: string; user: Person; callType: string; callId: string };
type MediaItem = { kind: string; filename: string; url: string; startedAt: number; endedAt: number };
type MediaReply = { ok: false; code: string } | { ok: true; items: MediaItem[] };
const refused = v.object({ ok: v.literal(false), code: v.string() });

function stream(): StreamClient | null {
  const key = (env.STREAM_API_KEY ?? "").trim();
  const secret = (env.STREAM_API_SECRET ?? "").trim();
  return key && secret ? new StreamClient(key, secret, { timeout: 15000 }) : null;
}

// The student or the counselor joins their booking's call, inside its window: the call is made (or found) with its two members, and the caller gets
// a call token for this call only.
export const joinCall = action({
  args: { bookingId: v.id("counselBookings") },
  returns: v.union(
    refused,
    v.object({ ok: v.literal(true), apiKey: v.string(), token: v.string(), user: v.object({ id: v.string(), name: v.string() }), callType: v.string(), callId: v.string() }),
  ),
  handler: async (ctx, args): Promise<JoinReply> => {
    const access: Access = await ctx.runQuery(internal.counsel.callAccess, { bookingId: args.bookingId, now: Date.now() });
    if (!access.ok) return access;
    if (!access.mayJoin) return { ok: false as const, code: "call_closed" };
    const client = stream();
    if (!client) return { ok: false as const, code: "calls_not_set_up" };
    try {
      await client.upsertUsers([
        { id: access.counselor.id, name: access.counselor.name, role: "user" },
        { id: access.student.id, name: access.student.name, role: "user" },
      ]);
      await client.video.call(CALL_TYPE, args.bookingId).getOrCreate({
        data: {
          created_by_id: access.counselor.id,
          members: [
            { user_id: access.counselor.id, role: "call_member" },
            { user_id: access.student.id, role: "call_member" },
          ],
        },
      });
      const token = client.generateCallToken({ user_id: access.me.id, call_cids: [`${CALL_TYPE}:${args.bookingId}`], validity_in_seconds: TOKEN_SECONDS });
      return { ok: true as const, apiKey: (env.STREAM_API_KEY ?? "").trim(), token, user: access.me, callType: CALL_TYPE, callId: args.bookingId };
    } catch {
      return { ok: false as const, code: "calls_unavailable" };
    }
  },
});

// A session's recordings and transcripts, for its counselor and the people they shared it with. The links are Stream's own signed links.
export const media = action({
  args: { bookingId: v.id("counselBookings") },
  returns: v.union(
    refused,
    v.object({ ok: v.literal(true), items: v.array(v.object({ kind: v.string(), filename: v.string(), url: v.string(), startedAt: v.number(), endedAt: v.number() })) }),
  ),
  handler: async (ctx, args): Promise<MediaReply> => {
    const access: Access = await ctx.runQuery(internal.counsel.callAccess, { bookingId: args.bookingId, now: Date.now() });
    if (!access.ok) return access;
    if (!access.mayWatch) return { ok: false as const, code: "not_found" };
    const client = stream();
    if (!client) return { ok: false as const, code: "calls_not_set_up" };
    try {
      const call = client.video.call(CALL_TYPE, args.bookingId);
      const recordings = (await call.listRecordings()).recordings ?? [];
      const transcripts = (await call.listTranscriptions()).transcriptions ?? [];
      const time = (d: Date | string | undefined) => (d ? new Date(d).getTime() : 0);
      return {
        ok: true as const,
        items: [
          ...recordings.map((r) => ({ kind: "recording", filename: r.filename, url: r.url, startedAt: time(r.start_time), endedAt: time(r.end_time) })),
          ...transcripts.map((t) => ({ kind: "transcript", filename: t.filename, url: t.url, startedAt: time(t.start_time), endedAt: time(t.end_time) })),
        ],
      };
    } catch {
      return { ok: false as const, code: "calls_unavailable" };
    }
  },
});

// Run once per deployment (and again to apply a change): the private call type. Only a call's members may join; every call is recorded and
// transcribed, with captions, screen sharing and noise cancellation on; at most 4 people and 60 minutes a call.
//   npx convex run counselCall:setupCallType
export const setupCallType = internalAction({
  args: {},
  returns: v.object({ ok: v.boolean(), detail: v.string() }),
  handler: async () => {
    const client = stream();
    if (!client) return { ok: false, detail: "STREAM_API_KEY and STREAM_API_SECRET are not set" };
    const base = (await client.video.getCallType({ name: "default" })).grants ?? {};
    const memberRole = Object.keys(base).find((r) => /call.member/.test(r)) ?? "call_member";
    const userGrants = base.user ?? [];
    // Members get everything a user of the default type may do; a plain user may do nothing in this type, so only members can join.
    const grants: Record<string, string[]> = { ...base, [memberRole]: [...new Set([...(base[memberRole] ?? []), ...userGrants])], user: [] };
    const settings = {
      recording: { mode: "auto-on" as const, quality: "720p" as const, audio_only: false },
      transcription: { mode: "auto-on" as const, closed_caption_mode: "available" as const, language: "auto" as const },
      screensharing: { enabled: true, access_request_enabled: false, target_resolution: { width: 1280, height: 720, bitrate: 1500000 } },
      audio: { default_device: "speaker" as const, noise_cancellation: { mode: "available" as const } },
      video: { enabled: true, camera_default_on: true, camera_facing: "front" as const, target_resolution: { width: 1280, height: 720, bitrate: 1500000 } },
      limits: { max_participants: 4, max_duration_seconds: CALL_MAX_SECONDS },
      backstage: { enabled: false },
    };
    const exists = (await client.video.listCallTypes()).call_types?.[CALL_TYPE] !== undefined;
    if (exists) await client.video.updateCallType({ name: CALL_TYPE, grants, settings });
    else await client.video.createCallType({ name: CALL_TYPE, grants, settings });
    return { ok: true, detail: `${exists ? "updated" : "created"} ${CALL_TYPE}; members role ${memberRole}` };
  },
});

// When a student is erased: the recordings and transcripts of their sessions are deleted on Stream too. Scheduled by the counseling eraser.
export const forget = internalAction({
  args: { bookingIds: v.array(v.string()) },
  returns: v.number(),
  handler: async (_ctx, args) => {
    const client = stream();
    if (!client) return 0;
    let deleted = 0;
    for (const id of args.bookingIds) {
      try {
        const call = client.video.call(CALL_TYPE, id);
        for (const r of (await call.listRecordings()).recordings ?? []) {
          await call.deleteRecording({ session: r.session_id, filename: r.filename });
          deleted += 1;
        }
        for (const t of (await call.listTranscriptions()).transcriptions ?? []) {
          await call.deleteTranscription({ session: t.session_id, filename: t.filename });
          deleted += 1;
        }
      } catch {
        // A call that was never made has nothing to delete.
      }
    }
    console.log(`counselCall.forget: ${deleted} file(s) deleted on Stream`);
    return deleted;
  },
});
