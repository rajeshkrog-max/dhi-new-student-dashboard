import { useState } from "react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Chip } from "@/components/dhi/ui/chip";
import { Notice } from "@/components/dhi/ui/notice";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";
import { dayLabel, joinExport, type ExportSection } from "@/lib/dhi/your-data";

// Your data (spec house/0005, AC-6, AC-9, AC-11, AC-12, AC-13): what the student agreed to, withdrawing and bringing consent back, the parent
// sharing switch, who has looked at their data, a download, and erase. A student who is locked, paused or in a paused institute can still open
// this page, because these are their rights over their own data. It shows no other person's name.
type ExportResult = FunctionReturnType<typeof api.dataRights.exportMine>;

// `reduced` is for a paused student (removed, or their institute is paused): only consent state, download and erase, because the sharing switch,
// the access record and withdrawing are for a student who is in the house (spec house/0005, AC-6).
export function YourData({
  onErased,
  reduced = false,
}: {
  onErased: () => void;
  reduced?: boolean;
}) {
  const state = useQuery(api.consent.state, {});
  const sharing = useQuery(api.sharing.get, reduced ? "skip" : {});
  const record = usePaginatedQuery(api.access.mine, reduced ? "skip" : {}, { initialNumItems: 25 });
  const withdraw = useMutation(api.consent.withdraw);
  const restore = useMutation(api.consent.restore);
  const setSharing = useMutation(api.sharing.set);
  const exportPage = useMutation(api.dataRights.exportMine);
  const erase = useMutation(api.dataRights.eraseMine);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function run(call: () => Promise<{ ok: boolean; code?: string } | unknown>, ok: string) {
    setError("");
    setDone("");
    setBusy(true);
    try {
      const r = (await call()) as { ok?: boolean; code?: string } | undefined;
      if (r && r.ok === false) setError(refusalWords(r.code));
      else setDone(ok);
    } catch (e) {
      setError(refusalWords(codeOf(e)));
    }
    setBusy(false);
  }

  async function download() {
    setError("");
    setDone("");
    setBusy(true);
    try {
      const sections: ExportSection[] = [];
      let cursor: string | null | undefined = undefined;
      let schema = "";
      let exportedAt = 0;
      for (let i = 0; i < 500; i++) {
        const r: ExportResult = await exportPage({ cursor });
        if (!r.ok) {
          setError(refusalWords(r.code));
          setBusy(false);
          return;
        }
        schema = r.schema;
        exportedAt = r.exportedAt;
        sections.push({ section: r.section, rows: r.rows });
        if (r.next === null) break;
        cursor = r.next;
      }
      const file = joinExport(schema, exportedAt, sections);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "my-dhi-data.json";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDone("Your file was downloaded.");
    } catch (e) {
      setError(refusalWords(codeOf(e)));
    }
    setBusy(false);
  }

  async function eraseAll() {
    setError("");
    setBusy(true);
    try {
      const r = await erase({ confirm: true });
      if (!r.ok) {
        setError(refusalWords(r.code));
        setBusy(false);
        setConfirming(false);
        return;
      }
      onErased();
    } catch (e) {
      setError(refusalWords(codeOf(e)));
      setBusy(false);
    }
  }

  const gate = state?.gate;
  const myWithdrawal = gate?.state === "withdrawn" && gate.by.includes("self");
  const schoolWithdrawal = gate?.state === "withdrawn" && gate.by.includes("school");

  return (
    <div className="space-y-3" data-testid="your-data">
      {error && (
        <Notice
          tone="danger"
          role="alert"
          data-testid="your-data-error"
          className="px-4 py-3 text-sm"
        >
          {error}
        </Notice>
      )}
      {done && (
        <Notice role="status" data-testid="your-data-done" className="px-4 py-3 text-sm">
          {done}
        </Notice>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="size-5 text-grove" aria-hidden />
          <h2 className="text-sm font-semibold">Your consent</h2>
          <Chip tone={gate?.state === "ok" ? "mint" : "gold"} className="min-w-20 text-center">
            {gate === undefined
              ? "…"
              : gate.state === "ok"
                ? "Agreed"
                : gate.state === "withdrawn"
                  ? "Withdrawn"
                  : "Waiting"}
          </Chip>
        </div>
        <p className="mt-2 text-sm text-mute touch:text-base">
          {gate === undefined
            ? "\u00a0"
            : gate.state === "withdrawn"
              ? "The house is paused for you. Your data is kept until you erase it."
              : gate?.state === "consentNeeded"
                ? "You can use the house after you agree to the notice" +
                  (gate.missing.includes("parent")
                    ? " and your school records your parent's consent."
                    : ".")
                : "You agreed to the house notice. You can withdraw at any time. Withdrawing pauses the house and keeps your data until you erase it."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {reduced ||
          (gate?.state === "consentNeeded" &&
            gate.missing.includes("self")) ? null : myWithdrawal ? (
            <Button
              disabled={busy}
              onClick={() => run(() => restore({}), "Your consent is back.")}
              data-testid="restore-consent"
            >
              Bring my consent back
            </Button>
          ) : (
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => run(() => withdraw({}), "Your consent is withdrawn.")}
              data-testid="withdraw-consent"
            >
              Withdraw my consent
            </Button>
          )}
        </div>
        {schoolWithdrawal && (
          <p className="mt-2 text-xs text-mute touch:text-sm">
            Your school has paused this. Only your school can bring it back.
          </p>
        )}
      </Card>

      {!reduced && (
        <Card>
          <h2 className="text-sm font-semibold">Sharing with your parent</h2>
          <p className="mt-2 text-sm text-mute touch:text-base">
            Off until you turn it on. Only you can change it. No parent screen exists yet.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip
              tone={sharing?.parentLevel === "summary" ? "mint" : "lilac"}
              className="min-w-24 text-center"
            >
              {sharing === undefined
                ? "…"
                : sharing.parentLevel === "summary"
                  ? "On: a summary"
                  : "Off"}
            </Chip>
            <Button
              variant="quiet"
              disabled={busy || sharing === undefined}
              onClick={() =>
                run(
                  () =>
                    setSharing({
                      parentLevel: sharing?.parentLevel === "summary" ? "none" : "summary",
                    }),
                  "Saved.",
                )
              }
              data-testid="toggle-sharing"
            >
              {sharing?.parentLevel === "summary" ? "Turn sharing off" : "Turn sharing on"}
            </Button>
          </div>
        </Card>
      )}

      {!reduced && (
        <Card>
          <h2 className="text-sm font-semibold">Who has looked at your data</h2>
          <p className="mt-2 text-sm text-mute touch:text-base">
            Each time a teacher or your institute looked at your named results. It shows the role
            and the date, never a name.
          </p>
          {record.status === "LoadingFirstPage" ? (
            <p className="mt-3 rounded-control bg-white/60 px-4 py-4 text-center text-sm text-mute">
              Loading…
            </p>
          ) : record.results.length === 0 ? (
            <p
              className="mt-3 rounded-control bg-white/60 px-4 py-4 text-center text-sm text-mute"
              data-testid="access-empty"
            >
              Nobody has looked yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5" data-testid="access-list">
              {record.results.map((r, i) => (
                <li
                  key={i}
                  className="flex justify-between rounded-control bg-white/80 px-3 py-2 text-sm"
                >
                  <span>{r.role}</span>
                  <span className="text-mute">{dayLabel(r.day)}</span>
                </li>
              ))}
            </ul>
          )}
          {(record.status === "CanLoadMore" || record.status === "LoadingMore") && (
            <div className="mt-3 flex justify-center">
              <Button
                variant="quiet"
                disabled={record.status === "LoadingMore"}
                onClick={() => record.loadMore(25)}
              >
                Show more
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold">Download or erase</h2>
        <p className="mt-2 text-sm text-mute touch:text-base">
          Download one file with everything the house holds about you. Erasing removes your data for
          good and signs you out.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="quiet" disabled={busy} onClick={download} data-testid="download-data">
            <Download className="size-4" aria-hidden /> Download my data
          </Button>
          {!confirming && (
            <Button
              variant="quiet"
              disabled={busy}
              onClick={() => setConfirming(true)}
              data-testid="erase-start"
            >
              <Trash2 className="size-4" aria-hidden /> Erase my data
            </Button>
          )}
        </div>
        {confirming && (
          <div
            className="mt-3 rounded-control bg-peach/50 p-4"
            role="alertdialog"
            aria-label="Confirm erase"
            data-testid="erase-confirm"
          >
            <p className="text-sm font-medium">Erase everything the house holds about you?</p>
            <p className="mt-1 text-sm text-ink touch:text-base">
              This cannot be undone. A short record that you agreed stays. You cannot join again
              with this email for 30 days.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button disabled={busy} onClick={eraseAll} data-testid="erase-yes">
                Yes, erase everything
              </Button>
              <Button variant="quiet" disabled={busy} onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
