import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { ConvexSession, Waiting } from "@/components/dhi/convex-session";
import { signOutNow } from "@/lib/auth/client";
import { initialsOf } from "@/lib/dhi/initials";
import { StudentProvider } from "@/lib/dhi/student";
import { ENTER_PATH, entryTarget } from "@/lib/entry";
import { StudentHome } from "@/routes/home";

// The dashboard for a signed in student (spec 0008). The rooms still run on demo data (the real ones come in later rows); the student's own
// name and class come from their account, which already holds them from the interview. Anyone who is not signed in, or has not finished the
// interview, goes back to the front door.
export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "DHI" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ConvexSession>
      <Dashboard />
    </ConvexSession>
  ),
});

function Dashboard() {
  const auth = useConvexAuth();
  const me = useQuery(api.students.me, auth.isAuthenticated ? {} : "skip");
  const target = entryTarget(auth, me);
  const [signOutFailed, setSignOutFailed] = useState(false);

  useEffect(() => {
    if (target === "sign-in" || target === "interview") window.location.replace(ENTER_PATH);
  }, [target]);

  if (target !== "dashboard" || me?.state !== "ready") return <Waiting />;

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
        <p
          role="alert"
          data-testid="signout-error"
          className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-md rounded-2xl bg-peach px-4 py-3 text-center text-sm text-ink shadow-lg"
        >
          We could not sign you out just now. You are still signed in. Please try again.
        </p>
      )}
      <StudentHome />
    </StudentProvider>
  );
}
