// The link between the house account and the student's DhiRise check (house spec 0002 follow up), shown on Your data. The student's own tap links it. The
// link changes nothing in the house: it only means the download holds their answers to the check. The house erase does not erase the check, and the
// card says so. The words are drafts until the owner approves them.
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

const dateOf = (at: number) => new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function FunnelLinkCard() {
  const status = useQuery(api.funnelLink.status, {});
  const link = useMutation(api.funnelLink.link);
  const unlink = useMutation(api.funnelLink.unlink);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(call: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      const r = (await call()) as { ok?: boolean; code?: string };
      if (r && r.ok === false) setError(refusalWords(r.code));
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
    setBusy(false);
  }

  if (status === undefined) return null;
  return (
    <Card data-testid="funnel-link">
      <h2 className="text-sm font-semibold">Your DhiRise check</h2>
      {!status.hasProfile ? (
        <p className="mt-2 text-sm text-mute touch:text-base" data-testid="funnel-none">
          You have not taken the DhiRise self check with this Google account.
        </p>
      ) : status.linkedAt === null ? (
        <>
          <p className="mt-2 text-sm text-mute touch:text-base">
            You took the DhiRise self check with this account. You can link it to the house.
            Linking changes nothing you see here. It only means that Download my data also holds
            your answers to the check.
          </p>
          <div className="mt-3">
            <Button variant="quiet" disabled={busy} onClick={() => run(() => link({}))} data-testid="funnel-link-go">
              Link my DhiRise check
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-mute touch:text-base" data-testid="funnel-linked">
            Linked on {dateOf(status.linkedAt)}. Download my data also holds your answers to the
            check. Erasing in the house does not erase the check, because DhiRise keeps it. To have
            it erased too, ask the DhiRise team.
          </p>
          <div className="mt-3">
            <Button variant="quiet" disabled={busy} onClick={() => run(() => unlink({}))} data-testid="funnel-unlink">
              Unlink
            </Button>
          </div>
        </>
      )}
      {error && (
        <Notice tone="danger" role="alert" className="mt-3 px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
    </Card>
  );
}
