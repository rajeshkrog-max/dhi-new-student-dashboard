import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { ConvexSession } from "@/components/dhi/convex-session";
import { AccessPaused, NotInHouse } from "@/components/dhi/house-screens";
import { LeaveFailedNotice, useLeave } from "@/components/dhi/house-session";
import { StaffArea } from "@/components/dhi/staff/staff-area";
import { DashboardSkeleton } from "@/components/dhi/ui/loading-screens";
import { DASHBOARD_PATH, ENTER_PATH, JOIN_PATH } from "@/lib/entry";
import { ROLE_LABEL } from "@/lib/dhi/house-words";
import { initialsOf } from "@/lib/dhi/initials";
import { StudentProvider } from "@/lib/dhi/student";

// The staff area (spec house/0002): teachers, institute admins and DHI admins (and a counselor's own place). Like every house route it needs a
// real member. A student goes to the dashboard, an invited person to Join, and anyone not signed in to the front door.
export const Route = createFileRoute("/staff")({
  ssr: false,
  pendingComponent: DashboardSkeleton,
  head: () => ({ meta: [{ title: "DHI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ConvexSession>
      <Staff />
    </ConvexSession>
  ),
});

function Staff() {
  const navigate = useNavigate();
  const auth = useConvexAuth();
  const me = useQuery(api.members.me, auth.isAuthenticated ? {} : "skip");
  const { leave, failed } = useLeave();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) window.location.replace(ENTER_PATH);
    if (me?.state === "signedOut") window.location.replace(ENTER_PATH);
    if (me?.state === "invitePending") void navigate({ to: JOIN_PATH, replace: true });
    if (me?.state === "active" && me.role === "student") void navigate({ to: DASHBOARD_PATH, replace: true });
  }, [auth.isLoading, auth.isAuthenticated, me, navigate]);

  if (!auth.isAuthenticated || me === undefined) return <DashboardSkeleton />;
  if (me.state === "noHouse") return <NotInHouse />;
  if (me.state === "removed") return <AccessPaused kind="removed" />;
  if (me.state === "suspended") return <AccessPaused kind="suspended" />;
  if (me.state !== "active" || me.role === "student") return <DashboardSkeleton />;

  return (
    <StudentProvider
      value={{ name: me.name, initials: initialsOf(me.name), house: me.instituteName ?? ROLE_LABEL[me.role], signOut: () => void leave() }}
    >
      {failed && <LeaveFailedNotice />}
      <StaffArea role={me.role} instituteName={me.instituteName} />
    </StudentProvider>
  );
}
