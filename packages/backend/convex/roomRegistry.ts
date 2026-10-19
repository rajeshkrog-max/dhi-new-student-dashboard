// The rooms' hooks into export and erase (spec house/0005, AC-12, AC-13, AC-14). Each room row adds one entry when the room is built: the table it
// owns, the kind codes its data uses (which `accessRules.ts` ROOM_KINDS names), an exporter that returns a page of a student's rows, and an eraser
// that deletes a page of them. The export and the erase walk this list, so a room that registers nothing would leave data behind: a test fails
// if a room that has a kind code is missing here, and a test fails if a table is missing from the data map.
//
// The event log is not a room: it has its own export and erase (eventData.ts), because every room writes to it.
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import type { DataKind } from "./accessRules";
import { moodRoom } from "./moodRoom";

export type ExportPage = { rows: unknown[]; next: string | null };
export type ErasePage = { deleted: number; done: boolean };

export type RoomEntry = {
  room: string; // a code from ROOMS (eventShapes.ts)
  table: string; // the table the room owns (its name is also in the data map)
  kinds: readonly DataKind[];
  // A page of this student's rows for their download. `cursor` is whatever the exporter returned before (null for the first page).
  exporter: (ctx: QueryCtx | MutationCtx, memberId: Id<"members">, cursor: string | null, limit: number) => Promise<ExportPage>;
  // Deletes up to `limit` of this student's rows and says whether any are left. Called again until `done`.
  eraser: (ctx: MutationCtx, memberId: Id<"members">, limit: number) => Promise<ErasePage>;
};

// Each room row adds its entry when the room moves to the backend. The mood room (house spec 0006) is the first; the rest still run on demo data.
export const ROOM_ENTRIES: readonly RoomEntry[] = [moodRoom];

export const EXPORT_PAGE = 100;
export const ERASE_PAGE = 100;
