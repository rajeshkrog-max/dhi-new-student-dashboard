import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { ConvexSession } from "@/components/dhi/convex-session";
import { AccessPaused, NotInHouse } from "@/components/dhi/house-screens";
import { LeaveFailedNotice, useLeave } from "@/components/dhi/house-session";
import { DashboardSkeleton } from "@/components/dhi/ui/loading-screens";
import { devThrow } from "@/lib/dev-throw";
import { ENTER_PATH, JOIN_PATH, STAFF_PATH } from "@/lib/entry";
import { initialsOf } from "@/lib/dhi/initials";
import { StudentProvider } from "@/lib/dhi/student";
import { StudentHome } from "@/routes/home";

// The student's dashboard (spec 0008, spec house/0002). Every house route needs a real member: the page reads the person's own entry state
// from `members.me` and shows the rooms only to an active student. The rooms still run on demo data (the real ones come in later rows); the
// student's own name and class come from their `members` row, nothing else about them is carried here. A staff member goes to the staff area,
// an invited person to Join, and anyone not signed in goes back to the front door.
export const Route = createFileRoute("/dashboard")({
  ssr: false,
  // The server sends this shape instead of a blank page, and the page keeps it while sign in is checked (spec house/0003).
  pendingComponent: DashboardSkeleton,
  head: () => ({ meta: [{ title: "DHI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ConvexSession>
      <Dashboard />
    </ConvexSession>
  ),
});

function Dashboard() {
  devThrow("1");
  const navigate = useNavigate();
  const auth = useConvexAuth();
  const me = useQuery(api.members.me, auth.isAuthenticated ? {} : "skip");
  const { leave, failed } = useLeave();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) window.location.replace(ENTER_PATH);
    if (me?.state === "signedOut") window.location.replace(ENTER_PATH);
    if (me?.state === "invitePending") void navigate({ to: JOIN_PATH, replace: true });
    if (me?.state === "active" && me.role !== "student") void navigate({ to: STAFF_PATH, replace: true });
  }, [auth.isLoading, auth.isAuthenticated, me, navigate]);

  if (!auth.isAuthenticated || me === undefined) return <DashboardSkeleton />;
  if (me.state === "noHouse") return <NotInHouse />;
  if (me.state === "removed") return <AccessPaused kind="removed" />;
  if (me.state === "suspended") return <AccessPaused kind="suspended" />;
  if (me.state !== "active" || me.role !== "student") return <DashboardSkeleton />;

  return (
    <StudentProvider value={{ name: me.name, initials: initialsOf(me.name), house: me.className ?? me.instituteName ?? "", signOut: () => void leave() }}>
      {failed && <LeaveFailedNotice />}
      <StudentHome />
    </StudentProvider>
  );
}
