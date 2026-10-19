import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, Component, type ErrorInfo, type ReactNode } from "react";
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
import { BrandMark } from "@/components/dhi/ui/brand-mark";
import { Button } from "@/components/dhi/ui/button";
import { Card, StatCard } from "@/components/dhi/ui/card";
import { StateChip } from "@/components/dhi/ui/chip";
import { HouseFrame } from "@/components/dhi/ui/house-frame";
import { Notice } from "@/components/dhi/ui/notice";
import { PausedRoom } from "@/components/dhi/ui/status-page";
import { TopBar } from "@/components/dhi/ui/top-bar";
import { StudyHourRoom } from "@/components/dhi/study/study-hour";
import { ModulesRoom } from "@/components/dhi/modules/modules-room";
import { BlogRoom } from "@/components/dhi/blog/blog-room";
import { DevRoomThrow } from "@/lib/dev-throw";
import { useGate } from "@/lib/dhi/gate";
import { HOME } from "@/lib/dhi/home-demo";
import { useStudent } from "@/lib/dhi/student";
import { cn } from "@/lib/utils";

// `/home` was the demo house. The real dashboard is `/dashboard` (spec 0008), so the old address only hands over to it.
export const Route = createFileRoute("/home")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: StudentHome,
});

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
  const student = useStudent();
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
    // A real student's Leave ends their session (spec 0008); the demo's only closes the demo gate.
    if (student.signOut) student.signOut();
    else leave();
  };

  return (
    <HouseFrame
      sectionClassName={tab === "dhi" || tab === "hour" ? "lg:overflow-hidden" : "lg:overflow-y-auto"}
      topBar={
        <>
          <TopBar
            belowLargeOnly
            start={
              <button
                ref={menuButton}
                type="button"
                data-testid="menu-button"
                aria-label="Open menu"
                aria-haspopup="dialog"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="grid size-11 place-items-center rounded-control border border-white/80 bg-white/70"
              >
                <Menu className="size-5" aria-hidden />
              </button>
            }
            end={<NotificationBell />}
          />
          <Sheet
            open={menuOpen}
            onOpenChange={setMenuOpen}
            side="left"
            title="Menu"
            heading={<BrandMark />}
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
                <label className="mb-3 flex h-11 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 text-sm text-mute has-[:focus-visible]:focus-ring">
                  <Search className="size-4 shrink-0" aria-hidden />
                  <input
                    data-in-field
                    type="search"
                    placeholder="Search the house…"
                    className="min-w-0 flex-1 bg-transparent text-home outline-none placeholder:text-mute"
                    aria-label="Search the house"
                  />
                </label>
              )}
            </div>
            <HouseMenu rooms={NAV} tab={tab} locked={locked} variant="drawer" onPick={pick} onLeave={exit} />
          </Sheet>
        </>
      }
      side={
        <>
          <BrandMark size="menu" className="mb-6 px-2" />
          <HouseMenu rooms={NAV} tab={tab} locked={locked} variant="side" onPick={setTab} onLeave={exit} />
        </>
      }
    >
      {/* The DHI desk below 1024 px is sized to fit the first screen with no note above it (house/0001, AC-13), so the note waits for the other rooms. */}
      {student.signOut && (
        <Notice data-testid="sample-note" className={cn("shrink-0", tab === "dhi" && "max-lg:hidden")}>
          The rooms show sample data for now. Your own marks, meals and notes arrive as each room is built.
        </Notice>
      )}
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
              <span className="pointer-events-none absolute left-1/2 top-full z-40 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-chip bg-home px-3 py-1.5 text-xs text-paper shadow-lg group-hover:block">
                Exam is going on
              </span>
            </div>
          ) : (
            <label className="hidden h-11 w-56 items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 text-sm text-mute backdrop-blur-md has-[:focus-visible]:focus-ring md:flex">
              <Search className="size-4 shrink-0" aria-hidden />
              <input
                data-in-field
                type="search"
                placeholder="Search the house…"
                className="min-w-0 flex-1 bg-transparent text-home outline-none placeholder:text-mute"
                aria-label="Search the house"
              />
            </label>
          )}
          <NotificationBell className="hidden lg:grid" />
          <div className="hidden items-center gap-2 rounded-control border border-white/80 bg-white/70 px-2 py-1.5 backdrop-blur-md sm:flex">
            <div data-decorative className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-peach to-lilac text-[11px] font-semibold text-white">
              {student.initials}
            </div>
            <div className="pr-2">
              <p className="text-xs font-medium leading-tight">{student.name}</p>
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
    </HouseFrame>
  );
}

