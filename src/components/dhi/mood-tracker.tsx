import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Clock, Heart, Sparkles } from "lucide-react";
import {
  COUNSELOR,
  MONTHS,
  MOODS,
  daysInMonth,
  loadMood,
  logDay,
  moodOf,
  openSlots,
  prettyDate,
  rangeCounts,
  sendHelp,
  todayKey,
  type CounselSlot,
  type MoodDay,
  type MoodKey,
  type MoodStore,
} from "@/lib/dhi/mood-demo";
import { Sheet } from "@/components/dhi/sheet";
import { useTouch } from "@/lib/use-touch";
import { cn } from "@/lib/utils";

const glass = "rounded-[24px] border border-white/80 bg-white/70 shadow-sm backdrop-blur-xl";

export function MoodTracker() {
  const [store, setStore] = useState<MoodStore>({ studentId: "", year: 2026, days: {}, help: [] });
  const [scope, setScope] = useState<"week" | "month">("week");
  const [pick, setPick] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodKey>("content");
  const [note, setNote] = useState("");
  const [help, setHelp] = useState(false);
  const [confirmHelp, setConfirmHelp] = useState(false);
  const [msg, setMsg] = useState("");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [month, setMonth] = useState(() => new Date().getMonth());
  const touch = useTouch();
  const board = useRef<HTMLDivElement>(null);

  const today = todayKey();
  const slots = useMemo(() => openSlots(), []);

  useEffect(() => {
    const s = loadMood();
    setStore(s);
    const t = s.days[today];
    if (t) {
      setMood(t.mood);
      setNote(t.note);
    }
  }, [today]);

  const pie = useMemo(() => {
    const now = new Date();
    const from = new Date(now);
    if (scope === "week") from.setDate(now.getDate() - 6);
    else from.setDate(1);
    from.setHours(0, 0, 0, 0);
    const { counts, n } = rangeCounts(store, from, now);
    const slices = MOODS.map((m) => ({
      key: m.key,
      label: m.label,
      color: m.color,
      value: counts[m.key],
      pct: n ? Math.round((counts[m.key] / n) * 100) : 0,
    })).filter((s) => s.value > 0);
    return { slices, n };
  }, [store, scope]);

  const selected = pick ? store.days[pick] : null;

  function saveToday() {
    setStore(logDay(store, today, mood, note));
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
                  onClick={() => setMood(m.key)}
                  className={cn(
                    "group flex h-[4.6rem] flex-col items-center justify-center gap-1 rounded-2xl border text-[11px] touch:text-xs transition duration-200 hover:-translate-y-1 hover:text-paper hover:shadow-md",
                    on ? "border-transparent text-paper shadow-md" : "border-white/80 bg-white text-home",
                  )}
                  style={{ backgroundColor: on ? m.color : undefined }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = m.color;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = on ? m.color : "";
                  }}
                >
                  <span className="text-lg leading-none transition duration-200 group-hover:-translate-y-0.5">{m.glyph}</span>
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
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              placeholder="What sat in the chest today…"
              className="mt-3 min-h-32 w-full resize-none rounded-[22px] border border-white bg-white/90 p-4 text-base leading-relaxed text-home outline-none placeholder:text-mute/70"
            />
          </label>
          <button type="button" onClick={saveToday} className="mt-4 h-12 self-start rounded-full bg-grove px-7 text-sm font-medium text-paper">
            Colour today
          </button>
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
                  className={cn("rounded-full px-3 py-1.5 capitalize touch:min-h-11 touch:px-4", scope === s && "bg-home text-paper")}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex flex-1 flex-col items-center justify-center">
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pie.slices.length ? pie.slices : [{ key: "empty", value: 1, color: "#e8e4dc" }]}
                    dataKey="value"
                    innerRadius={58}
                    outerRadius={78}
                    paddingAngle={3}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {(pie.slices.length ? pie.slices : [{ color: "#e8e4dc" }]).map((s, i) => (
                      <Cell key={i} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
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
            <p className="text-sm text-mute">This month is the sitting. The year is the river behind it. Tap a filled lamp.</p>
          </div>
          <p className="text-xs text-mute">{store.year}</p>
        </div>
        <div ref={board} className="scroll-mt-16">
          <MonthBoard year={store.year} month={month} days={store.days} today={today} onPick={setPick} />
        </div>
        <div className="mt-8">
          <p className="mb-3 text-[11px] uppercase tracking-[0.14em] text-mute touch:text-xs">The year</p>
          <div className="space-y-2">
            {MONTHS.map((name, mi) => {
              const dim = daysInMonth(store.year, mi);
              const isNow = mi === new Date().getMonth();
              const label = (
                <span className={cn("w-20 shrink-0 text-xs", isNow ? "font-medium text-home" : "text-mute")}>{name}</span>
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
                    className={cn("flex min-h-11 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left", mi === month && "bg-white/80")}
                  >
                    {label}
                    <span aria-hidden className="flex flex-wrap gap-1">
                      {Array.from({ length: dim }, (_, di) => {
                        const key = `${store.year}-${String(mi + 1).padStart(2, "0")}-${String(di + 1).padStart(2, "0")}`;
                        const cell = store.days[key];
                        return (
                          <span
                            key={di}
                            className="size-[18px] rounded-md"
                            style={{ backgroundColor: cell ? moodOf(cell.mood).color : "#efeae3" }}
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
                      const key = `${store.year}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                      const cell = store.days[key];
                      const future = key > today;
                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={future || !cell}
                          onClick={() => cell && setPick(key)}
                          title={cell ? `${key} · ${moodOf(cell.mood).label}` : key}
                          className="size-[18px] rounded-md disabled:cursor-default"
                          style={{ backgroundColor: cell ? moodOf(cell.mood).color : "#efeae3" }}
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
          thought={selected.thought}
          onClose={() => setPick(null)}
          onHelp={() => {
            setPick(null);
            setConfirmHelp(true);
          }}
        />
      )}

      {confirmHelp && !help && !sent && (
        <Modal title="Sit with a counselor?" onClose={() => setConfirmHelp(false)}>
          <p className="text-sm text-mute">In-house, human. DHI does not enter the recording. Asha Rao will see your note, not a diagnosis.</p>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setConfirmHelp(false)} className="h-11 rounded-2xl bg-white px-4 text-sm">
              Not now
            </button>
            <button type="button" onClick={() => setHelp(true)} className="h-11 rounded-2xl bg-home px-4 text-sm text-paper">
              Yes, write to them
            </button>
          </div>
        </Modal>
      )}

      {help && (
        <HelpDesk
          slots={slots}
          message={msg}
          slotId={slotId}
          onMessage={setMsg}
          onSlot={setSlotId}
          onClose={() => {
            setHelp(false);
            setConfirmHelp(false);
          }}
          onSend={() => {
            setStore(sendHelp(store, msg, slotId));
            setHelp(false);
            setConfirmHelp(false);
            setSent(true);
            setMsg("");
            setSlotId(null);
          }}
        />
      )}

      {sent && (
        <Modal title="The door is open" onClose={() => setSent(false)}>
          <p className="text-sm text-mute">Your words went to the counselor desk. If you booked a slot, it is held.</p>
          <button type="button" onClick={() => setSent(false)} className="mt-5 h-11 rounded-2xl bg-home px-5 text-sm text-paper">
            Stay in the house
          </button>
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
  days: Record<string, MoodDay>;
  today: string;
  onPick: (key: string) => void;
}) {
  const dim = daysInMonth(year, month);
  const start = new Date(year, month, 1).getDay();
  const cells: (number | null)[] = [...Array(start).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
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
                "grid h-11 place-items-center rounded-2xl text-xs sm:aspect-square sm:h-auto",
                isToday && "ring-2 ring-gold",
                !cell && "bg-[#efeae3] text-mute",
                cell && "text-paper",
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
  onClose,
  onHelp,
}: {
  date: string;
  mood: MoodKey;
  note: string;
  thought: string;
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
          <div className="pointer-events-none absolute inset-0 bg-cover bg-[center_40%]" style={{ backgroundImage: "url(/mood/thought.jpg)" }} />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a1208]/80 via-[#1a1208]/25 to-transparent" />
        </>
      }
    >
      <div className="inline-flex flex-col gap-2">
        <p className="w-fit rounded-full border border-white/35 bg-[#1a1208]/55 px-3 py-1 text-[11px] tracking-[0.14em] text-paper backdrop-blur-md touch:text-xs">
          {prettyDate(date)}
        </p>
        <p className="font-display text-4xl drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]">
          {m.glyph} {m.label}
        </p>
      </div>
      <div className="mt-auto space-y-3 pb-2 pt-16">
        <div className="rounded-[24px] border border-white/25 bg-white/15 p-5 backdrop-blur-xl">
          <p className="text-[11px] uppercase tracking-[0.16em] text-paper/70 touch:text-xs">What you wrote</p>
          <p className="font-display mt-2 text-2xl leading-snug">{note || "This day was coloured, but no line was left."}</p>
        </div>
        <div className="rounded-[24px] border border-white/25 bg-white/15 p-5 backdrop-blur-xl">
          <p className="flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-paper/70 touch:text-xs">
            <Sparkles className="size-3" aria-hidden /> DHI thought
          </p>
          <p className="mt-2 text-sm leading-relaxed text-paper/90">{thought}</p>
        </div>
        <button type="button" onClick={onHelp} className="lamp-glow flex h-12 w-full items-center justify-center gap-2 rounded-full bg-paper text-sm font-medium text-home">
          <Heart className="size-4" aria-hidden /> Ask DHI for a sitting
        </button>
      </div>
    </Sheet>
  );
}

function HelpDesk({
  slots,
  message,
  slotId,
  onMessage,
  onSlot,
  onClose,
  onSend,
}: {
  slots: CounselSlot[];
  message: string;
  slotId: string | null;
  onMessage: (v: string) => void;
  onSlot: (id: string | null) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const days = [...new Set(slots.map((s) => s.date))];
  const [day, setDay] = useState(days[0] ?? "");
  const ofDay = slots.filter((s) => s.date === day);

  return (
    <Modal title={`Write to ${COUNSELOR}`} onClose={onClose}>
      <p className="text-xs text-mute">A human sitting. Pick an open hour if you want a time held.</p>
      <textarea
        value={message}
        onChange={(e) => onMessage(e.target.value)}
        rows={4}
        placeholder="What do you need them to know before the sitting?"
        className="mt-4 w-full resize-none rounded-2xl bg-white p-3 text-sm outline-none"
      />
      <p className="mt-4 text-[11px] uppercase tracking-wide text-mute touch:text-xs">Open hours</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {days.map((d) => (
          <button key={d} type="button" onClick={() => setDay(d)} className={cn("h-9 rounded-full px-3 text-xs touch:h-11", day === d ? "bg-home text-paper" : "bg-white")}>
            {d.slice(5)}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {ofDay.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={s.status === "booked"}
            onClick={() => onSlot(s.id === slotId ? null : s.id)}
            className={cn(
              "flex h-12 flex-col items-center justify-center rounded-2xl text-xs",
              s.status === "booked" && "bg-white/50 text-mute line-through",
              s.status === "open" && slotId === s.id && "bg-grove text-paper",
              s.status === "open" && slotId !== s.id && "bg-white",
            )}
          >
            <Clock className="mb-0.5 size-3" />
            {s.start}
            {s.status === "booked" ? " held" : " open"}
          </button>
        ))}
      </div>
      <button type="button" disabled={!message.trim()} onClick={onSend} className="mt-5 h-11 w-full rounded-2xl bg-home text-sm font-medium text-paper disabled:opacity-40">
        Send to counselor desk
      </button>
    </Modal>
  );
}

function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} side="bottom" title={title}>
      {children}
    </Sheet>
  );
}
