import { createFileRoute } from "@tanstack/react-router";
import { useState, Component, type ReactNode } from "react";
import {
  Bell,
  Calendar,
  Download,
  FileText,
  Flame,
  BookOpen,
  Newspaper,
  Heart,
  Home as HomeIcon,
  Lamp,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  Search,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { DhiDesk } from "@/components/dhi/desk/dhi-desk";
import { HabitTracker } from "@/components/dhi/habits/habit-tracker";
import { MealTracker } from "@/components/dhi/meal-tracker";
import { MoodTracker } from "@/components/dhi/mood-tracker";
import { PapersDesk } from "@/components/dhi/papers-desk";
import { StudyHourRoom } from "@/components/dhi/study/study-hour";
import { ModulesRoom } from "@/components/dhi/modules/modules-room";
import { BlogRoom } from "@/components/dhi/blog/blog-room";
import { useGate } from "@/lib/dhi/gate";
import { HOME } from "@/lib/dhi/home-demo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/home")({ component: StudentHome });

const NAV = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "blog", label: "Blog", icon: Newspaper },
  { id: "papers", label: "Exams", icon: FileText },
  { id: "day", label: "Meal Tracker", icon: UtensilsCrossed },
  { id: "mood", label: "Mood Tracker", icon: Heart },
  { id: "habits", label: "Habit Tracker", icon: Lamp },
  { id: "modules", label: "Modules", icon: BookOpen },
  { id: "dhi", label: "DHI desk", icon: Sparkles },
  { id: "hour", label: "Study hour", icon: Calendar },
  { id: "counsel", label: "Counseling", icon: MessageCircle },
  { id: "progress", label: "Progress", icon: Flame },
];

