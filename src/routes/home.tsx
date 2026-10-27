import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState, Component, type ErrorInfo, type ReactNode } from "react";
import { useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import {
  Calendar,
  Download,
  FileText,
  Flame,
  BookOpen,
  Newspaper,
  ShieldCheck,
  Heart,
  Home as HomeIcon,
  Lamp,
  Lock,
  Menu,
  MessageCircle,
  Search,
  Sparkles,
  UtensilsCrossed,
  BedDouble,
} from "lucide-react";
import { CounselRoom } from "@/components/dhi/counsel/counsel-room";
import { BrainReport } from "@/components/dhi/brain/brain-report";
import { HomeScore } from "@/components/dhi/home-score";
import { HabitTracker } from "@/components/dhi/habits/habit-tracker";
import { SleepTracker } from "@/components/dhi/sleep-tracker";
import { MealsRoom } from "@/components/dhi/meals/meals-real";
import { MoodTracker } from "@/components/dhi/mood-tracker";
import { HouseMenu } from "@/components/dhi/house-menu";
import { EXAM_LOCKED_ROOMS } from "@/lib/dhi/exam-lock";
import { NotificationBell } from "@/components/dhi/notification-bell";
import { ROOM_ACTIONS_ID } from "@/components/dhi/room-actions";
import { ExamsRoom } from "@/components/dhi/exams/exams-room";
import { Sheet } from "@/components/dhi/sheet";
import { BrandMark } from "@/components/dhi/ui/brand-mark";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { HouseFrame } from "@/components/dhi/ui/house-frame";
import { PausedRoom } from "@/components/dhi/ui/status-page";
import { TopBar } from "@/components/dhi/ui/top-bar";
import { StudyHourReal } from "@/components/dhi/study/study-hour-real";
import { ModulesReal } from "@/components/dhi/modules/modules-real";
import { BlogReal } from "@/components/dhi/blog/blog-real";
import { DeskReal } from "@/components/dhi/desk/desk-real";
import { YourData } from "@/components/dhi/your-data";
import { DevRoomThrow } from "@/lib/dev-throw";
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
  { id: "sleep", label: "Sleep", icon: BedDouble },
  { id: "modules", label: "Modules", icon: BookOpen },
  { id: "dhi", label: "DHI desk", icon: Sparkles },
  { id: "hour", label: "Study hour", icon: Calendar },
  { id: "counsel", label: "Counseling", icon: MessageCircle },
  { id: "progress", label: "Progress", icon: Flame },
  { id: "data", label: "Your data", icon: ShieldCheck },
];

export function StudentHome() {
  const student = useStudent();
  const [tab, setTab] = useState("home");
  // True while an exam sitting is open (house spec 0012, AC-7): the exams room says so while the sitting is on screen, and the server says so from
  // Start until the student hands in or the window closes, also after a reload (owner, 2026-10-26). Both menus read it.
  const [sittingOnScreen, setSittingOnScreen] = useState(false);
  const sitting = useQuery(api.exams.sitting, {});
  const locked = sittingOnScreen || sitting?.open === true;
  // A room the paper closes is left for Exams; any other room stays as it is.
  useEffect(() => {
    if (sitting?.open === true) setTab((t) => (EXAM_LOCKED_ROOMS.includes(t) ? "papers" : t));
  }, [sitting?.open]);
  const mayOpen = (room: string) => !(locked && EXAM_LOCKED_ROOMS.includes(room));
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
    // Leave ends the member's session (spec 0008); there is no demo seat to close any more (spec house/0002).
    student.signOut();
  };

  return (
    <HouseFrame
      sectionClassName="lg:overflow-y-auto"
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
            end={<NotificationBell onOpen={(room) => mayOpen(room) && setTab(room)} />}
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
                    : tab === "sleep"
                      ? "Sleep"
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
              ? "Pariksha in sitting — the desk, blog, study hour and films are closed"
              : tab === "papers"
                ? "Windows the teacher opened. Sit before they close."
                : tab === "day"
                  ? "Food is life. Log the plate. Watch body and mind."
                  : tab === "mood"
                    ? "Colour the day. Keep the archive. Ask when it is heavy."
                    : tab === "habits"
                      ? "Five habits. Colour them. Watch the streak grow."
                      : tab === "sleep"
                        ? "Log last night in two taps. See the week and your usual bedtime."
                      : tab === "dhi"
                        ? "Sit with DHI. Coins for sittings. Drawings open beside the talk."
                        : tab === "hour"
                          ? "The hour opens when admin sets the clock. It closes when the clock ends."
                          : tab === "modules"
                            ? "House films. Watch from the start. A small score when the film is kept."
                            : tab === "blog"
                              ? "Write slowly. Read each other. Leave a line if it helped."
                              : tab === "progress"
                                ? "What DHI noticed in your own days, and your growth lamps."
                                : tab === "data"
                                  ? "Your consent, who has looked, a download and erase."
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
          <NotificationBell className="hidden lg:grid" onOpen={(room) => mayOpen(room) && setTab(room)} />
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

      <RoomGuard key={tab}>
      {tab === "home" ? (
        <HomeBody onOpen={(id) => mayOpen(id) && setTab(id)} />
      ) : tab === "papers" ? (
        <ExamsRoom onSitting={setSittingOnScreen} />
      ) : tab === "day" ? (
        <MealsRoom />
      ) : tab === "mood" ? (
        <MoodTracker onCounsel={() => setTab("counsel")} />
      ) : tab === "habits" ? (
        <HabitTracker />
      ) : tab === "sleep" ? (
        <SleepTracker />
      ) : tab === "dhi" ? (
        <DeskReal />
      ) : tab === "hour" ? (
        <StudyHourReal />
      ) : tab === "modules" ? (
        <ModulesReal />
      ) : tab === "blog" ? (
        <BlogReal />
      ) : tab === "progress" ? (
        <BrainReport onOpen={(room) => setTab(room)} />
      ) : tab === "data" ? (
        <YourData onErased={() => student.signOut()} />
      ) : (
        <CounselRoom />
      )}
      </RoomGuard>
    </HouseFrame>
  );
}

