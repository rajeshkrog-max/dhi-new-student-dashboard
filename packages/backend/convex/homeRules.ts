// The pure rules of the DHI score (spec house/0017). No database and no clock, and no imports. The score is a growth mark over the student's own
// last 28 days, never a rank and never compared with another student. It is built from three lamps, each worth one third (the owner's Vedic
// mapping, 2026-10-20): Sadhana (effort and practice: exams sat before the window closes, and study time in an open hour), Niyam (rhythm and
// discipline: days with a habit tick) and Viveka (reflection and understanding: modules kept). Mood and meal logs count as presence only and are
// not in the score. An input with nothing to measure yet is null, and a null is left out, so a missing room never lowers the score.

export const WINDOW_DAYS = 28;
export const LAMPS = ["sadhana", "niyam", "viveka"] as const;
export type Lamp = (typeof LAMPS)[number];

// A ratio from 0 to 1, or null when there is nothing to measure.
export const ratio = (part: number, whole: number): number | null => (whole > 0 ? Math.min(1, Math.max(0, part / whole)) : null);

// A lamp is the mean of its inputs that are not null, or null when none are.
export function lampValue(inputs: readonly (number | null)[]): number | null {
  const present = inputs.filter((x): x is number => x !== null);
  return present.length === 0 ? null : present.reduce((sum, x) => sum + x, 0) / present.length;
}

// The score, 0 to 100: the mean of the lamps that are not null, or null when every lamp is null.
export function scoreOf(lamps: Record<Lamp, number | null>): number | null {
  const present = LAMPS.map((l) => lamps[l]).filter((x): x is number => x !== null);
  return present.length === 0 ? null : Math.round((present.reduce((sum, x) => sum + x, 0) / present.length) * 100);
}
