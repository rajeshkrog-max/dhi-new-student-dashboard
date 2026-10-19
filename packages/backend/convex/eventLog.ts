// The room event log (spec house/0004). Every finished action in a room becomes one event, saved in the same transaction as the room's own row,
// so the two can never disagree: a refusal here throws, and Convex rolls the room's write back with it. The log owns the day rule, the retry
// rule, the late rule and the correction rule, so no room can get them wrong.
//
// These are server helpers, not Convex functions: a browser cannot call them. A room's public mutation finds the student itself (from the
// verified session or its own scoped lookup, never from the browser) and calls `recordEvent` beside its own write. Events are never updated
// or deleted here (AC-10). The read helpers may be imported only by the files on the allowlist in eventLog.test.ts (AC-12).
// Nothing in this file logs: refusals carry a fixed code and nothing else (AC-14).
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { dayOf, isDayKey, isLate, MAX_AGE_DAYS, shiftDay, todayOf } from "./dayRules";
import { eventDef } from "./eventRegistry";
import { checkPayload, isEventKey, stableJson } from "./eventShapes";
import { gateOf } from "./consentState";
import { fail } from "./helpers";
import type { MemberContext } from "./houseAuth";

// The limits, as constants of this module (spec "Value sourcing"). The 7 days is the log's ceiling; a room may allow fewer.
export const MAX_AHEAD_MS = 5 * 60 * 1000;
export const MAX_EVENTS_PER_DAY = 500;
export { MAX_AGE_DAYS };

// Who is recording: a member's context from `requireMember`, so the role and a teacher's current classes are re-read on this call.
export type EventActor = Pick<MemberContext, "member" | "role" | "classIds">;

export type RecordInput = {
  memberId: Id<"members">; // the student it is about
  room: string;
  type: string;
  payload?: Record<string, unknown>; // not given for a void
  occurredAt: number; // when the thing happened; a room with no real time of its own passes the server time
  eventKey: string; // `table:id`, stable for the room's own row and action, so a retry is a retry
  about?: string; // `table:id`: the thing this event is about
  replaces?: Id<"events">; // the earlier event of the same thing and day this corrects (from `currentFor`)
  void?: boolean; // true undoes the thing, so the day reads not logged again
};

export type RecordResult = { eventId: Id<"events">; loggedFor: string; late: boolean; duplicate: boolean };

// The current events of a list of one student's events for one day, oldest first. The current event of a thing is the latest stored one for the
// same `about`; an event with no `about` is its own thing. Index order is creation order, so the last row of a group is the latest.
function currentOf(rows: Doc<"events">[]): Doc<"events">[] {
  const latest = new Map<string, Doc<"events">>();
  const loose: Doc<"events">[] = [];
  for (const row of rows) {
    if (row.about === undefined) loose.push(row);
    else latest.set(row.about, row);
  }
  const current = new Set<Id<"events">>([...loose, ...latest.values()].map((r) => r._id));
  return rows.filter((r) => current.has(r._id));
}

async function rowsForDay(ctx: QueryCtx | MutationCtx, memberId: Id<"members">, day: string): Promise<Doc<"events">[]> {
  return await ctx.db
    .query("events")
    .withIndex("by_memberId_and_loggedFor", (q) => q.eq("memberId", memberId).eq("loggedFor", day))
    .take(MAX_EVENTS_PER_DAY + 1);
}

function sameContent(stored: Doc<"events">, input: RecordInput, schemaVer: number, payload: Record<string, unknown>): boolean {
  return (
    stored.room === input.room &&
    stored.type === input.type &&
    stored.schemaVer === schemaVer &&
    stableJson(stored.payload) === stableJson(payload) &&
    stored.occurredAt === input.occurredAt &&
    stored.about === input.about &&
    stored.replaces === input.replaces &&
    (stored.voided ?? false) === (input.void ?? false)
  );
}

