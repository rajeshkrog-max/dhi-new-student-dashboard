import { useCallback, useState } from "react";
import { signOutNow } from "@/lib/auth/client";
import { ENTER_PATH } from "@/lib/entry";
import { Notice } from "@/components/dhi/ui/notice";

// Leave for every house screen (the dashboard, the staff area, the Join page). It signs out for real, then lets the front door start again. A
// failed sign out keeps the person here (the cookie is still alive) and says so, so the button never looks broken (spec 0008).
export function useLeave() {
  const [failed, setFailed] = useState(false);
  const leave = useCallback(async () => {
    setFailed(false);
    if (await signOutNow()) window.location.assign(ENTER_PATH);
    else setFailed(true);
  }, []);
  return { leave, failed };
}

export function LeaveFailedNotice() {
  return (
    <Notice
      tone="danger"
      role="alert"
      data-testid="signout-error"
      className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-md py-3 text-center text-sm shadow-lg"
    >
      We could not sign you out just now. You are still signed in. Please try again.
    </Notice>
  );
}
