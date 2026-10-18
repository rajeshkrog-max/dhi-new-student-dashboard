import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { ConvexSession, Waiting } from "@/components/dhi/convex-session";
import { EnterScreen } from "@/components/dhi/enter-screen";
import { refreshSession } from "@/lib/auth/client";
import { DASHBOARD_PATH, INTERVIEW_PATH, entryTarget } from "@/lib/entry";

// The front door (spec 0008). Sign in is shared with the funnel, and so is the interview, so this page only reads the account: a student
// with a finished check goes to the dashboard, anyone else (a new account, or one that has not finished) goes to the interview.
export const Route = createFileRoute("/enter")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { signin?: "error" } => (search.signin === "error" ? { signin: "error" } : {}),
  head: () => ({ meta: [{ title: "DHI" }, { name: "robots", content: "noindex" }] }),
  component: EnterRoute,
});

function EnterRoute() {
  const { signin } = Route.useSearch();
  return (
    <ConvexSession>
      <FrontDoor signInFailed={signin === "error"} />
    </ConvexSession>
  );
}

function FrontDoor({ signInFailed }: { signInFailed: boolean }) {
  const navigate = useNavigate();
  const auth = useConvexAuth();
  // Set when the server says the session is gone although the page held a token: one forced refresh, then the sign in screen.
  const [sessionLost, setSessionLost] = useState(false);
  const me = useQuery(api.students.me, auth.isAuthenticated && !sessionLost ? {} : "skip");
  const target = entryTarget(sessionLost ? { isLoading: false, isAuthenticated: false } : auth, me);

  useEffect(() => {
    if (!auth.isAuthenticated) setSessionLost(false);
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (me?.state === "signedOut") {
      setSessionLost(true);
      void refreshSession();
    }
  }, [me?.state]);

  useEffect(() => {
    // The interview is the funnel's own pages on the same address, so this is a full page load, not a router move.
    if (target === "interview") window.location.replace(INTERVIEW_PATH);
    if (target === "dashboard") void navigate({ to: DASHBOARD_PATH, replace: true });
  }, [target, navigate]);

  if (target !== "sign-in") return <Waiting />;
  const notice = sessionLost ? "Your sign in has ended. Please sign in again." : signInFailed ? "Sign in did not finish. Please try again." : undefined;
  return <EnterScreen notice={notice} onSignedIn={() => setSessionLost(false)} />;
}