async function write(ctx: MutationCtx, actor: EventActor | "system", input: RecordInput): Promise<RecordResult> {
  // 1. The type, the keys and the payload. Cheap checks first, nothing read yet.
  const def = eventDef(input.room, input.type);
  if (!def) fail("unknown_type");
  if (!isEventKey(input.eventKey)) fail("bad_key");
  if (input.about !== undefined && !isEventKey(input.about)) fail("bad_key");
  const isVoid = input.void === true;
  if (isVoid && input.about === undefined) fail("bad_void");
  let payload: Record<string, unknown>;
  if (isVoid) {
    if (input.payload !== undefined && Object.keys(input.payload).length > 0) fail("bad_payload");
    payload = {};
  } else {
    const problem = checkPayload(def, input.payload);
    if (problem === "payload_too_big") fail("payload_too_big");
    if (problem) fail("bad_payload");
    // A field left undefined is not a value: it is dropped, so the stored payload and a retry's payload compare the same.
    payload = Object.fromEntries(Object.entries(input.payload as Record<string, unknown>).filter(([, value]) => value !== undefined));
  }
  if (!Number.isFinite(input.occurredAt)) fail("bad_time");

  // 2. Who it is about, and whether this actor may record about them. A student acts only on themselves, a teacher on a student of a class
  // assigned to them, a DHI admin on any student, a counselor and an institute admin never. `system` is the internal wrapper's alone.
  if (actor !== "system") {
    if (actor.role === "counselor" || actor.role === "institute_admin") fail("forbidden");
    if (actor.role === "student" && actor.member._id !== input.memberId) fail("forbidden");
  }
  const student = await ctx.db.get(input.memberId);
  if (!student || student.role !== "student") fail("not_a_student");
  if (actor !== "system" && actor.role === "teacher" && !(student.classId !== undefined && actor.classIds.includes(student.classId))) fail("forbidden");
  const institute = student.instituteId ? await ctx.db.get(student.instituteId) : null;
  if (student.status !== "active" || !institute || institute.status !== "active") fail("member_inactive");
  // Consent stops events for every actor, teacher, DHI admin or system job alike (house spec 0005, AC-1 and AC-5): a student who has not agreed,
  // has no parent record on file (under 18) or withdrew gets nothing recorded about them. The log owns this so no room can forget it.
  const gate = await gateOf(ctx, student);
  if (gate.state === "withdrawn") fail("consent_withdrawn");
  if (gate.state === "consentNeeded") fail("consent_required");

  // 3. A retry. The same student and key with the same content returns the first event as it was stored; different content is a bug in a room.
  const stored = await ctx.db
    .query("events")
    .withIndex("by_memberId_and_eventKey", (q) => q.eq("memberId", input.memberId).eq("eventKey", input.eventKey))
    .first();
  if (stored) {
    if (!sameContent(stored, input, def.version, payload)) fail("key_conflict");
    return { eventId: stored._id, loggedFor: stored.loggedFor, late: stored.late, duplicate: true };
  }

  // 4. Time. The server clock is `Date.now()` here, and the day is worked out from `occurredAt`; no caller can set it.
  const now = Date.now();
  const today = todayOf(now);
  const loggedFor = dayOf(input.occurredAt);
  if (input.occurredAt > now + MAX_AHEAD_MS || loggedFor > today) fail("in_future");
  if (loggedFor < shiftDay(today, -MAX_AGE_DAYS)) fail("too_old");
  if (loggedFor < dayOf(student.joinedAt)) fail("before_joined");

  // 5. A correction. It must be about the same student, thing, day, room and type as the event it names (a newer version is allowed).
  if (input.replaces !== undefined) {
    const earlier = await ctx.db.get(input.replaces);
    if (
      !earlier ||
      earlier.memberId !== input.memberId ||
      input.about === undefined ||
      earlier.about !== input.about ||
      earlier.loggedFor !== loggedFor ||
      earlier.room !== input.room ||
      earlier.type !== input.type
    ) {
      fail("replaces_mismatch");
    }
  }

  // 6. Late. A correction keeps the lateness of the first event of its thing and day, so a late fix never turns an on time day late.
  let late = isLate(loggedFor, now);
  if (input.about !== undefined) {
    const about = input.about;
    const first = await ctx.db
      .query("events")
      .withIndex("by_memberId_and_about_and_loggedFor", (q) => q.eq("memberId", input.memberId).eq("about", about).eq("loggedFor", loggedFor))
      .first();
    if (first) late = first.late;
  }

  // 7. The daily cap counts every stored row of the day, replaced and voided ones too.
  if ((await rowsForDay(ctx, input.memberId, loggedFor)).length >= MAX_EVENTS_PER_DAY) fail("day_full");

  const eventId = await ctx.db.insert("events", {
    memberId: input.memberId,
    actorId: actor === "system" ? "system" : actor.member._id,
    instituteId: student.instituteId as Id<"institutes">,
    ...(student.classId !== undefined ? { classId: student.classId } : {}),
    room: input.room,
    type: input.type,
    schemaVer: def.version,
    payload,
    occurredAt: input.occurredAt,
    loggedFor,
    late,
    ...(isVoid ? { voided: true } : {}),
    eventKey: input.eventKey,
    ...(input.about !== undefined ? { about: input.about } : {}),
    ...(input.replaces !== undefined ? { replaces: input.replaces } : {}),
  });
  return { eventId, loggedFor, late, duplicate: false };
}