const PAPER_STATE: Record<string, string> = { assigned: "Not started", open: "In progress", submitted: "Submitted", marked: "Being marked", confirmed: "Marked" };

// The student's papers: the ones open now first, then the latest with their confirmed marks. Real rows from the Exams room. This card waits for the
// server, so it sits at the bottom of the page and nothing above it moves when it fills.
function RecentExams({ onOpen }: { onOpen: (id: string) => void }) {
  const papers = useQuery(api.papers.mine, {});
  const now = Date.now();
  const isOpen = (p: NonNullable<typeof papers>[number]) => (p.status === "assigned" || p.status === "open") && p.opensAt <= now && now < p.dueAt;
  const rows = papers ? [...papers.filter(isOpen), ...papers.filter((p) => !isOpen(p))].slice(0, 5) : [];
  return (
    <Card data-testid="recent-exams" className="order-2 lg:order-1">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Your exams</h3>
        <Button variant="link" onClick={() => onOpen("papers")}>
          View all
        </Button>
      </div>
      {papers === undefined ? (
        <p className="text-sm text-mute">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-mute">No papers yet. When your teacher sends one, it appears here.</p>
      ) : (
        <ul className="space-y-2" data-testid="open-exams">
          {rows.map((row) => (
            <li key={row.attemptId} className="flex flex-wrap items-center gap-3 rounded-control bg-white/80 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.title}</p>
                <p className="text-xs text-mute">{isOpen(row) ? "Open now" : row.excused ? "Not sat: the class was paused" : (PAPER_STATE[row.status] ?? row.status)}</p>
              </div>
              {isOpen(row) ? (
                <Button variant="quiet" onClick={() => onOpen("papers")}>
                  Open Exams
                </Button>
              ) : (
                <p className="shrink-0 text-sm tabular-nums">{row.mark ? `${row.mark.total} of ${row.mark.maxTotal}` : "—"}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// Good morning, afternoon or evening, from the device's clock: it is a greeting and holds no data.
function greeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function HomeBody({ onOpen }: { onOpen: (id: string) => void }) {
  const student = useStudent();
  return (
    <>
      {/* shrink-0: the section is a fixed height column that scrolls, and a card with overflow-hidden may otherwise shrink to a strip and clip its text */}
      <article className="flex shrink-0 flex-wrap items-center justify-between gap-4 min-h-[7.75rem] overflow-hidden rounded-card border border-white/80 bg-gradient-to-r from-white/80 via-lilac/20 to-peach/30 px-6 py-4 backdrop-blur-xl">
        <div>
          <p className="text-sm text-mute">{greeting()}</p>
          <h2 className="font-display mt-1 text-3xl font-medium">{student.name}</h2>
          <p className="mt-2 max-w-md text-sm text-home/70">Your own days, in one place. Everything here is yours alone.</p>
        </div>
        <LampStack />
      </article>

      <HomeScore />

      <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
        <RecentExams onOpen={onOpen} />

        <Card className="order-1 lg:order-2">
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
      </div>
    </>
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
