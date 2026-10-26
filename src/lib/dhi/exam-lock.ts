// The rooms an open paper closes (house spec 0012 AC-7; owner, 2026-10-26): the ones that could help answer it. The server refuses them too
// (packages/backend/convex/examLock.ts). Mood, habits, sleep, meals, Progress, Your data and Leave stay open, so a long window never keeps a student
// from their logs, their data or signing out.
export const EXAM_LOCKED_ROOMS: readonly string[] = ["dhi", "blog", "hour", "modules"];
