// What the weekly parent page holds (spec house/0022), as a pure function of the student's own daily values. No database and no clock. The page is
// the whole of what a parent can see, so it is built here from a short list of allowed fields and nothing else: the last 7 finished days, how many of
// them the student logged something in each room (a count, never a value), and the three growth lamps from 0 to 100. It never holds a mood value, a
// note, a pattern, the support offer, a sleep or meal detail, a rank or a comparison. The words are the screen's.
import { CHAIN_DAYS, MIN_LOGGED_DAYS } from "./brainCodes";
import { coverageIn, dayMapOf, lampsOf, loggedDaysIn, windowDays } from "./brainRules";
import type { DayRow } from "./metricRules";

export const WEEK_DAYS = 7;

export type ParentWeek = {
  from: string; // first and last of the 7 finished days, as house day keys
  to: string;
  enough: boolean; // the student logged on at least MIN_LOGGED_DAYS of the last 14 days; until then the lamps are empty, as in the student's own Brain
  rooms: { room: string; days: number }[];
  lamps: { lamp: string; value: number | null }[];
};

export function weekOf(rows: readonly DayRow[], today: string): ParentWeek {
  const week = windowDays(today, WEEK_DAYS);
  const enough = loggedDaysIn(dayMapOf(rows), windowDays(today, CHAIN_DAYS)) >= MIN_LOGGED_DAYS;
  return {
    from: week[0],
    to: week[week.length - 1],
    enough,
    rooms: coverageIn(rows, today, WEEK_DAYS).map(({ room, days }) => ({ room, days })),
    lamps: lampsOf(rows, today).lamps.map((l) => ({ lamp: l.lamp, value: enough && l.value !== null ? Math.round(l.value * 100) : null })),
  };
}
