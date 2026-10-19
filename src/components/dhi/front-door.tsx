import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { EnterScreen } from "@/components/dhi/enter-screen";
import { DoorSkeleton } from "@/components/dhi/ui/loading-screens";
import { refreshSession } from "@/lib/auth/client";
import { DASHBOARD_PATH, entryTarget, interviewUrl } from "@/lib/entry";

// The front door (spec 0008), used by `/` and `/enter`. Sign in is shared with the funnel, and so is the interview, so this only reads the
// account: a student with a finished check goes to the dashboard, anyone else (a new account, or one that has not finished) goes to the
// interview. A visitor who is not signed in sees the Enter screen, except a friend who arrives with a referral code (`/?ref=ABC1234`):
// they go straight to the interview with the code kept, as they did before the house took the root address.
export function FrontDoor({ signInFailed, referral }: { signInFailed: boolean; referral?: string }) {
  const navigate = useNavigate();
  const auth = useConvexAuth();
  // Set when the server says the session is gone although the page held a token: one forced refresh, then the sign in screen.
  const [sessionLost, setSessionLost] = useState(false);
  const me = useQuery(api.students.me, auth.isAuthenticated && !sessionLost ? {} : "skip");
  const target = entryTarget(sessionLost ? { isLoading: false, isAuthenticated: false } : auth, me);
  const friendWithCode = target === "sign-in" && !sessionLost && !signInFailed && referral !== undefined;

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
    if (target === "interview" || friendWithCode) window.location.replace(interviewUrl(referral));
    if (target === "dashboard") void navigate({ to: DASHBOARD_PATH, replace: true });
  }, [target, friendWithCode, referral, navigate]);

  if (target !== "sign-in" || friendWithCode) return <DoorSkeleton />;
  const notice = sessionLost ? "Your sign in has ended. Please sign in again." : signInFailed ? "Sign in did not finish. Please try again." : undefined;
  return <EnterScreen notice={notice} onSignedIn={() => setSessionLost(false)} />;
}
