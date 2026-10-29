import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Clock, Heart, Sparkles } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { dayBounds, shiftDay, todayOf } from "@dhi/backend/dayRules";
import { isMood } from "@dhi/backend/moodRules";
import {
  MONTHS,
  MOODS,
  daysInMonth,
  inkOn,
  moodOf,
  prettyDate,
  type MoodKey,
} from "@/lib/dhi/mood-demo";
import {
  GUNA_WORDS,
  MOOD_WORDS_APPROVED,
  dhiLine,
  gunaOf,
  moodRefusal,
} from "@/lib/dhi/mood-words";
import { Notice } from "@/components/dhi/ui/notice";
import { counselRefusal } from "@/lib/dhi/counsel-words";
import type { GenericId } from "convex/values";
import { Sheet } from "@/components/dhi/sheet";
import { useTouch } from "@/lib/use-touch";
import { cn } from "@/lib/utils";

const glass = "rounded-card border border-white/80 bg-white/70 shadow-sm backdrop-blur-xl";

type DayCell = { mood: MoodKey; note: string; lineIx: number };

// The mood room (spec house/0006). The days are the student's own, read from the server; saving writes today's entry there. The help button opens
// the Counseling room (spec house/0024) through `onCounsel`.
export function MoodTracker({ onCounsel }: { onCounsel?: () => void } = {}) {
  const [scope, setScope] = useState<"week" | "month">("week");
  const [pick, setPick] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodKey>("content");
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fail, setFail] = useState("");
  const [dayChanged, setDayChanged] = useState(false);
  const [confirmHelp, setConfirmHelp] = useState(false);
  const [helpDesk, setHelpDesk] = useState(false);
  const [booked, setBooked] = useState(false);
  // The day the screen shows as today comes from the shared day rule on the device clock, and moves on at the next 04:00. The save result carries
  // the server's day, which wins.
  const [today, setToday] = useState(() => todayOf(Date.now()));
  const [month, setMonth] = useState(() => Number(todayOf(Date.now()).slice(5, 7)) - 1);
  const touch = useTouch();
  const board = useRef<HTMLDivElement>(null);
  const saveMood = useMutation(api.moods.save);
  // What is on the form right now, so a save that returns can tell whether the student kept typing while it was in flight.
  const form = useRef({ mood, note });
  form.current = { mood, note };

  const year = Number(today.slice(0, 4));
  const monthKey = (m: number) => `${year}-${String(m + 1).padStart(2, "0")}`;
  const currentRows = useQuery(api.moods.month, { month: today.slice(0, 7) });
  const viewRows = useQuery(api.moods.month, { month: monthKey(month) });
  const yearRows = useQuery(api.moods.year, { year: String(year) });

  useEffect(() => {
    const t = window.setTimeout(
      () => setToday(todayOf(Date.now())),
      Math.max(1000, dayBounds(today).end - Date.now()) + 50,
    );
    return () => window.clearTimeout(t);
  }, [today]);

  const asCell = (r: { mood: string; note: string; lineIx: number }): DayCell | null =>
    isMood(r.mood) ? { mood: r.mood, note: r.note, lineIx: r.lineIx } : null;
  const todayEntry = useMemo(() => {
    const row = currentRows?.find((r) => r.day === today);
    return row ? asCell(row) : null;
  }, [currentRows, today]);
  const viewDays = useMemo(() => {
    const days: Record<string, DayCell> = {};
    for (const r of viewRows ?? []) {
      const cell = asCell(r);
      if (cell) days[r.day] = cell;
    }
    return days;
  }, [viewRows]);
  const yearMoods = useMemo(() => {
    const days: Record<string, MoodKey> = {};
    for (const r of yearRows ?? []) if (isMood(r.mood)) days[r.day] = r.mood;
    return days;
  }, [yearRows]);

  // The form follows the saved entry (from this tab or another) while the student has not started changing it, and starts fresh on a new day.
  // When the day moves on (the 04:00 timer, or the server's day winning), say so, keep any half written line (it now belongs to the new day) and
  // show the month of the new day.
  const shownDay = useRef(today);
  useEffect(() => {
    if (shownDay.current === today) return;
    shownDay.current = today;
    setDayChanged(true);
    setFail("");
    setMonth(Number(today.slice(5, 7)) - 1);
  }, [today]);
  useEffect(() => {
    if (dirty) return;
    setMood(todayEntry?.mood ?? "content");
    setNote(todayEntry?.note ?? "");
  }, [todayEntry, dirty, today]);

  const pie = useMemo(() => {
    const from = scope === "week" ? shiftDay(today, -6) : `${today.slice(0, 7)}-01`;
    const counts = Object.fromEntries(MOODS.map((m) => [m.key, 0])) as Record<MoodKey, number>;
    let n = 0;
    for (const [day, key] of Object.entries(yearMoods)) {
      if (day < from || day > today) continue;
      counts[key] += 1;
      n += 1;
    }
    const slices = MOODS.map((m) => ({
      key: m.key,
      label: m.label,
      color: m.color,
      value: counts[m.key],
      pct: n ? Math.round((counts[m.key] / n) * 100) : 0,
    })).filter((x) => x.value > 0);
    return { slices, n };
  }, [yearMoods, scope, today]);

  const selected = pick ? (viewDays[pick] ?? null) : null;

  async function saveToday() {
    setSaving(true);
    setFail("");
    const sent = { mood, note };
    try {
      const r = await saveMood(sent);
      if (!r.ok) {
        setFail(moodRefusal(r.code));
      } else {
        // Only a form that still holds what was sent is clean; anything typed while the save was in flight stays.
        if (form.current.mood === sent.mood && form.current.note === sent.note) setDirty(false);
        if (r.day !== today) {
          // The server's day wins over a device clock that is off.
          setToday(r.day);
        } else {
          setDayChanged(false);
        }
      }
    } catch (e) {
      setFail(moodRefusal(e));
    }
    setSaving(false);
  }

  return (
    <div className="relative flex min-h-0 flex-col gap-4 pb-4">
      <div className="grid items-stretch gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <article className={cn(glass, "flex flex-col p-4 sm:p-6")}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-2xl">Today’s colour</h3>
              <p className="text-xs text-mute">{prettyDate(today)}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-5 gap-2">
            {MOODS.map((m) => {
              const on = mood === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    setMood(m.key);
                    setDirty(true);
                  }}
                  className={cn(
                    "group flex h-[4.6rem] flex-col items-center justify-center gap-1 rounded-control border text-[11px] touch:text-xs transition duration-200 hover:-translate-y-1 hover:shadow-md",
                    inkOn(m.color).hover,
                    on
                      ? `border-transparent shadow-md ${inkOn(m.color).ink}`
                      : "border-white/80 bg-white text-home",
                  )}
                  style={{ backgroundColor: on ? m.color : undefined }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = m.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = on ? m.color : "";
                  }}
                >
                  <span className="text-lg leading-none transition duration-200 group-hover:-translate-y-0.5">
                    {m.glyph}
                  </span>
                  <span className="font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
          <label className="mt-6 block">
            <span className="font-display text-lg">A line for the house</span>
            <p className="mt-0.5 text-xs text-mute">Not a diary. One true sentence is enough.</p>
            <textarea
              value={note}
              onChange={(e) => {
                // 500 characters as the server counts them (code points), so an emoji counts once.
                const chars = [...e.target.value];
                setNote(chars.length > 500 ? chars.slice(0, 500).join("") : e.target.value);
                setDirty(true);
              }}
              data-testid="mood-note"
              rows={5}
              placeholder="What sat in the chest today…"
              className="mt-3 min-h-32 w-full resize-none rounded-card border border-white bg-white/90 p-4 text-base leading-relaxed text-home outline-none placeholder:text-mute/70"
            />
          </label>
          <p className="mt-1 text-right text-xs text-mute">{[...note].length} of 500</p>
          {fail && (
            <Notice
              tone="danger"
              role="alert"
              data-testid="mood-error"
              className="mt-3 px-4 py-3 text-sm"
            >
              {fail}
            </Notice>
          )}
          {dayChanged && (
            <Notice role="status" data-testid="mood-day-changed" className="mt-3 px-4 py-3 text-sm">
              The day moved on, so this colours the new day.
            </Notice>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveToday}
              disabled={saving || currentRows === undefined || (todayEntry !== null && !dirty)}
              data-testid="mood-save"
              className="h-12 rounded-full bg-grove px-7 text-sm font-medium text-paper disabled:opacity-50"
            >
              {saving
                ? "Saving…"
                : currentRows === undefined
                  ? "Loading…"
                  : todayEntry
                    ? dirty
                      ? "Change today"
                      : "Saved for today"
                    : "Colour today"}
            </button>
            {todayEntry && !dirty && (
              <span className="text-xs text-mute touch:text-sm" data-testid="mood-saved">
                Your colour for today is saved. You can change it until the day ends.
              </span>
            )}
          </div>
          {todayEntry && !dirty && (
            <div className="mt-4 rounded-card bg-white/70 p-4 text-sm" data-testid="mood-guna">
              <p className="font-medium">{GUNA_WORDS[gunaOf(todayEntry.mood)].line}</p>
              <p className="mt-1 text-mute">{GUNA_WORDS[gunaOf(todayEntry.mood)].tip}</p>
              <p className="mt-2 text-mute">{dhiLine(todayEntry.mood, todayEntry.lineIx)}</p>
              {!MOOD_WORDS_APPROVED && (
                <p className="mt-2 text-xs text-mute touch:text-sm" data-testid="mood-draft">
                  Draft words. The guna lines and tips are not approved yet.
                </p>
              )}
            </div>
          )}
        </article>

        <article className={cn(glass, "flex flex-col p-4 sm:p-6")}>
          <div className="flex items-center justify-between">
            <h3 className="font-display text-2xl">How the mind sat</h3>
            <div className="flex rounded-full bg-white p-1 text-xs">
              {(["week", "month"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={cn(
                    "rounded-full px-3 py-1.5 capitalize touch:min-h-11 touch:px-4",
                    scope === s && "bg-home text-paper",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-1 flex-col items-center justify-center">
            {/* The ring repeats the list below it, which a screen reader reads, so the drawing itself is hidden from it (WCAG 1.1.1). */}
            <div className="h-48 w-48" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart accessibilityLayer={false}>
                  <Pie
                    rootTabIndex={-1}
                    data={
                      pie.slices.length
                        ? pie.slices
                        : [{ key: "empty", value: 1, color: "var(--color-sand-deep)" }]
                    }
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={78}
                    paddingAngle={pie.slices.length > 1 ? 3 : 0}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {(pie.slices.length ? pie.slices : [{ color: "var(--color-sand-deep)" }]).map(
                      (s, i) => (
                        <Cell key={i} fill={s.color} />
                      ),
                    )}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {pie.slices.length === 0 && (
              <p className="mt-3 text-center text-sm text-mute" data-testid="mood-ring-empty">
                No colour in this {scope} yet. Colour today and it shows here.
              </p>
            )}
            <ul className="mt-3 grid w-full grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {pie.slices.map((s) => (
                <li key={s.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 truncate">
                    <span className="size-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="tabular-nums text-mute">{s.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </div>

      <article className={cn(glass, "p-3 sm:p-6")}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="font-display text-2xl">Year in colour</h3>
            <p className="text-sm text-mute">
              This month is the sitting. The year is the river behind it. Tap a filled lamp.
            </p>
          </div>
          <p className="text-xs text-mute">{year}</p>
        </div>
        <div ref={board} className="scroll-mt-16">
          <MonthBoard year={year} month={month} days={viewDays} today={today} onPick={setPick} />
        </div>
        <div className="mt-8">
          <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">
            The year
          </p>
          <div className="space-y-2">
            {MONTHS.map((name, mi) => {
              const dim = daysInMonth(year, mi);
              const isNow = mi === Number(today.slice(5, 7)) - 1;
              const label = (
                <span
                  className={cn(
                    "w-20 shrink-0 text-xs",
                    isNow ? "font-medium text-home" : "text-mute",
                  )}
                >
                  {name}
                </span>
              );
              // On touch the 18 pixel dots are only a picture. The whole row is one 44 pixel button
              // that opens the month in the calendar above, so every past day stays reachable.
              if (touch) {
                return (
                  <button
                    key={name}
                    type="button"
                    aria-pressed={mi === month}
                    aria-label={`Open ${name}`}
                    onClick={() => {
                      setMonth(mi);
                      board.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-control px-2 py-2 text-left",
                      mi === month && "bg-white/80",
                    )}
                  >
                    {label}
                    <span aria-hidden className="flex flex-wrap gap-1">
                      {Array.from({ length: dim }, (_, di) => {
                        const key = `${year}-${String(mi + 1).padStart(2, "0")}-${String(di + 1).padStart(2, "0")}`;
                        const cell = yearMoods[key];
                        return (
                          <span
                            key={di}
                            className="size-[18px] rounded-md"
                            style={{
                              backgroundColor: cell ? moodOf(cell).color : "var(--color-sand)",
                            }}
                          />
                        );
                      })}
                    </span>
                  </button>
                );
              }
              return (
                <div key={name} className="flex items-center gap-3">
                  {label}
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: dim }, (_, di) => {
                      const day = di + 1;
                      const key = `${year}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const cell = yearMoods[key];
                      const future = key > today;
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={future || !cell}
                          onClick={() => {
                            if (!cell) return;
                            setMonth(mi);
                            setPick(key);
                          }}
                          title={cell ? `${key} · ${moodOf(cell).label}` : key}
                          className="size-[18px] rounded-md disabled:cursor-default"
                          style={{
                            backgroundColor: cell ? moodOf(cell).color : "var(--color-sand)",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </article>

      {pick && selected && (
        <DaySlide
          date={pick}
          mood={selected.mood}
          note={selected.note}
          thought={dhiLine(selected.mood, selected.lineIx)}
          guna={GUNA_WORDS[gunaOf(selected.mood)]}
          onClose={() => setPick(null)}
          onHelp={() => {
            setPick(null);
            setConfirmHelp(true);
          }}
        />
      )}

      {confirmHelp && (
        <Modal title="Sit with a counselor?" onClose={() => setConfirmHelp(false)}>
          <p className="text-sm text-mute">
            In-house, human. A counselor from the DHI team talks with you in a video call inside the
            house, and the call is recorded. They see your first name, class, school and the note
            you write, never your moods and never a diagnosis.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmHelp(false)}
              className="h-11 rounded-control bg-white px-4 text-sm"
            >
              Not now
            </button>
            <button
              type="button"
              data-testid="mood-to-counsel"
              onClick={() => {
                setConfirmHelp(false);
                setHelpDesk(true);
              }}
              className="h-11 rounded-control bg-home px-4 text-sm text-paper"
            >
              Yes, write to them
            </button>
          </div>
        </Modal>
      )}

      {helpDesk && (
        <HelpDesk
          onClose={() => setHelpDesk(false)}
          onBooked={() => {
            setHelpDesk(false);
            setBooked(true);
          }}
        />
      )}

      {booked && (
        <Modal title="The door is open" onClose={() => setBooked(false)}>
          <p className="text-sm text-mute">
            Your time is held and your words went to the counselor. You join the call from
            Counseling when it starts.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setBooked(false)}
              className="h-11 rounded-control bg-white px-4 text-sm"
            >
              Stay in the house
            </button>
            <button
              type="button"
              onClick={() => {
                setBooked(false);
                onCounsel?.();
              }}
              className="h-11 rounded-control bg-home px-4 text-sm text-paper"
            >
              Open Counseling
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MonthBoard({
  year,
  month,
  days,
  today,
  onPick,
}: {
  year: number;
  month: number;
  days: Record<string, { mood: MoodKey }>;
  today: string;
  onPick: (key: string) => void;
}) {
  const dim = daysInMonth(year, month);
  const start = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(start).fill(null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div>
      <p className="mb-3 font-display text-lg">
        {MONTHS[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-x-0.5 gap-y-1 text-center text-[11px] text-mute touch:text-xs sm:gap-2">
        {names.map((n) => (
          <span key={n}>{n}</span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const cell = days[key];
          const future = key > today;
          const isToday = key === today;
          return (
            <button
              key={key}
              type="button"
              data-day-cell
              disabled={future || !cell}
              onClick={() => cell && onPick(key)}
              className={cn(
                "grid h-11 place-items-center rounded-control text-xs sm:aspect-square sm:h-auto",
                isToday && "ring-2 ring-gold",
                !cell && "bg-sand text-mute",
                cell && inkOn(moodOf(cell.mood).color).ink,
              )}
              style={{ backgroundColor: cell ? moodOf(cell.mood).color : undefined }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DaySlide({
  date,
  mood,
  note,
  thought,
  guna,
  onClose,
  onHelp,
}: {
  date: string;
  mood: MoodKey;
  note: string;
  thought: string;
  guna: { line: string; tip: string };
  onClose: () => void;
  onHelp: () => void;
}) {
  const m = moodOf(mood);
  return (
    <Sheet
      open
      onOpenChange={(open) => !open && onClose()}
      side="right"
      tone="photo"
      title={prettyDate(date)}
      backdrop={
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-[center_40%]"
            style={{ backgroundImage: "url(/mood/thought.jpg)" }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-gold-ink/80 via-gold-ink/25 to-transparent" />
        </>
      }
    >
      <div className="inline-flex flex-col gap-2">
        <p className="w-fit rounded-full border border-white/35 bg-gold-ink/55 px-3 py-1 text-[11px] tracking-[0.14em] text-paper backdrop-blur-md touch:text-xs">
          {prettyDate(date)}
        </p>
        <p className="font-display text-4xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
          {m.glyph} {m.label}
        </p>
      </div>
      <div className="mt-auto space-y-3 pb-2 pt-16">
        <div className="rounded-card border border-white/25 bg-white/15 p-5 backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.16em] text-paper/70 touch:text-xs">
            What you wrote
          </p>
          <p className="font-display mt-2 text-2xl leading-snug">
            {note || "This day was coloured, but no line was left."}
          </p>
        </div>
        <div className="rounded-card border border-white/25 bg-white/15 p-5 backdrop-blur-xl">
          <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-paper/70 touch:text-xs">
            <Sparkles className="size-3" aria-hidden /> DHI thought
          </p>
          <p className="mt-2 text-sm leading-relaxed text-paper/90">{thought}</p>
          <p className="mt-3 text-sm leading-relaxed text-paper/80">{guna.line}</p>
          <p className="mt-1 text-sm leading-relaxed text-paper/80">{guna.tip}</p>
        </div>
        <button
          type="button"
          onClick={onHelp}
          className="lamp-glow flex h-12 w-full items-center justify-center gap-2 rounded-full bg-paper text-sm font-medium text-home"
        >
          <Heart className="size-4" aria-hidden /> Ask DHI for a sitting
        </button>
      </div>
    </Sheet>
  );
}

function Modal({
  children,
  onClose,
  title,
}: {
  children: ReactNode;
  onClose: () => void;
  title: string;
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} side="bottom" title={title}>
      {children}
    </Sheet>
  );
}

// Writing to a counselor from the mood room (the house mockup's help desk), on the real counseling slots (house spec 0024): a note, then an open time
// in the next days. The booking is the same one the Counseling room makes; the counselor sees the first name, class, school and the note only.
function HelpDesk({ onClose, onBooked }: { onClose: () => void; onBooked: () => void }) {
  const [now] = useState(() => Date.now());
  const free = useQuery(api.counsel.freeSlots, { now });
  const book = useMutation(api.counsel.book);
  const [note, setNote] = useState("");
  const [day, setDay] = useState("");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dayOfSlot = (ms: number) =>
    new Date(ms).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const days = [...new Set((free ?? []).map((s) => dayOfSlot(s.startsAt)))];
  const shownDay = day || days[0] || "";
  const ofDay = (free ?? []).filter((s) => dayOfSlot(s.startsAt) === shownDay);

  async function send() {
    if (!slotId) return;
    setBusy(true);
    setError("");
    try {
      const r = await book({ slotId: slotId as GenericId<"counselSlots">, note });
      if (r.ok) onBooked();
      else setError(counselRefusal(r.code));
    } catch (e) {
      setError(counselRefusal(e));
    }
    setBusy(false);
  }

  return (
    <Modal title="Write to a counselor" onClose={onClose}>
      <p className="text-xs text-mute">
        A human sitting. Pick an open time and leave a line if you want them to know something
        first.
      </p>
      <textarea
        value={note}
        maxLength={300}
        onChange={(e) => setNote(e.target.value)}
        rows={4}
        placeholder="What do you need them to know before the sitting?"
        aria-label="A note for the counselor"
        className="mt-4 w-full resize-none rounded-control bg-white p-3 text-sm outline-none focus-visible:focus-ring"
      />
      <p className="mt-4 text-[11px] uppercase tracking-wide text-mute touch:text-xs">Open times</p>
      <div className="min-h-[7.5rem]">
        {free === undefined ? (
          <p className="mt-2 text-sm text-mute">Loading…</p>
        ) : free.length === 0 ? (
          <p className="mt-2 text-sm text-mute">
            No open times in the next days. Counseling shows new times as soon as a counselor opens
            them.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={shownDay === d}
                  onClick={() => {
                    setDay(d);
                    setSlotId(null);
                  }}
                  className={cn(
                    "h-9 rounded-full px-3 text-xs touch:h-11",
                    shownDay === d ? "bg-home text-paper" : "bg-white",
                  )}
                >
                  {new Date(`${d}T12:00:00+05:30`).toLocaleDateString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ofDay.map((s) => (
                <button
                  key={s.slotId}
                  type="button"
                  aria-pressed={slotId === s.slotId}
                  onClick={() => setSlotId(slotId === s.slotId ? null : s.slotId)}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center rounded-control text-xs",
                    slotId === s.slotId ? "bg-grove text-paper" : "bg-white",
                  )}
                >
                  <Clock className="mb-0.5 size-3" aria-hidden />
                  {new Date(s.startsAt).toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                  <span className="opacity-80">{s.counselor}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {error && (
        <Notice tone="danger" role="alert" className="mt-3 px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      <button
        type="button"
        disabled={!slotId || busy}
        onClick={() => void send()}
        className="mt-5 h-11 w-full rounded-control bg-home text-sm font-medium text-paper disabled:opacity-40"
        data-testid="mood-help-send"
      >
        {busy ? "Sending…" : "Send to the counselor desk"}
      </button>
    </Modal>
  );
}
