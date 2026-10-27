// The pure rules of the school report (house spec 0025; the owner's answers of 2026-10-27). Built only from papers sent to one class: never the
// Brain, the desk or a wellbeing room. No imports and no clock: the caller passes the rows, each with its due day already worked out. A number is
// a class total, never a student's; the one named part is the academic support list, which carries reasons and never a score or an order by need.

export const MIN_STUDENTS = 5; // a subject, topic or week cell shows its share only when this many students tried it
export const RANGE_DAYS_MAX = 91; // a report covers at most 13 weeks
export const BAND_MID = 50; // under 50% is peach
export const BAND_HIGH = 65; // 50 to 64 is gold, 65 and up is mint
export const CR1_BELOW = 50; // CR1: a topic under this share over the last weeks
export const CR1_GAIN = 5; // and less than this many points better from the first of those weeks to the last
export const CR1_WEEKS = 3;

export type Band = "low" | "mid" | "high";
export type Reason = "missed_in_a_row" | "accuracy_down";
export type Question = { order: number; kind: string; subject: string; topic: string; rightOption?: number };
export type Attempt = {
  memberId: string;
  paperId: string;
  day: string; // the India day of the due time, "YYYY-MM-DD"
  dueAt: number;
  closed: boolean; // the due time has passed
  status: string;
  missed: boolean;
  excused: boolean;
  answers: { question: number; choice?: number }[];
};
export type Share = { students: number; pct: number | null };
export type Report = {
  papers: number;
  closed: number;
  sat: number;
  missed: number;
  excused: number;
  weeks: string[];
  subjects: (Share & { subject: string; change: number | null })[];
  topics: (Share & { subject: string; topic: string; cells: (Share & { week: string; band: Band | null })[] })[];
  actions: { kind: "reteach"; subject: string; topic: string; pct: number; gain: number }[];
  support: { memberId: string; reasons: Reason[] }[];
};

export const bandOf = (pct: number): Band => (pct < BAND_MID ? "low" : pct < BAND_HIGH ? "mid" : "high");

// The Monday of the week a day key falls in, as a day key.
export function weekOf(day: string): string {
  const t = Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)));
  const back = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - back * 86_400_000).toISOString().slice(0, 10);
}

// The days of a range, inclusive, or null when it is not a range the report takes.
export function rangeProblem(fromDay: string, toDay: string): "bad_range" | "too_long" | null {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return "bad_range";
  if ((to - from) / 86_400_000 + 1 > RANGE_DAYS_MAX) return "too_long";
  return null;
}

type Tally = { students: Set<string>; tried: number; right: number };
const tally = (): Tally => ({ students: new Set(), tried: 0, right: 0 });
const shareOf = (t: Tally | undefined): Share => {
  const students = t?.students.size ?? 0;
  return { students, pct: t && students >= MIN_STUDENTS && t.tried > 0 ? Math.round((100 * t.right) / t.tried) : null };
};
const handedIn = (a: Attempt) => a.status !== "assigned" && !a.missed && !a.excused;

