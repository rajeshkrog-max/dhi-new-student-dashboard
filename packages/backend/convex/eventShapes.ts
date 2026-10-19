// The rules for what an event may carry (spec house/0004, AC-8): the room codes, the fixed form of `about` and `eventKey`, the field kinds a
// registered payload may use, `defineEvent` that builds a registry entry, and `checkPayload` that tests one payload against its entry.
// This file is pure (no database, no clock). The field kinds are the whole point: there is no free text kind, so a registry entry cannot hold a
// student's own words. A payload string is a fixed code from a short list, or an id.

// The rooms of the house. Counseling is deferred and has no code. `test` is for the log's own tests and the development proof only.
export const ROOMS = ["mood", "meals", "habits", "sleep", "exams", "modules", "blog", "desk", "hour", "test"] as const;
export type Room = (typeof ROOMS)[number];
export const isRoom = (text: unknown): text is Room => typeof text === "string" && (ROOMS as readonly string[]).includes(text);

export const MAX_PAYLOAD_BYTES = 2048;
export const MAX_KEY_LENGTH = 100;
// `table:id`: a lowercase word, a colon, then letters, digits, `_` or `-`. At most 100 characters in all.
const KEY_RE = /^[a-z]+:[A-Za-z0-9_-]+$/;
export const isEventKey = (text: unknown): text is string => typeof text === "string" && text.length <= MAX_KEY_LENGTH && KEY_RE.test(text);

const CODE_RE = /^[a-z0-9][a-z0-9_.-]{0,39}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
// `mood.logged`: the room, a dot, then a lowercase word. The room in front keeps a type from being claimed by two rooms.
const TYPE_RE = /^[a-z]+\.[a-z][a-z0-9_]*$/;
const FIELD_RE = /^[a-z][A-Za-z0-9]{0,29}$/;

export type Scalar =
  | { kind: "int"; min?: number; max?: number; optional?: boolean }
  | { kind: "number"; min?: number; max?: number; optional?: boolean }
  | { kind: "boolean"; optional?: boolean }
  | { kind: "code"; values: readonly string[]; optional?: boolean }
  | { kind: "id"; optional?: boolean };

// One level of nesting at most: a list of scalars, or a group of scalars.
export type FieldSpec = Scalar | { kind: "list"; of: Scalar; max: number; optional?: boolean } | { kind: "group"; fields: Record<string, Scalar>; optional?: boolean };

export type EventDef = { room: Room; type: string; version: number; payload: Readonly<Record<string, FieldSpec>> };

const SCALAR_KINDS: readonly string[] = ["int", "number", "boolean", "code", "id"];

function defineProblem(def: EventDef): string | null {
  if (!isRoom(def.room)) return "unknown room";
  if (!TYPE_RE.test(def.type) || !def.type.startsWith(`${def.room}.`)) return "type must be <room>.<name>";
  if (!Number.isInteger(def.version) || def.version < 1) return "version must be a whole number from 1";
  const checkScalar = (s: Scalar): string | null => {
    if (!SCALAR_KINDS.includes(s.kind)) return "no such field kind (there is no free text kind)";
    if (s.kind === "code") {
      if (s.values.length === 0) return "a code field needs its list of codes";
      if (s.values.some((c) => !CODE_RE.test(c))) return "a code must be a short fixed word";
    }
    return null;
  };
  for (const [name, spec] of Object.entries(def.payload)) {
    if (!FIELD_RE.test(name)) return `bad field name ${name}`;
    if (spec.kind === "list") {
      if (!Number.isInteger(spec.max) || spec.max < 1 || spec.max > 100) return "a list needs a size from 1 to 100";
      const p = checkScalar(spec.of);
      if (p) return p;
    } else if (spec.kind === "group") {
      for (const [inner, s] of Object.entries(spec.fields)) {
        if (!FIELD_RE.test(inner)) return `bad field name ${inner}`;
        const p = checkScalar(s);
        if (p) return p;
      }
    } else {
      const p = checkScalar(spec);
      if (p) return p;
    }
  }
  return null;
}

// Builds a registry entry, and refuses a bad one when the file loads, so a free text field cannot be registered at all: the kinds above are
// the only ones, and a `code` must list its fixed words. The entry is useful only once it is listed in `eventRegistry.ts`.
export function defineEvent(def: EventDef): EventDef {
  const problem = defineProblem(def);
  if (problem) throw new Error(`defineEvent(${String(def.type)}): ${problem}`);
  return def;
}

const isPlainObject = (x: unknown): x is Record<string, unknown> => Object.prototype.toString.call(x) === "[object Object]";

function scalarOk(spec: Scalar, value: unknown): boolean {
  switch (spec.kind) {
    case "int":
      return typeof value === "number" && Number.isInteger(value) && (spec.min === undefined || value >= spec.min) && (spec.max === undefined || value <= spec.max);
    case "number":
      return typeof value === "number" && Number.isFinite(value) && (spec.min === undefined || value >= spec.min) && (spec.max === undefined || value <= spec.max);
    case "boolean":
      return typeof value === "boolean";
    case "code":
      return typeof value === "string" && spec.values.includes(value);
    case "id":
      return typeof value === "string" && ID_RE.test(value);
  }
}

function fieldOk(spec: FieldSpec, value: unknown): boolean {
  if (spec.kind === "list") return Array.isArray(value) && value.length <= spec.max && value.every((x) => scalarOk(spec.of, x));
  if (spec.kind === "group") {
    if (!isPlainObject(value)) return false;
    const names = Object.keys(value);
    if (names.some((n) => !(n in spec.fields))) return false;
    return Object.entries(spec.fields).every(([n, s]) => (value[n] === undefined ? s.optional === true : scalarOk(s, value[n])));
  }
  return scalarOk(spec, value);
}

export type PayloadProblem = "bad_payload" | "payload_too_big";

// A payload is the exact shape the entry names: no field that is not listed, every required field present, every value of its kind.
// Over 2 KB (the UTF-8 size of its JSON) is its own refusal, checked first so a huge object is never walked.
export function checkPayload(def: EventDef, payload: unknown): PayloadProblem | null {
  if (!isPlainObject(payload)) return "bad_payload";
  let json: string;
  try {
    json = JSON.stringify(payload);
  } catch {
    return "bad_payload";
  }
  if (new TextEncoder().encode(json).length > MAX_PAYLOAD_BYTES) return "payload_too_big";
  if (Object.keys(payload).some((n) => !(n in def.payload))) return "bad_payload";
  for (const [name, spec] of Object.entries(def.payload)) {
    const value = payload[name];
    if (value === undefined) {
      if (spec.optional !== true) return "bad_payload";
      continue;
    }
    if (!fieldOk(spec, value)) return "bad_payload";
  }
  return null;
}

// Two payloads are the same content when they have the same keys and values, whatever order the keys came in.
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