function HomeBody({ onOpen }: { onOpen: (id: string) => void }) {
  const student = useStudent();
  return (
    <>
      {/* shrink-0: the section is a fixed height column that scrolls, and a card with overflow-hidden may otherwise shrink to a strip and clip its text */}
      <article className="flex shrink-0 flex-wrap items-center justify-between gap-4 min-h-[7.75rem] overflow-hidden rounded-card border border-white/80 bg-gradient-to-r from-white/80 via-lilac/20 to-peach/30 px-6 py-4 backdrop-blur-xl">
        <div>
          <p className="text-sm text-mute">Good morning</p>
          <h2 className="font-display mt-1 text-3xl font-medium">{student.name}</h2>
          <p className="mt-2 max-w-md text-sm text-home/70">{HOME.greeting.sub}</p>
        </div>
        <LampStack />
      </article>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {HOME.kpis.map((k) => (
          <button key={k.id} type="button" onClick={() => onOpen(k.tab)} className="text-left">
            <StatCard title={k.label} value={k.value} note={k.note} tone={k.tone} />
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent exams</h3>
            <Button variant="link" onClick={() => onOpen("papers")}>
              View all
            </Button>
          </div>
          <ul className="space-y-2">
            {HOME.papers.map((row) => (
              <li key={row.id} className="flex items-center gap-3 rounded-control bg-white/80 px-3 py-2.5">
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
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">House board</h3>
            <span className="text-xs text-mute">DHI opens these</span>
          </div>
          <ul className="space-y-3">
            {HOME.notices.map((n) => (
              <li key={n.id} className="flex gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-chip bg-lilac/30">
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
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{HOME.calendar.label}</h3>
            <Button variant="link" onClick={() => onOpen("hour")}>
              Hours
            </Button>
          </div>
          <HouseCalendar />
        </Card>

        <Card>
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
                  className={cn("flex flex-col items-center gap-2 rounded-control px-2 py-3 text-center", q.bg)}
                >
                  <Icon className="size-4" />
                  <span className="text-[11px] font-medium touch:text-xs">{q.label}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Lamps matrix</h3>
            <Button variant="link" onClick={() => onOpen("progress")}>
              Details
            </Button>
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
        </Card>
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
      <div className="absolute right-2 top-10 grid size-14 place-items-center rounded-control bg-white/80 shadow">
        <Lamp className="size-6 text-gold-ink" />
      </div>
    </div>
  );
}

function RoomGuard({ children }: { children: ReactNode }) {
  return (
    <RoomGate>
      <DevRoomThrow />
      {children}
    </RoomGate>
  );
}

class RoomGate extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  // The student sees plain words only; the error itself goes to the console.
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  render() {
    if (this.state.failed) return <PausedRoom onOpenAgain={() => this.setState({ failed: false })} />;
    return this.props.children;
  }
}

function ComingSoon({ name }: { name: string }) {
  return (
    <Card className="flex min-h-80 flex-col items-center justify-center text-center">
      <Moon className="mb-3 size-8 text-lilac" />
      <h2 className="font-display text-2xl">{name}</h2>
      <p className="mt-2 max-w-sm text-sm text-mute">
        This room is next. Home is the board; each door gets its own sitting.
      </p>
    </Card>
  );
}
