import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { InviteWaiting, NotInHouse } from "@/components/dhi/house-screens";
import { DoorSkeleton } from "@/components/dhi/ui/loading-screens";
import { ENTER_PATH, STAFF_PATH, DASHBOARD_PATH, houseTarget } from "@/lib/entry";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

// The Join step (spec house/0002). The same plain address for everyone: a person signs in with Google, the server finds the invite for their
// verified email, and this page shows the institute and role with a Join button. Only pressing Join makes the membership. Someone who is not
// signed in goes to the front door first; a member goes on to their own place.
export function JoinPage() {
  const navigate = useNavigate();
  const auth = useConvexAuth();
  const me = useQuery(api.members.me, auth.isAuthenticated ? {} : "skip");
  const claim = useMutation(api.members.claimInvite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const target = me === undefined ? "waiting" : houseTarget(me);

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) window.location.replace(ENTER_PATH);
  }, [auth.isLoading, auth.isAuthenticated]);

  useEffect(() => {
    if (target === "dashboard") void navigate({ to: DASHBOARD_PATH, replace: true });
    if (target === "staff") void navigate({ to: STAFF_PATH, replace: true });
  }, [target, navigate]);

  async function join() {
    setError("");
    setBusy(true);
    try {
      const result = await claim({});
      // On success the entry state changes to `active` by itself, and the effect above moves the person on.
      if (!result.ok) {
        setError(refusalWords(result.code));
        setBusy(false);
      }
    } catch (e) {
      setError(refusalWords(codeOf(e)));
      setBusy(false);
    }
  }

  if (!auth.isAuthenticated || me === undefined || target === "dashboard" || target === "staff") {
    // Removed and suspended members are sent to the dashboard, which says so; a member is on the way to theirs.
    return <DoorSkeleton />;
  }
  if (me.state === "invitePending") return <InviteWaiting role={me.role} instituteName={me.instituteName} busy={busy} error={error} onJoin={join} />;
  return <NotInHouse />;
}
