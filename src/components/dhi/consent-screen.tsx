import { useEffect, useRef, useState } from "react";
import { FileCheck2, PauseCircle } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { AccessPaused } from "@/components/dhi/house-screens";
import { LeaveFailedNotice, useLeave } from "@/components/dhi/house-session";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { TopBar } from "@/components/dhi/ui/top-bar";
import { YourData } from "@/components/dhi/your-data";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

type Missing = ("self" | "parent")[];
type By = ("self" | "school")[];
// A removed student, or one whose institute is paused: the pause page, with a way into the data rights that stay open (AC-6).
export function PausedHouse({ kind }: { kind: "removed" | "suspended" }) {
  const { leave, failed } = useLeave();
  const [view, setView] = useState<"paused" | "data">("paused");
  if (view === "paused") return <AccessPaused kind={kind} onData={() => setView("data")} />;
  return (
    <Frame>
      {failed && <LeaveFailedNotice />}
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-medium">Your data</h1>
          <p className="text-sm text-mute touch:text-base">Your access is paused. You can still download or erase what the house holds about you.</p>
        </div>
        <Button variant="quiet" onClick={() => setView("paused")} data-testid="paused-back">
          Back
        </Button>
      </header>
      <YourData reduced onErased={() => void leave()} />
    </Frame>
  );
}

export type LockedMe = { state: "consentNeeded"; missing: Missing } | { state: "withdrawn"; by: By };

// The page around the consent screen and Your data. It shows no student name, class or room: until consent is in place nothing of the house is
// shown (spec house/0005, AC-1).
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-page text-home">
      <TopBar />
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6">{children}</div>
    </main>
  );
}

// The draft mark (AC-18): the words below are drafts until the owner approves them, and the screen says so.
function DraftMark() {
  return (
    <Notice tone="danger" data-testid="draft-mark" className="px-4 py-3 text-sm">
      Draft words. The owner has not approved this notice yet, so use only people made up for testing.
    </Notice>
  );
}

// The notice, as written, and an I agree button that stays locked until the notice has been scrolled to the end (AC-20), as in the funnel.
function AgreeCard() {
  const notice = useQuery(api.consent.notice, {});
  const agree = useMutation(api.consent.agree);
  const box = useRef<HTMLDivElement>(null);
  const [atEnd, setAtEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const check = () => {
    const el = box.current;
    if (el && el.scrollTop + el.clientHeight >= el.scrollHeight - 4) setAtEnd(true);
  };
  // A notice that fits without scrolling is already at its end. The loading line is not the notice, so nothing is judged until it has arrived.
  useEffect(() => {
    if (notice) check();
  }, [notice]);

  async function press() {
    if (!notice) return;
    setError("");
    setBusy(true);
    try {
      const r = await agree({ version: notice.version, hash: notice.hash });
      // On success the entry state changes by itself and the dashboard moves on.
      if (!r.ok) {
        setError(refusalWords(r.code));
        setBusy(false);
      }
    } catch (e) {
      setError(refusalWords(codeOf(e)));
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-display text-xl font-medium">The house notice</h2>
      <p className="mt-1 text-sm text-mute touch:text-base">Please read it to the end. Then you can agree.</p>
      {/* Shown while the notice is still arriving too, so the page does not move when it lands (and the safe default is to say draft). */}
      {(!notice || !notice.approved) && (
        <div className="mt-3">
          <DraftMark />
        </div>
      )}
      <div
        ref={box}
        onScroll={check}
        tabIndex={0}
        role="region"
        aria-label="The house notice"
        data-testid="notice-box"
        className="mt-3 h-[50dvh] space-y-3 overflow-y-auto rounded-control border border-home/15 bg-white/80 p-4 text-sm touch:text-base"
      >
        {notice ? notice.lines.map((l, i) => <p key={i}>{l}</p>) : <p className="text-mute">Loading…</p>}
      </div>
      {error && (
        <Notice tone="danger" role="alert" data-testid="agree-error" className="mt-3 px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={!notice || !atEnd || busy} onClick={press} data-testid="agree">
          {busy ? "Saving…" : "I agree"}
        </Button>
        {!atEnd && notice && <span className="text-xs text-mute touch:text-sm">Scroll to the end to unlock.</span>}
      </div>
    </Card>
  );
}

function ParentWaiting() {
  return (
    <Card data-testid="parent-waiting">
      <h2 className="font-display text-xl font-medium">Waiting for your school</h2>
      <p className="mt-2 text-sm text-mute touch:text-base">
        You are under 18, so your school must record that your parent or guardian has agreed. Please ask your school. You can come back and the house opens as soon as it is
        recorded.
      </p>
    </Card>
  );
}

// What a student sees until they are through consent, or after they withdrew: the consent steps, and a way to Your data (a student's rights are
// open whatever their state).
export function LockedHouse({ me }: { me: LockedMe }) {
  const { leave, failed } = useLeave();
  const [view, setView] = useState<"consent" | "data">("consent");
  const needs = me.state === "consentNeeded" ? me.missing : [];
  const withdrawn = me.state === "withdrawn" ? me.by : [];

  return (
    <Frame>
      {failed && <LeaveFailedNotice />}
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid size-11 place-items-center rounded-control bg-white shadow-sm" aria-hidden>
          {me.state === "withdrawn" ? <PauseCircle className="size-6" /> : <FileCheck2 className="size-6" />}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-medium">{view === "data" ? "Your data" : me.state === "withdrawn" ? "The house is paused for you" : "Before you enter"}</h1>
          <p className="text-sm text-mute touch:text-base">
            {view === "data"
              ? "Your rights over what the house holds."
              : me.state === "withdrawn"
                ? withdrawn.includes("school")
                  ? "Your school paused this. Please ask your school."
                  : "You withdrew your consent. Your data is kept until you erase it."
                : "The house opens after the steps below."}
          </p>
        </div>
        <Button variant="quiet" onClick={() => setView(view === "data" ? "consent" : "data")} data-testid="toggle-data">
          {view === "data" ? "Back" : "Your data"}
        </Button>
        {/* In Your data, Leave sits up here: below it, it would move when the page finishes loading (the responsive sweep of 2026-10-27). */}
        {view === "data" && (
          <Button variant="quiet" data-testid="leave" onClick={() => void leave()}>
            Leave
          </Button>
        )}
      </header>

      {view === "data" ? (
        <YourData onErased={() => void leave()} />
      ) : me.state === "withdrawn" ? (
        <Card>
          <p className="text-sm text-mute touch:text-base">
            {withdrawn.includes("self")
              ? "Open Your data to bring your consent back, to download your data, or to erase it."
              : "Your data is safe and kept. You can still download or erase it in Your data."}
          </p>
        </Card>
      ) : (
        <>
          {needs.includes("self") ? <AgreeCard /> : null}
          {needs.includes("parent") ? <ParentWaiting /> : null}
        </>
      )}

      {view !== "data" && (
        <div className="flex justify-center pt-2">
          <Button variant="quiet" data-testid="leave" onClick={() => void leave()}>
            Leave
          </Button>
        </div>
      )}
    </Frame>
  );
}
