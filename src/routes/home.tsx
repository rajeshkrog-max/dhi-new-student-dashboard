import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, Component, type ReactNode } from "react";
import {
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
  Menu,
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
import { HouseMenu } from "@/components/dhi/house-menu";
import { NotificationBell } from "@/components/dhi/notification-bell";
import { ROOM_ACTIONS_ID } from "@/components/dhi/room-actions";
import { PapersDesk } from "@/components/dhi/papers-desk";
import { Sheet } from "@/components/dhi/sheet";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  // The drawer only exists below 1024. Rotating or resizing past it closes the drawer.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const close = () => wide.matches && setMenuOpen(false);
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  // Below 1024 the whole page scrolls, so a new room should start at the top.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const pick = (id: string) => {
    setTab(id);
    setMenuOpen(false);
  };
  const exit = () => {
    setMenuOpen(false);
    leave();
  };

  return (
    <div className="min-h-dvh bg-home-bg text-home lg:h-dvh lg:overflow-hidden">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_500px_at_8%_-8%,#f3e9ff_0%,transparent_50%),radial-gradient(700px_420px_at_100%_0%,#ffe8de_0%,transparent_46%)]" />
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/70 bg-home-bg/85 px-3 backdrop-blur-xl lg:hidden">
        <button
          ref={menuButton}
          type="button"
          data-testid="menu-button"
          aria-label="Open menu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className="grid size-11 place-items-center rounded-2xl border border-white/80 bg-white/70"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <span className="flex items-center gap-2 font-display text-sm tracking-[0.16em]">
          <span className="grid size-8 place-items-center rounded-xl bg-white shadow-sm" aria-hidden>
            ✦
          </span>
          DHI
        </span>
        <NotificationBell />
      </header>
      <Sheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        side="left"
        title="Menu"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          menuButton.current?.focus();
        }}
      >
        <div className="md:hidden">
          {locked ? (
            <div className="mb-3 flex h-11 items-center gap-2 rounded-full border border-white/50 bg-white/40 px-4 text-sm text-mute">
              <Lock className="size-4 shrink-0" aria-hidden />
              <span className="truncate">Search banned in exam</span>
            </div>
          ) : (
            <label className="mb-3 flex h-11 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 text-sm text-mute">
              <Search className="size-4 shrink-0" aria-hidden />
              <input
                type="search"
                placeholder="Search the house…"
                className="min-w-0 flex-1 bg-transparent text-home outline-none placeholder:text-mute"
                aria-label="Search the house"
              />
            </label>
          )}
        </div>
        <HouseMenu rooms={NAV} tab={tab} locked={locked} variant="drawer" onPick={pick} onLeave={exit} />
        <ProfileCard className="mt-3" />
      </Sheet>
      <div className="relative grid grid-cols-1 gap-3 p-3 lg:h-full lg:grid-cols-[220px_1fr] lg:gap-5 lg:overflow-hidden lg:px-0 lg:py-5">
        <aside className="hidden min-h-0 flex-col rounded-[28px] border border-white/70 bg-gradient-to-b from-[#e8dcff]/80 to-white/50 p-4 backdrop-blur-xl lg:flex lg:overflow-y-auto" aria-label="House menu">
          <div className="mb-6 flex items-center gap-2 px-2 font-display text-sm tracking-[0.16em]">
            <span className="grid size-9 place-items-center rounded-xl bg-white shadow-sm">✦</span>
            DHI
          </div>
          <HouseMenu rooms={NAV} tab={tab} locked={locked} variant="side" onPick={setTab} onLeave={exit} />
          <ProfileCard className="mt-3" />
        </aside>

        <section className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 lg:h-full lg:pr-1", tab === "dhi" || tab === "hour" ? "lg:overflow-hidden" : "lg:overflow-y-auto")} aria-label="House">
          <header className="relative z-10 flex flex-wrap items-center gap-3">
            <div className="min-w-0 max-sm:w-full">
              <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-medium lg:text-3xl">
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
              <div id={ROOM_ACTIONS_ID} className="ml-auto flex items-center gap-2 lg:hidden" />
              </div>
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
              <NotificationBell className="hidden lg:grid" />
              <div className="hidden items-center gap-2 rounded-2xl border border-white/80 bg-white/70 px-2 py-1.5 backdrop-blur-md sm:flex">
                <div data-decorative className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-peach to-lilac text-[11px] font-semibold text-white">
                  {HOME.student.initials}
                </div>
                <div className="pr-2">
                  <p className="text-xs font-medium leading-tight">{HOME.student.name}</p>
                  <p className="text-[10px] text-mute touch:text-xs">Student</p>
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
            <button type="button" className={LINK_BUTTON} onClick={() => onOpen("papers")}>
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
                  <span className="mt-1 block text-[11px] text-grove touch:text-xs">{n.when}</span>
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
            <button type="button" className={LINK_BUTTON} onClick={() => onOpen("hour")}>
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
                  <span className="text-[11px] font-medium touch:text-xs">{q.label}</span>
                </button>
              );
            })}
          </div>
        </Glass>

        <Glass>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lamps matrix</h3>
            <button type="button" className={LINK_BUTTON} onClick={() => onOpen("progress")}>
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
      <div className="mb-2 grid grid-cols-7 text-center text-[10px] uppercase text-mute touch:text-xs">
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
      <p className="mt-3 text-[11px] text-mute touch:text-xs">Gold · study hour · Peach · paper · Ink · today</p>
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
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium touch:text-xs", map.className)}>{map.label}</span>;
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

// A small text button inside a card. On touch screens it grows to a 44 pixel target without moving the text.
const LINK_BUTTON =
  "tap text-xs text-grove touch:-mr-2 touch:inline-flex touch:items-center touch:justify-center touch:px-2";

function ProfileCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl bg-white/55 p-3", className)}>
      <div data-decorative className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-peach to-lilac text-sm font-semibold text-white">
        {HOME.student.initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{HOME.student.name}</p>
        <p className="text-xs text-mute">{HOME.student.house}</p>
      </div>
    </div>
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
