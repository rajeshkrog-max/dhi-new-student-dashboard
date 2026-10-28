// The student's Home (the house mockup, spec house/0017): the greeting, five number cards that open their rooms, the student's own exams, the house
// board (what is waiting), the month calendar, quick access and the lamps. Every number comes from the student's own rows on the server; the line
// under the name is picked by `homeLine`. Nothing here compares the student with anyone else.
import { useState, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { todayOf } from "@dhi/backend/dayRules";
import {
  Calendar,
  Download,
  FileText,
  Heart,
  Lamp,
  MessageCircle,
  Newspaper,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Button } from "@/components/dhi/ui/button";
import { Card, StatCard, type StatTone } from "@/components/dhi/ui/card";
import { homeLine } from "@/lib/dhi/home-line";
import { useStudent } from "@/lib/dhi/student";
import { cn } from "@/lib/utils";

type Open = (room: string) => void;

const clock = (ms: number) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
const shortDay = (ms: number) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
  }).format(ms);

// Good morning, afternoon or evening, from the device's clock: it is a greeting and holds no data.
function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function HomeBoard({ onOpen }: { onOpen: Open }) {
  const student = useStudent();
  // The screen's own clock, read once: it only chooses which recalls count as due and which month the calendar shows.
  const [now] = useState(() => Date.now());
  const month = todayOf(now).slice(0, 7);
  const home = useQuery(api.home.summary, {});
  const papers = useQuery(api.papers.mine, {});
  const wallet = useQuery(api.desk.wallet, {});
  const learn = useQuery(api.learn.summary, { now });
  const week = useQuery(api.meals.week, {});
  const board = useQuery(api.home.board, { month });

  const isOpen = (p: { status: string; opensAt: number; dueAt: number }) =>
    (p.status === "assigned" || p.status === "open") && p.opensAt <= now && now < p.dueAt;
  const openPapers = papers?.filter(isOpen) ?? [];
  const unread = papers?.filter((p) => p.status === "confirmed" && !p.accepted) ?? [];
  const platesKept = week?.filter((d) => Object.values(d.groups).some((n) => n > 0)).length;

  const line =
    papers && learn && board
      ? homeLine({
          now,
          openPapers,
          unreadMarks: unread.map((p) => p.title),
          hour: board.nextHour,
          recallsDue: learn.due,
        })
      : " ";

  const tiles: {
    id: string;
    label: string;
    value: string;
    note: string;
    tone: StatTone;
    room: string;
  }[] = [
    {
      id: "lamps",
      label: "DHI lamps",
      value: home === undefined ? "…" : home.score === null ? "Not yet" : String(home.score),
      note: "your own last four weeks",
      tone: "gold",
      room: "progress",
    },
    {
      id: "papers",
      label: "Papers waiting",
      value: papers === undefined ? "…" : String(openPapers.length),
      note:
        papers === undefined
          ? " "
          : unread.length > 0
            ? `${plural(unread.length, "mark", "marks")} to read`
            : "nothing to read",
      tone: "peach",
      room: "papers",
    },
    {
      id: "coins",
      label: "Desk coins",
      value: wallet === undefined ? "…" : String(wallet.balance),
      note: "left this month",
      tone: "lilac",
      room: "dhi",
    },
    {
      id: "recalls",
      label: "Recalls due",
      value: learn === undefined ? "…" : String(learn.due),
      note:
        learn === undefined ? " " : learn.openFix > 0 ? `${learn.openFix} to fix` : "on the desk",
      tone: "mint",
      room: "dhi",
    },
    {
      id: "plates",
      label: "Plates kept",
      value: platesKept === undefined ? "…" : `${platesKept}/7`,
      note: "days this week",
      tone: "grove",
      room: "day",
    },
  ];

  return (
    <>
      {/* shrink-0: the section is a fixed height column that scrolls, and a card with overflow-hidden may otherwise shrink to a strip and clip its text */}
      <article className="flex min-h-[7.75rem] shrink-0 flex-wrap items-center justify-between gap-4 overflow-hidden rounded-card border border-white/80 bg-gradient-to-r from-white/80 via-lilac/20 to-peach/30 px-6 py-4 backdrop-blur-xl">
        <div>
          <p className="text-sm text-mute">{greeting()}</p>
          <h2 className="font-display mt-1 text-3xl font-medium">{student.name}</h2>
          <p className="mt-2 max-w-md text-sm text-home/70" data-testid="home-line">
            {line}
          </p>
        </div>
        <LampStack />
      </article>

      <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="home-tiles">
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpen(t.room)}
            className="rounded-card text-left"
            data-testid={`tile-${t.id}`}
          >
            <StatCard title={t.label} value={t.value} note={t.note} tone={t.tone} />
          </button>
        ))}
      </div>

      <div className="grid shrink-0 gap-3 lg:grid-cols-[1.35fr_1fr]">
        <RecentExams papers={papers} now={now} onOpen={onOpen} />
        <HouseBoard
          openPapers={openPapers}
          unread={unread}
          hour={board?.nextHour ?? null}
          recalls={learn?.due ?? 0}
          now={now}
          onOpen={onOpen}
        />
      </div>

      <div className="grid shrink-0 gap-3 md:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
                Date.parse(`${month}-15T12:00:00Z`),
              )}
            </h3>
            <Button variant="link" onClick={() => onOpen("hour")}>
              Hours
            </Button>
          </div>
          <HouseCalendar
            month={month}
            today={todayOf(now)}
            hourDays={board?.hourDays ?? []}
            paperDays={board?.paperDays ?? []}
          />
        </Card>
        <QuickAccess onOpen={onOpen} />
        <LampsCard home={home} onOpen={onOpen} />
      </div>
    </>
  );
}

