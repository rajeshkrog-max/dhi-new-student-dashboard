// The pure rules of the sleep room (spec house/0008): the limits of a night, the clock conversions and the read back (the usual bedtime and the
// average length). No database and no clock, and no imports. Exported from the package as `@dhi/backend/sleepRules`, so the screen and the server
// read the same rules.
//
// `bedMin` is whole minutes after 12:00 noon India time, 0 to 1439, so 23:00 is 660 and 00:30 is 750. Noon is the edge because a night never
// crosses it, so a bed time after midnight still sorts after one before it. The wake time is never stored: it is (bedMin + lengthMin) on the same
// scale. Any change of this scale is a new event version.

export const STEP_MIN = 15;
export const MAX_BED_MIN = 1439;
export const MIN_LENGTH_MIN = 60;
export const MAX_LENGTH_MIN = 960;
export const MAX_SLEEP_CHANGES = 10;
export const RECENT_NIGHTS = 30;
export const READ_BACK_NIGHTS = 14;
export const MIN_NIGHTS_FOR_READ_BACK = 3;
export const DEFAULT_BED_MIN = 660; // 23:00
export const DEFAULT_LENGTH_MIN = 450; // 7 h 30 min, so the wake time is 06:30

// A whole number on the 15 minute grid. `-0` passes (it equals 0); the caller stores `value + 0` so `-0` is never kept.
const onGrid = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value % STEP_MIN === 0;

export const isBedMin = (value: unknown): value is number => onGrid(value) && value >= 0 && value <= MAX_BED_MIN;
export const isLengthMin = (value: unknown): value is number => onGrid(value) && value >= MIN_LENGTH_MIN && value <= MAX_LENGTH_MIN;

// Clock minute of the day (0 to 1439, from midnight) to the noon shifted scale, and back.
export const clockToBedMin = (clock: number): number => (((clock - 720) % 1440) + 1440) % 1440;
export const bedMinToClock = (bedMin: number): number => (bedMin + 720) % 1440;

// The wake clock minute of a night.
export const wakeClockOf = (bedMin: number, lengthMin: number): number => (bedMin + lengthMin + 720) % 1440;

// `HH:MM`, 24 hour, from a clock minute of the day.
export function clockText(clock: number): string {
  const h = Math.floor(clock / 60);
  const m = clock % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// The usual bedtime: the median `bedMin` of the newest nights (at most 14 of the given rows). An even count takes the lower middle value, so the
// result is always a real logged bed time on the 15 minute grid. Null below three nights.
export function usualBedMin(nights: readonly { bedMin: number }[]): number | null {
  const sample = nights.slice(0, READ_BACK_NIGHTS).map((n) => n.bedMin);
  if (sample.length < MIN_NIGHTS_FOR_READ_BACK) return null;
  const sorted = [...sample].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)];
}

// The average length: the mean of the same nights, rounded to the nearest minute. Null below three nights.
export function averageLengthMin(nights: readonly { lengthMin: number }[]): number | null {
  const sample = nights.slice(0, READ_BACK_NIGHTS).map((n) => n.lengthMin);
  if (sample.length < MIN_NIGHTS_FOR_READ_BACK) return null;
  return Math.round(sample.reduce((sum, n) => sum + n, 0) / sample.length);
}