export function StudentHome() {
  const { leave } = useGate();
  const [tab, setTab] = useState("home");
  const [locked, setLocked] = useState(false);

  return (
    <div className="min-h-dvh bg-home-bg text-home md:h-dvh md:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_500px_at_8%_-8%,#f3e9ff_0%,transparent_50%),radial-gradient(700px_420px_at_100%_0%,#ffe8de_0%,transparent_46%)]" />
      <div className="relative mx-auto grid min-h-dvh max-w-[1440px] grid-cols-1 gap-4 p-3 md:h-full md:grid-cols-[220px_1fr] md:gap-5 md:overflow-hidden md:p-5">
        <aside className="flex min-h-0 flex-col rounded-[28px] border border-white/70 bg-gradient-to-b from-[#e8dcff]/80 to-white/50 p-4 backdrop-blur-xl md:overflow-y-auto" aria-label="House menu">
          <div className="mb-6 flex items-center gap-2 px-2 font-display text-sm tracking-[0.16em]">
            <span className="grid size-9 place-items-center rounded-xl bg-white shadow-sm">✦</span>
            DHI
          </div>
          <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Student rooms">
            {NAV.map((item) => {
              const Icon = item.icon;
              const on = tab === item.id;
              const freeze = locked && item.id !== "papers";
              return (
                <div key={item.id} className="group relative">
                  <button
                    type="button"
                    disabled={freeze}
                    onClick={() => setTab(item.id)}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex h-10 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm",
                      on ? "bg-white shadow-sm" : !freeze && "hover:bg-white/40",
                      freeze && "opacity-40",
                    )}
                  >
                    <Icon className="size-4 opacity-70" />
                    {item.label}
                  </button>
                  {freeze && (
                    <>
                      <span className="absolute inset-0 z-10 cursor-not-allowed" title="Exam is going on" />
                      <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 hidden -translate-y-1/2 rounded-xl bg-home px-3 py-1.5 text-xs text-paper shadow-lg group-hover:block">
                        Exam is going on
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="group relative mt-3">
            <button
              type="button"
              className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm text-mute hover:bg-white/40 disabled:opacity-40"
              disabled={locked}
              onClick={() => leave()}
            >
              <LogOut className="size-4" />
              Leave
            </button>
            {locked && (
              <>
                <span className="absolute inset-0 z-10 cursor-not-allowed" title="Exam is going on" />
                <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 hidden -translate-y-1/2 rounded-xl bg-home px-3 py-1.5 text-xs text-paper shadow-lg group-hover:block">
                  Exam is going on
                </span>
              </>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-2xl bg-white/55 p-3">
            <div className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-peach to-lilac text-sm font-semibold text-white">
              {HOME.student.initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{HOME.student.name}</p>
              <p className="text-xs text-mute">{HOME.student.house}</p>
            </div>
          </div>
        </aside>

        <section className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 md:h-full md:pr-1", tab === "dhi" || tab === "hour" ? "overflow-hidden" : "overflow-y-auto")} aria-label="House">
          <header className="relative z-10 flex flex-wrap items-center gap-3">
            <div>
              <h1 className="font-display text-3xl font-medium">
                {tab === "papers"
                  ? "Exams"
                  : tab === "day"
                    ? "Meal Tracker"
                    : tab === "mood"
                      ? "Mood Tracker"
                      : tab === "habits"
                        ? "Habit Tracker"
                        : tab === "dhi"
                          ? "DHI desk"
                          : tab === "home"
                        ? "Home"
                        : NAV.find((n) => n.id === tab)?.label}
              </h1>
              <p className="text-sm text-mute">
                {locked
                  ? "Pariksha in sitting — the house is locked"
                  : tab === "papers"
                    ? "Windows the teacher opened. Sit before they close."
                    : tab === "day"
                      ? "Food is life. Log the plate. Watch body and mind."
                      : tab === "mood"
                        ? "Colour the day. Keep the archive. Ask when it is heavy."
                        : tab === "habits"
                          ? "Five habits. Colour them. Watch the streak grow."
                          : tab === "dhi"
                            ? "Sit with DHI. Coins for sittings. Drawings open beside the talk."
                            : tab === "hour"
                              ? "The hour opens when admin sets the clock. It closes when the clock ends."
                              : tab === "modules"
                                ? "House films. Watch from the start. A small score when the film is kept."
                                : tab === "blog"
                                  ? "Write slowly. Read each other. Leave a line if it helped."
                                  : "Your house for today"}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {locked ? (
                <div className="group relative hidden md:block">
                  <div className="flex h-11 w-56 items-center gap-2 rounded-full border border-white/50 bg-white/40 px-4 text-sm text-mute">
                    <Lock className="size-4 shrink-0" />
                    <span className="truncate">Search banned in exam</span>
                  </div>
                  <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-xl bg-home px-3 py-1.5 text-xs text-paper shadow-lg group-hover:block">
                    Exam is going on
                  </span>
                </div>
              ) : (
                <label className="hidden h-11 w-56 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 text-sm text-mute backdrop-blur-md md:flex">
                  <Search className="size-4 shrink-0" aria-hidden />
                  <input
                    type="search"
                    placeholder="Search the house…"
                    className="min-w-0 flex-1 bg-transparent text-home outline-none placeholder:text-mute"
                    aria-label="Search the house"
                  />
                </label>
              )}
              <span className="relative grid size-11 place-items-center rounded-2xl border border-white/80 bg-white/70 backdrop-blur-md">
                <Bell className="size-4" />
                <span className="absolute right-2 top-2 size-2 rounded-full bg-peach" />
              </span>
              <div className="hidden items-center gap-2 rounded-2xl border border-white/80 bg-white/70 px-2 py-1.5 backdrop-blur-md sm:flex">
                <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-peach to-lilac text-[11px] font-semibold text-white">
                  {HOME.student.initials}
                </div>
                <div className="pr-2">
                  <p className="text-xs font-medium leading-tight">{HOME.student.name}</p>
                  <p className="text-[10px] text-mute">Student</p>
                </div>
              </div>
            </div>
          </header>

          <RoomGuard>
          {tab === "home" ? (
            <HomeBody onOpen={(id) => !locked && setTab(id)} />
          ) : tab === "papers" ? (
            <PapersDesk locked={locked} onLock={setLocked} />
          ) : tab === "day" ? (
            <MealTracker />
          ) : tab === "mood" ? (
            <MoodTracker />
          ) : tab === "habits" ? (
            <HabitTracker />
          ) : tab === "dhi" ? (
            <DhiDesk />
          ) : tab === "hour" ? (
            <StudyHourRoom />
          ) : tab === "modules" ? (
            <ModulesRoom />
          ) : tab === "blog" ? (
            <BlogRoom />
          ) : (
            <ComingSoon name={NAV.find((n) => n.id === tab)?.label ?? "This room"} />
          )}
          </RoomGuard>
        </section>
      </div>
    </div>
  );
}

function HomeBody({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <>
      <article className="flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-[24px] border border-white/80 bg-gradient-to-r from-white/80 via-lilac/20 to-peach/30 px-6 py-4 backdrop-blur-xl">
        <div>
          <p className="text-sm text-mute">Good morning</p>
          <h2 className="font-display mt-1 text-3xl font-medium">{HOME.student.name}</h2>
          <p className="mt-2 max-w-md text-sm text-home/70">{HOME.greeting.sub}</p>
        </div>
        <LampStack />
      </article>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {HOME.kpis.map((k) => (
          <button key={k.id} type="button" onClick={() => onOpen(k.tab)} className="text-left">
            <Stat title={k.label} value={k.value} note={k.note} tone={k.tone} />
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <Glass>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent exams</h3>
            <button type="button" className="text-xs text-grove" onClick={() => onOpen("papers")}>
              View all
            </button>
          </div>
          <ul className="space-y-2">
            {HOME.papers.map((row) => (
              <li key={row.id} className="flex items-center gap-3 rounded-2xl bg-white/80 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.subject}</p>
                  <p className="text-xs text-mute">
                    {row.kind} · {row.teacher} · {row.date}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums">{row.marks ?? "—"}</p>
                <StateChip status={row.status} />
              </li>
            ))}
          </ul>
        </Glass>

        <Glass>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">House board</h3>
            <span className="text-xs text-mute">DHI opens these</span>
          </div>
          <ul className="space-y-3">
            {HOME.notices.map((n) => (
              <li key={n.id} className="flex gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-lilac/30">
                  {n.kind === "hour" ? (
                    <Calendar className="size-4" />
                  ) : n.kind === "remark" ? (
                    <FileText className="size-4" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                </span>
                <span>
                  <span className="block text-sm font-medium">{n.title}</span>
                  <span className="mt-0.5 block text-xs text-mute">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-grove">{n.when}</span>
                </span>
              </li>
            ))}
          </ul>
        </Glass>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Glass>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{HOME.calendar.label}</h3>
            <button type="button" className="text-xs text-grove" onClick={() => onOpen("hour")}>
              Hours
            </button>
          </div>
          <HouseCalendar />
        </Glass>

        <Glass>
          <h3 className="mb-3 text-sm font-semibold">Quick access</h3>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "papers", label: "Exams", icon: FileText, bg: "bg-lilac/30" },
              { id: "blog", label: "Blog", icon: Newspaper, bg: "bg-white" },
              { id: "dhi", label: "DHI desk", icon: Sparkles, bg: "bg-gold/40" },
              { id: "hour", label: "Study hour", icon: Calendar, bg: "bg-mint/40" },
              { id: "day", label: "Meals", icon: UtensilsCrossed, bg: "bg-peach/40" },
              { id: "mood", label: "Mood", icon: Heart, bg: "bg-lilac/30" },
              { id: "habits", label: "Habits", icon: Lamp, bg: "bg-mint/40" },
              { id: "progress", label: "Progress", icon: Download, bg: "bg-white" },
              { id: "counsel", label: "Counsel", icon: MessageCircle, bg: "bg-lilac/20" },
            ].map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => onOpen(q.id)}
                  className={cn("flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center", q.bg)}
                >
                  <Icon className="size-4" />
                  <span className="text-[11px] font-medium">{q.label}</span>
                </button>
              );
            })}
          </div>
        </Glass>

        <Glass>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lamps matrix</h3>
            <button type="button" className="text-xs text-grove" onClick={() => onOpen("progress")}>
              Details
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-28 w-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={HOME.lamps.slices}
                    dataKey="value"
                    nameKey="key"
                    innerRadius={38}
                    outerRadius={52}
                    paddingAngle={3}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {HOME.lamps.slices.map((s) => (
                      <Cell key={s.key} fill={s.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="font-display text-3xl font-medium">{HOME.lamps.composite}</p>
              <p className="text-xs text-mute">composite this week</p>
              <ul className="mt-2 space-y-1 text-xs text-mute">
                {HOME.lamps.slices
                  .filter((s) => s.key !== "rest")
                  .map((s) => (
                    <li key={s.key}>
                      {s.key} · {s.value}
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </Glass>
      </div>
    </>
  );
}

function HouseCalendar() {
  const { startWeekday, daysInMonth, marks } = HOME.calendar;
  const mark = Object.fromEntries(marks.map((m) => [m.day, m.kind]));
  const cells = [...Array(startWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  return (
    <div>
      <div className="mb-2 grid grid-cols-7 text-center text-[10px] uppercase text-mute">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {cells.map((day, i) => {
          if (!day) return <span key={`e-${i}`} />;
          const kind = mark[day];
          return (
            <span
              key={day}
              className={cn(
                "grid h-7 place-items-center rounded-full",
                kind === "today" && "bg-home text-paper",
                kind === "paper" && "bg-peach/70",
                kind === "hour" && "bg-gold/80",
              )}
            >
              {day}
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-mute">Gold · study hour · Peach · paper · Ink · today</p>
    </div>
  );
}

function LampStack() {
  return (
    <div className="relative hidden h-28 w-48 sm:block" aria-hidden>
      <div className="absolute right-8 top-4 h-16 w-20 rotate-6 rounded-md bg-lilac/80 shadow-md" />
      <div className="absolute right-14 top-8 h-16 w-20 -rotate-3 rounded-md bg-gold shadow-md" />
      <div className="absolute right-2 top-10 grid size-14 place-items-center rounded-2xl bg-white/80 shadow">
        <Lamp className="size-6 text-gold-ink" />
      </div>
    </div>
  );
}

function StateChip({ status }: { status: "accept" | "marked" | "open" }) {
  const map = {
    accept: { label: "Accept", className: "bg-gold/50 text-gold-ink" },
    marked: { label: "Seen", className: "bg-mint/50 text-grove" },
    open: { label: "Open", className: "bg-lilac/40 text-home" },
  }[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", map.className)}>{map.label}</span>;
}

function RoomGuard({ children }: { children: ReactNode }) {
  return <RoomGate>{children}</RoomGate>;
}

class RoomGate extends Component<{ children: ReactNode }, { msg: string | null }> {
  state = { msg: null as string | null };
  static getDerivedStateFromError(err: Error) {
    return { msg: err.message };
  }
  render() {
    if (this.state.msg) {
      return (
        <article className="rounded-[24px] border border-white/80 bg-white/80 p-6">
          <h2 className="font-display text-2xl">This room paused</h2>
          <p className="mt-2 text-sm text-mute">{this.state.msg}</p>
          <button type="button" className="mt-4 h-11 rounded-full bg-home px-5 text-sm text-paper" onClick={() => this.setState({ msg: null })}>
            Open again
          </button>
        </article>
      );
    }
    return this.props.children;
  }
}

function ComingSoon({ name }: { name: string }) {
  return (
    <Glass className="flex min-h-80 flex-col items-center justify-center text-center">
      <Moon className="mb-3 size-8 text-lilac" />
      <h2 className="font-display text-2xl">{name}</h2>
      <p className="mt-2 max-w-sm text-sm text-mute">
        This room is next. Home is the board; each door gets its own sitting.
      </p>
    </Glass>
  );
}

function Glass({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <article className={cn("rounded-[24px] border border-white/80 bg-white/70 p-5 backdrop-blur-xl", className)}>
      {children}
    </article>
  );
}

function Stat({
  title,
  value,
  note,
  tone,
}: {
  title: string;
  value: string;
  note: string;
  tone: "peach" | "lilac" | "mint" | "gold" | "grove";
}) {
  const bg = {
    peach: "bg-peach/40",
    lilac: "bg-lilac/35",
    mint: "bg-mint/40",
    gold: "bg-gold/40",
    grove: "bg-mint/25",
  }[tone];
  return (
    <article className={cn("h-full rounded-[24px] border border-white/80 p-4 backdrop-blur-xl", bg)}>
      <p className="text-xs text-mute">{title}</p>
      <p className="font-display mt-1 text-2xl font-medium">{value}</p>
      <p className="mt-1 text-xs text-grove">{note}</p>
    </article>
  );
}