// A room calls this inside its own mutation, beside its own write.
export async function recordEvent(ctx: MutationCtx, args: RecordInput & { by: EventActor }): Promise<RecordResult> {
  const { by, ...input } = args;
  // The type does not allow the word system, and this stops it at run time too: only recordSystemEvent writes as the system.
  if ((by as unknown) === "system" || typeof by !== "object" || by === null) fail("forbidden");
  return await write(ctx, by, input);
}

// The same, with `system` as the actor, for internal jobs only (a nightly job, a migration). Never reachable from a browser.
export async function recordSystemEvent(ctx: MutationCtx, input: RecordInput): Promise<RecordResult> {
  return await write(ctx, "system", input);
}

// The current events of one student and one day: not voided ones unless asked, at most 500, sorted by time, creation and id.
export async function eventsForDay(ctx: QueryCtx | MutationCtx, args: { memberId: Id<"members">; day: string; includeVoided?: boolean }): Promise<Doc<"events">[]> {
  if (!isDayKey(args.day)) fail("bad_day");
  const rows = currentOf(await rowsForDay(ctx, args.memberId, args.day));
  return rows
    .filter((r) => args.includeVoided === true || r.voided !== true)
    .sort((a, b) => a.occurredAt - b.occurredAt || a._creationTime - b._creationTime || (a._id < b._id ? -1 : a._id > b._id ? 1 : 0))
    .slice(0, MAX_EVENTS_PER_DAY);
}

// The current event for a thing on a day, or null. It includes a voided event: the latest event of the thing is the current one, and a room that
// wants to log the thing again names it in `replaces`.
export async function currentFor(ctx: QueryCtx | MutationCtx, args: { memberId: Id<"members">; about: string; day: string }): Promise<Doc<"events"> | null> {
  if (!isDayKey(args.day)) fail("bad_day");
  if (!isEventKey(args.about)) fail("bad_key");
  const about = args.about;
  return await ctx.db
    .query("events")
    .withIndex("by_memberId_and_about_and_loggedFor", (q) => q.eq("memberId", args.memberId).eq("about", about).eq("loggedFor", args.day))
    .order("desc")
    .first();
}

// Whether a student has any current, not voided event of the given rooms on any day from `fromDay` to `toDay` (both included). It is what a class
// total counts (spec house/0005, AC-23): a yes or no per student, never the events. It probes one room at a time through an index and stops at the
// first hit, looking at no more than 40 rows a room, so a class of 40 students stays well inside one transaction.
export async function hasEventInRange(
  ctx: QueryCtx | MutationCtx,
  args: { memberId: Id<"members">; rooms: readonly string[]; fromDay: string; toDay: string },
): Promise<boolean> {
  if (!isDayKey(args.fromDay) || !isDayKey(args.toDay)) fail("bad_day");
  for (const room of args.rooms) {
    const rows = ctx.db
      .query("events")
      .withIndex("by_memberId_and_room_and_loggedFor", (q) => q.eq("memberId", args.memberId).eq("room", room).gte("loggedFor", args.fromDay).lte("loggedFor", args.toDay));
    let seen = 0;
    for await (const row of rows) {
      if (++seen > 40) break;
      if (row.voided === true) continue;
      if (row.about === undefined) return true;
      // The row counts only if it is the current event of its thing on its day (the latest one).
      const about = row.about;
      const latest = await ctx.db
        .query("events")
        .withIndex("by_memberId_and_about_and_loggedFor", (q) => q.eq("memberId", args.memberId).eq("about", about).eq("loggedFor", row.loggedFor))
        .order("desc")
        .first();
      if (latest && latest._id === row._id) return true;
    }
  }
  return false;
}

export type DayState = "logged" | "notLogged" | "beforeJoined" | "future";

// Whether a day was logged. Nothing is written for a missed day, and a missed day is never a zero. `today` is the caller's own clock: a query
// passes the time it was given, a mutation may leave it out and use its own. Only current events that are not voided count.
export async function dayStatus(
  ctx: QueryCtx | MutationCtx,
  args: { memberId: Id<"members">; day: string; room?: string; types?: string[]; today?: string },
): Promise<DayState> {
  if (!isDayKey(args.day)) fail("bad_day");
  if (args.types !== undefined && args.types.length === 0) fail("bad_types");
  const today = args.today ?? todayOf(Date.now());
  if (!isDayKey(today)) fail("bad_day");
  if (args.day > today) return "future";
  const student = await ctx.db.get(args.memberId);
  if (!student) fail("not_a_student");
  if (args.day < dayOf(student.joinedAt)) return "beforeJoined";
  const types = args.types;
  const logged = currentOf(await rowsForDay(ctx, args.memberId, args.day)).some(
    (r) => r.voided !== true && (args.room === undefined || r.room === args.room) && (types === undefined || types.includes(r.type)),
  );
  return logged ? "logged" : "notLogged";
}