type PaperRow = {
  attemptId: string;
  title: string;
  opensAt: number;
  dueAt: number;
  status: string;
  mark: { total: number; maxTotal: number } | null;
  accepted: boolean;
  excused: boolean;
};

// The student's own papers in a table: the ones open now first, then the latest, with the confirmed mark and a chip for its state.
function RecentExams({
  papers,
  now,
  onOpen,
}: {
  papers: PaperRow[] | undefined;
  now: number;
  onOpen: Open;
}) {
  const isOpen = (p: PaperRow) =>
    (p.status === "assigned" || p.status === "open") && p.opensAt <= now && now < p.dueAt;
  const rows = papers
    ? [...papers.filter(isOpen), ...papers.filter((p) => !isOpen(p))].slice(0, 5)
    : [];
  return (
    <Card data-testid="recent-exams">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent exams</h3>
        <Button variant="link" onClick={() => onOpen("papers")}>
          View all
        </Button>
      </div>
      {papers === undefined ? (
        <p className="text-sm text-mute">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-mute">
          No papers yet. When your teacher sends one, it appears here.
        </p>
      ) : (
        <table className="w-full text-left text-sm" data-testid="open-exams">
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-mute touch:text-xs">
              <th className="pb-2 font-normal">Paper</th>
              <th className="hidden pb-2 font-normal sm:table-cell">Closes</th>
              <th className="pb-2 font-normal">Marks</th>
              <th className="pb-2 text-right font-normal">State</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.attemptId} className="border-t border-home/5">
                <td className="max-w-0 truncate py-2.5 pr-2 font-medium">{row.title}</td>
                <td className="hidden py-2.5 pr-2 text-mute sm:table-cell">
                  {shortDay(row.dueAt)}
                </td>
                <td className="py-2.5 pr-2 tabular-nums">
                  {row.mark ? `${row.mark.total}/${row.mark.maxTotal}` : "—"}
                </td>
                <td className="py-2.5 text-right">
                  <StateChip row={row} open={isOpen(row)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function StateChip({ row, open }: { row: PaperRow; open: boolean }) {
  const [label, tone] = open
    ? ["Open", "bg-lilac/40 text-home"]
    : row.status === "confirmed" && !row.accepted
      ? ["Read", "bg-gold/50 text-gold-ink"]
      : row.status === "confirmed"
        ? ["Seen", "bg-mint/50 text-grove"]
        : row.excused
          ? ["Paused", "bg-sand text-mute"]
          : row.status === "submitted" || row.status === "marked"
            ? ["Sent", "bg-white text-home"]
            : row.opensAt > Date.now()
              ? ["Soon", "bg-white text-mute"]
              : ["Closed", "bg-sand text-mute"];
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium touch:text-xs",
        tone,
      )}
    >
      {label}
    </span>
  );
}

// What is waiting, in the order the student would want it: an open paper, a mark to read, the study hour, recalls on the desk.
function HouseBoard({
  openPapers,
  unread,
  hour,
  recalls,
  now,
  onOpen,
}: {
  openPapers: PaperRow[];
  unread: PaperRow[];
  hour: { opensAt: number; closesAt: number } | null;
  recalls: number;
  now: number;
  onOpen: Open;
}) {
  const items: {
    key: string;
    icon: ReactNode;
    title: string;
    body: string;
    when: string;
    room: string;
  }[] = [];
  for (const p of openPapers)
    items.push({
      key: `open-${p.attemptId}`,
      icon: <FileText className="size-4" aria-hidden />,
      title: `${p.title} is open`,
      body: "A quiet sitting. Start when you can give it the time.",
      when: `closes ${clock(p.dueAt)}`,
      room: "papers",
    });
  for (const p of unread)
    items.push({
      key: `mark-${p.attemptId}`,
      icon: <FileText className="size-4" aria-hidden />,
      title: "Remark waiting",
      body: `Your teacher marked ${p.title}. Read the remarks and say you have read them.`,
      when: shortDay(p.dueAt),
      room: "papers",
    });
  if (hour)
    items.push({
      key: "hour",
      icon: <Calendar className="size-4" aria-hidden />,
      title: hour.opensAt <= now ? "Study hour is open" : "Study hour",
      body: "The room opens when the clock hits and closes when it ends.",
      when: hour.opensAt <= now ? `until ${clock(hour.closesAt)}` : clock(hour.opensAt),
      room: "hour",
    });
  if (recalls > 0)
    items.push({
      key: "recall",
      icon: <Sparkles className="size-4" aria-hidden />,
      title: "Recall cycle",
      body: `${plural(recalls, "topic is", "topics are")} due for a short recall on the desk.`,
      when: "today",
      room: "dhi",
    });

  return (
    <Card data-testid="house-board">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">House board</h3>
        <span className="text-xs text-mute">What waits for you</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-mute">Nothing is waiting. The house is quiet.</p>
      ) : (
        <ul className="space-y-3">
          {items.slice(0, 4).map((n) => (
            <li key={n.key}>
              <button
                type="button"
                onClick={() => onOpen(n.room)}
                className="flex w-full gap-3 rounded-control text-left"
              >
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-chip bg-lilac/30">
                  {n.icon}
                </span>
                <span>
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="mt-0.5 block text-xs text-mute">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-grove touch:text-xs">{n.when}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function HouseCalendar({
  month,
  today,
  hourDays,
  paperDays,
}: {
  month: string;
  today: string;
  hourDays: string[];
  paperDays: { day: string; title: string }[];
}) {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  // Monday first, as in the mockup.
  const start = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const cells = [
    ...Array<null>(start).fill(null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  const key = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const hours = new Set(hourDays);
  const paperOn = new Map(paperDays.map((p) => [p.day, p.title]));
  return (
    <div data-testid="house-calendar">
      <div
        className="mb-2 grid grid-cols-7 text-center text-[10px] uppercase text-mute touch:text-xs"
        aria-hidden
      >
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const k = key(day);
          const isToday = k === today;
          const paper = paperOn.get(k);
          const hour = hours.has(k);
          const label = [isToday && "today", paper && `${paper} closes`, hour && "study hour"]
            .filter(Boolean)
            .join(", ");
          return (
            <span
              key={day}
              title={label || undefined}
              aria-label={label ? `${day}, ${label}` : undefined}
              className={cn(
                "grid h-7 place-items-center rounded-full",
                isToday ? "bg-home text-paper" : paper ? "bg-peach/70" : hour && "bg-gold/80",
              )}
            >
              {day}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-mute touch:text-xs">
        Gold · study hour · Peach · paper closes · Ink · today
      </p>
    </div>
  );
}

function QuickAccess({ onOpen }: { onOpen: Open }) {
  const items = [
    { id: "papers", label: "Exams", icon: FileText, bg: "bg-lilac/30" },
    { id: "blog", label: "Blog", icon: Newspaper, bg: "bg-white" },
    { id: "dhi", label: "DHI desk", icon: Sparkles, bg: "bg-gold/40" },
    { id: "hour", label: "Study hour", icon: Calendar, bg: "bg-mint/40" },
    { id: "day", label: "Meals", icon: UtensilsCrossed, bg: "bg-peach/40" },
    { id: "mood", label: "Mood", icon: Heart, bg: "bg-lilac/30" },
    { id: "habits", label: "Habits", icon: Lamp, bg: "bg-mint/40" },
    { id: "progress", label: "Progress", icon: Download, bg: "bg-white" },
    { id: "counsel", label: "Counsel", icon: MessageCircle, bg: "bg-lilac/20" },
  ];
  return (
    <Card>
      <h3 className="mb-3 text-sm font-semibold">Quick access</h3>
      <div className="grid grid-cols-3 gap-2">
        {items.map((q) => {
          const Icon = q.icon;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onOpen(q.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-control px-2 py-3 text-center",
                q.bg,
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className="text-[11px] font-medium touch:text-xs">{q.label}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

const LAMP_FILL: Record<string, string> = {
  Sadhana: "var(--color-lilac)",
  Niyam: "var(--color-mint)",
  Viveka: "var(--color-gold)",
};

type HomeSummary = {
  score: number | null;
  lamps: { name: string; value: number | null; inputs: { label: string; value: string }[] }[];
  presence: { moodDays: number; mealDays: number };
};

// The lamps ring: each lamp's share of the ring is its own value out of a third, and the rest is left pale. The score is a growth mark from the
// student's own last four weeks, never a rank. The card keeps its size before the numbers arrive.
function LampsCard({ home, onOpen }: { home: HomeSummary | undefined; onOpen: Open }) {
  const lamps =
    home?.lamps ??
    ["Sadhana", "Niyam", "Viveka"].map((name) => ({ name, value: null, inputs: [] }));
  const slices = lamps.map((l) => ({
    key: l.name,
    value: (l.value ?? 0) / 3,
    fill: LAMP_FILL[l.name] ?? "var(--color-lilac)",
  }));
  const used = slices.reduce((s, x) => s + x.value, 0);
  const ring = [
    ...slices,
    { key: "rest", value: Math.max(0, 1 - used), fill: "var(--color-sand-deep)" },
  ].filter((x) => x.value > 0);
  return (
    <Card data-testid="home-score" aria-busy={home === undefined}>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Lamps matrix</h3>
        <Button variant="link" onClick={() => onOpen("progress")}>
          Details
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-28 w-28 shrink-0" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart accessibilityLayer={false}>
              <Pie
                rootTabIndex={-1}
                data={ring}
                dataKey="value"
                nameKey="key"
                innerRadius={38}
                outerRadius={52}
                paddingAngle={3}
                stroke="none"
                isAnimationActive={false}
              >
                {ring.map((s) => (
                  <Cell key={s.key} fill={s.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="font-display text-3xl font-medium" data-testid="score-value">
            {home === undefined ? "…" : home.score === null ? "Not yet" : home.score}
          </p>
          <p className="text-xs text-mute">your growth mark, never a rank</p>
          <ul className="mt-2 space-y-1 text-xs text-mute">
            {lamps.map((l) => (
              <li
                key={l.name}
                data-testid={`lamp-${l.name.toLowerCase()}`}
                title={l.inputs.map((i) => `${i.label}: ${i.value}`).join("\n") || undefined}
              >
                {l.name} ·{" "}
                <span className="inline-block min-w-14 tabular-nums">
                  {home === undefined
                    ? "…"
                    : l.value === null
                      ? "Not yet"
                      : `${Math.round(l.value * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-mute touch:text-xs">
        {home === undefined
          ? "Days you logged a mood and days you logged a meal show here, as presence only."
          : `Days you logged a mood: ${home.presence.moodDays}. Days you logged a meal: ${home.presence.mealDays}. Presence only.`}
      </p>
    </Card>
  );
}

function LampStack() {
  return (
    <div className="relative hidden h-28 w-48 sm:block" aria-hidden>
      <div className="absolute right-8 top-4 h-16 w-20 rotate-6 rounded-md bg-lilac/80 shadow-md" />
      <div className="absolute right-14 top-8 h-16 w-20 -rotate-3 rounded-md bg-gold shadow-md" />
      <div className="absolute right-2 top-10 grid size-14 place-items-center rounded-control bg-white/80 shadow">
        <Lamp className="size-6 text-gold-ink" />
      </div>
    </div>
  );
}
