import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { ConvexSession } from "@/components/dhi/convex-session";
import { DashboardSkeleton } from "@/components/dhi/ui/loading-screens";
import { Notice } from "@/components/dhi/ui/notice";
import { signOutNow } from "@/lib/auth/client";
import { initialsOf } from "@/lib/dhi/initials";
import { StudentProvider } from "@/lib/dhi/student";
import { devThrow } from "@/lib/dev-throw";
import { ENTER_PATH, entryTarget } from "@/lib/entry";
import { StudentHome } from "@/routes/home";

// The dashboard for a signed in student (spec 0008). The rooms still run on demo data (the real ones come in later rows); the student's own
// name and class come from their account, which already holds them from the interview. Anyone who is not signed in, or has not finished the
// interview, goes back to the front door.
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
  const auth = useConvexAuth();
  const me = useQuery(api.students.me, auth.isAuthenticated ? {} : "skip");
  const target = entryTarget(auth, me);
  const [signOutFailed, setSignOutFailed] = useState(false);

  useEffect(() => {
    if (target === "sign-in" || target === "interview") window.location.replace(ENTER_PATH);
  }, [target]);

  if (target !== "dashboard" || me?.state !== "ready") return <DashboardSkeleton />;

  // Leave signs out for real, then lets the front door start again. A failed sign out keeps the student here (the cookie is still alive)
  // and says so, so the button never looks broken.
  async function signOut() {
    setSignOutFailed(false);
    if (await signOutNow()) window.location.assign(ENTER_PATH);
    else setSignOutFailed(true);
  }

  return (
    <StudentProvider value={{ name: me.student.name, initials: initialsOf(me.student.name), house: me.student.class, signOut }}>
      {signOutFailed && (
        <Notice
          tone="danger"
          role="alert"
          data-testid="signout-error"
          className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-md py-3 text-center text-sm shadow-lg"
        >
          We could not sign you out just now. You are still signed in. Please try again.
        </Notice>
      )}
      <StudentHome />
    </StudentProvider>
  );
}
