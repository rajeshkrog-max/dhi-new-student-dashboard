import { DoorClosed, Hourglass, MailOpen } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/dhi/ui/button";
import { StatusPage } from "@/components/dhi/ui/status-page";
import { LeaveFailedNotice, useLeave } from "@/components/dhi/house-session";
import { ROLE_LABEL } from "@/lib/dhi/house-words";
import type { HouseRole } from "@/lib/entry";

// The screens a person sees when they are signed in but not inside a house (spec house/0002, AC-3, AC-9, AC-16). They are neutral pages on
// the status page frame: no student name, no class, no rooms. Each one has Leave, so a person who signed in with the wrong Google account can
// start again.

function WithLeave({ children, leave, failed }: { children?: ReactNode; leave: () => void; failed: boolean }) {
  return (
    <>
      {failed && <LeaveFailedNotice />}
      {children}
      <Button variant="quiet" data-testid="leave" onClick={leave}>
        Leave
      </Button>
    </>
  );
}

// No membership and no invite. The person keeps full funnel access; the house simply has nothing for them yet.
export function NotInHouse() {
  const { leave, failed } = useLeave();
  return (
    <StatusPage
      icon={<DoorClosed className="size-6" />}
      title="You are not in a house yet"
      words="Please ask your institute to invite your Google email. If they already did, sign in with that same Google account."
    >
      <WithLeave leave={leave} failed={failed} />
    </StatusPage>
  );
}

// A removed member, or a member of a paused institute. Nothing about them is shown, and nothing they own is touched.
// `onData` opens Your data (consent state, download and erase): a paused student keeps these rights (spec house/0005, AC-6).
export function AccessPaused({ kind, onData }: { kind: "removed" | "suspended"; onData?: () => void }) {
  const { leave, failed } = useLeave();
  return (
    <StatusPage
      icon={<Hourglass className="size-6" />}
      title={kind === "removed" ? "Your access is paused" : "Your institute is paused"}
      words={
        kind === "removed"
          ? "Please ask your institute. Everything you wrote and saved is still here."
          : "Your institute's house is paused for now. Please ask your institute. Everything you wrote and saved is still here."
      }
    >
      {onData && (
        <Button variant="quiet" data-testid="paused-data" onClick={onData}>
          Your data
        </Button>
      )}
      <WithLeave leave={leave} failed={failed} />
    </StatusPage>
  );
}

// An invite for this Google email is waiting. Nothing is created until the person presses Join (AC-3).
export function InviteWaiting({
  role,
  instituteName,
  busy,
  error,
  onJoin,
}: {
  role: HouseRole;
  instituteName: string | null;
  busy: boolean;
  error: string;
  onJoin: () => void;
}) {
  const { leave, failed } = useLeave();
  return (
    <StatusPage
      icon={<MailOpen className="size-6" />}
      title="You are invited"
      words={`${instituteName ?? "DHI"} has invited you to join. Your role will be: ${ROLE_LABEL[role]}.`}
    >
      {failed && <LeaveFailedNotice />}
      {error && (
        <p role="alert" data-testid="join-error" className="w-full rounded-control bg-peach px-4 py-2 text-sm text-ink">
          {error}
        </p>
      )}
      <Button data-testid="join" disabled={busy} onClick={onJoin}>
        {busy ? "Joining…" : "Join"}
      </Button>
      <Button variant="quiet" data-testid="leave" onClick={leave}>
        Not now
      </Button>
    </StatusPage>
  );
}