export function reportOf(attempts: Attempt[], questions: Map<string, Question[]>): Report {
  const closed = attempts.filter((a) => a.closed && a.status !== "assigned");
  const weeks = [...new Set(attempts.map((a) => weekOf(a.day)))].sort();

  const bySubject = new Map<string, Tally>();
  const bySubjectWeek = new Map<string, Tally>();
  const byTopic = new Map<string, { subject: string; topic: string; all: Tally; weeks: Map<string, Tally> }>();
  const byStudentWeek = new Map<string, Map<string, { tried: number; right: number }>>();
  const add = <K>(map: Map<K, Tally>, key: K, who: string, right: boolean) => {
    const t = map.get(key) ?? tally();
    t.students.add(who);
    t.tried += 1;
    if (right) t.right += 1;
    map.set(key, t);
  };

  for (const a of attempts) {
    if (!handedIn(a)) continue;
    const week = weekOf(a.day);
    const qs = questions.get(a.paperId) ?? [];
    for (const ans of a.answers) {
      const q = qs.find((x) => x.order === ans.question);
      if (!q || q.kind !== "mcq" || ans.choice === undefined) continue;
      const right = ans.choice === q.rightOption;
      add(bySubject, q.subject, a.memberId, right);
      add(bySubjectWeek, `${q.subject}\u0000${week}`, a.memberId, right);
      const key = `${q.subject}\u0000${q.topic}`;
      const topic = byTopic.get(key) ?? { subject: q.subject, topic: q.topic, all: tally(), weeks: new Map<string, Tally>() };
      topic.all.students.add(a.memberId);
      topic.all.tried += 1;
      if (right) topic.all.right += 1;
      add(topic.weeks, week, a.memberId, right);
      byTopic.set(key, topic);
      const mine = byStudentWeek.get(a.memberId) ?? new Map<string, { tried: number; right: number }>();
      const cell = mine.get(week) ?? { tried: 0, right: 0 };
      cell.tried += 1;
      if (right) cell.right += 1;
      mine.set(week, cell);
      byStudentWeek.set(a.memberId, mine);
    }
  }

  const subjects = [...bySubject.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([subject, t]) => {
      const shown = weeks.map((w) => shareOf(bySubjectWeek.get(`${subject}\u0000${w}`)).pct).filter((p): p is number => p !== null);
      return { subject, ...shareOf(t), change: shown.length >= 2 ? shown[shown.length - 1] - shown[0] : null };
    });

  const topics = [...byTopic.values()]
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic))
    .map((t) => ({
      subject: t.subject,
      topic: t.topic,
      ...shareOf(t.all),
      cells: weeks.map((week) => {
        const s = shareOf(t.weeks.get(week));
        return { week, ...s, band: s.pct === null ? null : bandOf(s.pct) };
      }),
    }));

  // CR1: over the last CR1_WEEKS weeks of the range, a topic whose class share is under CR1_BELOW and rose less than CR1_GAIN points from the first
  // shown week to the last. Needs two shown weeks and enough students over the whole stretch.
  const last = weeks.slice(-CR1_WEEKS);
  const actions: Report["actions"] = [];
  for (const t of byTopic.values()) {
    const pooled = tally();
    const shown: number[] = [];
    for (const w of last) {
      const cell = t.weeks.get(w);
      if (!cell) continue;
      for (const s of cell.students) pooled.students.add(s);
      pooled.tried += cell.tried;
      pooled.right += cell.right;
      const p = shareOf(cell).pct;
      if (p !== null) shown.push(p);
    }
    const pct = shareOf(pooled).pct;
    if (pct === null || shown.length < 2) continue;
    const gain = shown[shown.length - 1] - shown[0];
    if (pct < CR1_BELOW && gain < CR1_GAIN) actions.push({ kind: "reteach", subject: t.subject, topic: t.topic, pct, gain });
  }
  actions.sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic));

  // The academic support list (owner, 2026-10-27): paper reasons only. Two closed papers in a row missed (an excused one is skipped), or the
  // student's own multiple choice share lower than the week before, two weeks running (three weeks in a row that each have answers).
  const support: Report["support"] = [];
  const students = [...new Set(attempts.map((a) => a.memberId))];
  for (const id of students) {
    const reasons: Reason[] = [];
    const mine = closed.filter((a) => a.memberId === id && !a.excused).sort((a, b) => a.dueAt - b.dueAt);
    if (mine.some((a, i) => i > 0 && a.missed && mine[i - 1].missed)) reasons.push("missed_in_a_row");
    const cells = byStudentWeek.get(id);
    if (cells) {
      const share = (w: string) => {
        const c = cells.get(w);
        return c && c.tried > 0 ? c.right / c.tried : null;
      };
      for (let i = 2; i < weeks.length; i += 1) {
        const [a, b, c] = [share(weeks[i - 2]), share(weeks[i - 1]), share(weeks[i])];
        const consecutive = Date.parse(weeks[i]) - Date.parse(weeks[i - 2]) === 14 * 86_400_000;
        if (consecutive && a !== null && b !== null && c !== null && b < a && c < b) {
          reasons.push("accuracy_down");
          break;
        }
      }
    }
    if (reasons.length > 0) support.push({ memberId: id, reasons });
  }

  return {
    papers: new Set(attempts.map((a) => a.paperId)).size,
    closed: closed.length,
    sat: closed.filter(handedIn).length,
    missed: closed.filter((a) => a.missed && !a.excused).length,
    excused: closed.filter((a) => a.excused).length,
    weeks,
    subjects,
    topics,
    actions,
    support,
  };
}
