import { useEffect, useRef, useState } from "react";
import { BarChart3, BookOpen, Building2, Gauge, HeartHandshake, Home, FileText, FileUp, GraduationCap, Mail, Menu, ShieldCheck, Users, Video, type LucideIcon } from "lucide-react";
import { HouseMenu } from "@/components/dhi/house-menu";
import { Sheet } from "@/components/dhi/sheet";
import { ClassListSection } from "@/components/dhi/staff/class-list-section";
import { ClassesSection } from "@/components/dhi/staff/classes-section";
import { InstitutesSection } from "@/components/dhi/staff/institutes-section";
import { InvitesSection } from "@/components/dhi/staff/invites-section";
import { ParentConsentSection } from "@/components/dhi/staff/parent-consent-section";
import { PapersSection } from "@/components/dhi/staff/papers-section";
import { ResultsSection } from "@/components/dhi/staff/results-section";
import { SchoolReportSection } from "@/components/dhi/staff/school-report-section";
import { StaffHomeSection } from "@/components/dhi/staff/home-section";
import { OverviewSection } from "@/components/dhi/staff/overview-section";
import { CounselorsSection } from "@/components/dhi/staff/counselors-section";
import { FoodsSection } from "@/components/dhi/staff/foods-section";
import { FilmsSection } from "@/components/dhi/staff/films-section";
import { HourSection } from "@/components/dhi/staff/hour-section";
import { DeskSection } from "@/components/dhi/staff/desk-section";
import { StaffDataSection } from "@/components/dhi/staff/data-section";
import { CounselSection, SharedRecordings } from "@/components/dhi/staff/counsel-section";
import { PeopleSection } from "@/components/dhi/staff/people-section";
import { ScopeProvider, type InstituteId, type StaffScope } from "@/components/dhi/staff/staff-parts";
import { BrandMark } from "@/components/dhi/ui/brand-mark";
import { Card } from "@/components/dhi/ui/card";
import { HouseFrame } from "@/components/dhi/ui/house-frame";
import { Notice } from "@/components/dhi/ui/notice";
import { TopBar } from "@/components/dhi/ui/top-bar";
import { ROLE_LABEL } from "@/lib/dhi/house-words";
import type { HouseRole } from "@/lib/entry";
import { useStudent } from "@/lib/dhi/student";

type Tab = "home" | "overview" | "counselors" | "institutes" | "classes" | "people" | "invites" | "list" | "parent" | "results" | "report" | "papers" | "foods" | "films" | "hour" | "desk" | "counsel" | "data";
type NavItem = { id: Tab; label: string; icon: LucideIcon; about: string };

// The staff area (spec house/0002), built from the house's own frame and menu so it looks like the rest. What each role sees:
// a DHI admin all five screens, an institute admin four (no Institutes), a teacher their classes, their students and invites for their classes.
const NAV_ALL: NavItem[] = [
  { id: "home", label: "Home", icon: Home, about: "What is waiting for you, with a way into each." },
  { id: "overview", label: "Overview", icon: Gauge, about: "Every institute at a glance: counts only, no names." },
  { id: "institutes", label: "Institutes", icon: Building2, about: "Add institutes, open one to work in it, and pause or resume it." },
  { id: "counselors", label: "Counselors", icon: HeartHandshake, about: "Invite, pause and bring back counselors. Their sessions stay theirs." },
  { id: "classes", label: "Classes", icon: BookOpen, about: "Classes of the institute, and which teachers have them." },
  { id: "people", label: "People", icon: Users, about: "Everyone who has joined. Pause someone, bring them back, or move a student." },
  { id: "invites", label: "Invites", icon: Mail, about: "Invite people by Google email. They join by pressing Join." },
  { id: "list", label: "Class list", icon: FileUp, about: "Invite a whole class at once from a list." },
  { id: "parent", label: "Parent consent", icon: ShieldCheck, about: "Say that a parent's written consent is on file for students under 18." },
  { id: "results", label: "Results", icon: FileText, about: "The confirmed marks and remarks of a class. Answers are never shown." },
  { id: "report", label: "School report", icon: BarChart3, about: "Class totals from the papers, the topics by week, and who may need academic support." },
  { id: "hour", label: "Study hour", icon: GraduationCap, about: "Set the study hour and look at its chat." },
  { id: "desk", label: "DHI desk", icon: GraduationCap, about: "Set the coins every student gets each month for the DHI desk." },
  { id: "films", label: "Films", icon: FileText, about: "Upload films for the Modules room and approve them for students." },
  { id: "foods", label: "Food catalog", icon: BookOpen, about: "Publish the dishes students added into the shared catalog." },
  { id: "papers", label: "Papers and review", icon: FileText, about: "Build and send papers, mark long answers, and review the posts of your classes." },
  { id: "counsel", label: "Sessions", icon: Video, about: "Open your times, meet students in a recorded video call, and write a short note after." },
  { id: "data", label: "Your data", icon: ShieldCheck, about: "Download one file of what the house holds about you as staff." },
];

