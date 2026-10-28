// The fixed codes of the Brain report that the server and the screen both name (spec house/0020): the patterns, the things listed on a day, the rooms
// those open, the lamps and their movement. No imports, so the house screens and their tests can read it as `@dhi/backend/brainCodes`; the server rules
// (brainRules.ts) build on it. A code is added here first, and the screen's words (src/lib/dhi/brain-words.ts) must then have a line for it: the
// screen's copy test fails if one is missing.

export const PATTERN_IDS = ["mood_habits_quiet", "steady_rhythm", "packaged_quiet"] as const;
export type PatternId = (typeof PATTERN_IDS)[number];

// The connections (house spec 0023): cross room patterns tested on a fixed list of pairs over all of a student's days, named by what they compare.
// `topic_desk_papers` (P4) and `subject_feeling` (P6) came with the topic and subject tags (house spec 0028); `subject_feeling` also sends its subject.
export const CONNECTION_IDS = ["sleep_papers", "breakfast_focus", "bedtime_mood", "late_room_feeling", "topic_desk_papers", "subject_feeling"] as const;
export type ConnectionId = (typeof CONNECTION_IDS)[number];
// The most days the connections read, ending yesterday: about four months.
export const CONNECTION_WINDOW = 120;

export const EVIDENCE_ITEMS = ["low_mood", "habit_not_ticked", "habit_ticked", "hour_not_sat", "hour_sat", "paper_missed", "paper_sat", "packaged_heavy", "post_published"] as const;
export type EvidenceItem = (typeof EVIDENCE_ITEMS)[number];

// The ids the house menu uses for the rooms the report can open.
export const ROOM_IDS = ["mood", "habits", "hour", "papers", "day", "sleep", "modules", "blog"] as const;
export type RoomId = (typeof ROOM_IDS)[number];

export const LAMP_IDS = ["sadhana", "niyam", "viveka"] as const;
export type LampId = (typeof LAMP_IDS)[number];

export const MOVEMENTS = ["rising", "steady", "dipping"] as const;
export type Movement = (typeof MOVEMENTS)[number];

// "Does not feel true" hides a pattern for this many days; the screen says the same number.
export const HIDE_DAYS = 30;
// The finished days a chain reads, and the days with something logged it needs before it says anything.
export const CHAIN_DAYS = 14;
export const MIN_LOGGED_DAYS = 5;