function navFor(role: HouseRole): NavItem[] {
  // Parent consent is the school's alone: a DHI admin cannot record it (spec house/0005, AC-3). Sessions are the counselor's alone (spec house/0024). The
  // school report is the institute's: a DHI admin and a counselor never see it (spec house/0025).
  if (role === "counselor") return NAV_ALL.filter((n) => n.id === "counsel" || n.id === "data");
  if (role === "dhi_admin") return NAV_ALL.filter((n) => n.id !== "parent" && n.id !== "papers" && n.id !== "results" && n.id !== "report" && n.id !== "counsel");
  if (role === "institute_admin") return NAV_ALL.filter((n) => n.id !== "overview" && n.id !== "counselors" && n.id !== "institutes" && n.id !== "papers" && n.id !== "foods" && n.id !== "films" && n.id !== "hour" && n.id !== "desk" && n.id !== "counsel");
  if (role === "teacher") {
    return NAV_ALL.filter((n) => n.id !== "overview" && n.id !== "counselors" && n.id !== "institutes" && n.id !== "parent" && n.id !== "results" && n.id !== "foods" && n.id !== "films" && n.id !== "hour" && n.id !== "desk" && n.id !== "counsel").map((n) =>
      n.id === "classes"
        ? { ...n, label: "My classes", about: "The classes your institute gave you." }
        : n.id === "people"
          ? { ...n, label: "My students", about: "The students of your classes." }
          : n.id === "invites"
            ? { ...n, about: "Invite students into your classes by Google email." }
            : n.id === "list"
              ? { ...n, about: "Invite the students of one of your classes from a list." }
              : n,
    );
  }
  return [];
}

// A role with no screens here sees its own place only.
function NothingHere() {
  return (
    <Card className="flex min-h-60 flex-col items-center justify-center text-center">
      <GraduationCap className="mb-3 size-8 text-lilac" aria-hidden />
      <h2 className="font-display text-2xl">Nothing here yet</h2>
      <p className="mt-2 max-w-sm text-sm text-mute">There is nothing for you to do here yet.</p>
    </Card>
  );
}

export function StaffArea({ role, instituteName }: { role: HouseRole; instituteName: string | null }) {
  const person = useStudent();
  const items = navFor(role);
  const [tab, setTab] = useState<Tab>(items[0]?.id ?? "classes");
  const [menuOpen, setMenuOpen] = useState(false);
  const [opened, setOpened] = useState<{ id: InstituteId; name: string } | undefined>(undefined);
  const menuButton = useRef<HTMLButtonElement>(null);

  // The drawer only exists below 1024. Rotating or resizing past it closes the drawer.
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const close = () => wide.matches && setMenuOpen(false);
    wide.addEventListener("change", close);
    return () => wide.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const isDhi = role === "dhi_admin";
  const scope: StaffScope = {
    role,
    instituteId: isDhi ? opened?.id : undefined,
    instituteName: isDhi ? (opened?.name ?? null) : instituteName,
    needsInstitute: isDhi && !opened,
  };
  const current = items.find((n) => n.id === tab) ?? items[0];

  const pick = (id: string) => {
    setTab(id as Tab);
    setMenuOpen(false);
  };
  const exit = () => {
    setMenuOpen(false);
    person.signOut();
  };
  const menu = items.map((n) => ({ id: n.id, label: n.label, icon: n.icon }));

  return (
    <ScopeProvider value={scope}>
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
              <HouseMenu rooms={menu} tab={tab} locked={false} variant="drawer" onPick={pick} onLeave={exit} />
            </Sheet>
          </>
        }
        side={
          <>
            <BrandMark size="menu" className="mb-6 px-2" />
            <HouseMenu rooms={menu} tab={tab} locked={false} variant="side" onPick={pick} onLeave={exit} />
          </>
        }
      >
        <header className="relative z-10 flex flex-wrap items-center gap-3">
          <div className="min-w-0 max-sm:w-full">
            <h1 className="font-display text-2xl font-medium lg:text-3xl">{current?.label ?? "Staff"}</h1>
            <p className="text-sm text-mute">{current?.about ?? "Your place in the house"}</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {isDhi && (
              <span data-testid="working-in" className="rounded-control border border-white/80 bg-white/70 px-3 py-2 text-sm">
                Working in: <strong className="font-medium">{opened?.name ?? "no institute yet"}</strong>
              </span>
            )}
            <span className="rounded-control border border-white/80 bg-white/70 px-3 py-2 text-sm">{ROLE_LABEL[role]}</span>
          </div>
        </header>

        <Notice className="shrink-0">
          This is the staff area. Students' own rooms are not shown here. Marks and answers open only on the marking, results and school report pages, and each look is recorded where the student can see it. Use only people made up for testing until the owner approves the consent words and the legal check is done.
        </Notice>

        {!current ? (
          <NothingHere />
        ) : current.id === "home" ? (
          <StaffHomeSection onGo={(id) => setTab(items.some((n) => n.id === id) ? (id as Tab) : "home")} />
        ) : current.id === "overview" ? (
          <OverviewSection />
        ) : current.id === "counselors" ? (
          <CounselorsSection />
        ) : current.id === "counsel" ? (
          <CounselSection />
        ) : current.id === "institutes" ? (
          <InstitutesSection onOpen={(id, name) => setOpened({ id, name })} openId={opened?.id} />
        ) : current.id === "classes" ? (
          <ClassesSection />
        ) : current.id === "people" ? (
          <PeopleSection />
        ) : current.id === "invites" ? (
          <InvitesSection />
        ) : current.id === "parent" ? (
          <ParentConsentSection />
        ) : current.id === "results" ? (
          <ResultsSection />
        ) : current.id === "report" ? (
          <SchoolReportSection role={role} />
        ) : current.id === "papers" ? (
          <PapersSection />
        ) : current.id === "foods" ? (
          <FoodsSection />
        ) : current.id === "films" ? (
          <FilmsSection />
        ) : current.id === "hour" ? (
          <HourSection />
        ) : current.id === "desk" ? (
          <DeskSection />
        ) : current.id === "data" ? (
          <>
            <StaffDataSection />
            <SharedRecordings />
          </>
        ) : (
          <ClassListSection />
        )}
      </HouseFrame>
    </ScopeProvider>
  );
}
