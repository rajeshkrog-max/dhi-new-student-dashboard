import { useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Chip } from "@/components/dhi/ui/chip";
import { ListEmpty, Label, Outcome, Pager, TextInput, type InstituteId } from "@/components/dhi/staff/staff-parts";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

// Institutes, for a DHI admin only (spec house/0002). Create one, open it to work in it, and pause or resume it. A paused institute locks all
// its members out at once; the DHI admin can still see it and resume it.
export function InstitutesSection({ onOpen, openId }: { onOpen: (id: InstituteId, name: string) => void; openId: InstituteId | undefined }) {
  const { results, status, loadMore } = usePaginatedQuery(api.institutes.list, {}, { initialNumItems: 25 });
  const create = useMutation(api.institutes.create);
  const update = useMutation(api.institutes.update);
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    setBusy(true);
    try {
      const made = await create({ name, ...(plan.trim() ? { plan } : {}) });
      onOpen(made.instituteId, name.trim());
      setDone("Institute created and opened. Next, invite its first admin under Invites.");
      setName("");
      setPlan("");
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
    setBusy(false);
  }

  async function setStatus(instituteId: InstituteId, next: "active" | "suspended") {
    setError("");
    setDone("");
    try {
      await update({ instituteId, status: next });
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-sm font-semibold">Add an institute</h2>
        <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" data-testid="institute-form">
          <Label text="Name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} placeholder="Greenfield School" data-testid="institute-name" />
          </Label>
          <Label text="Plan (optional)">
            <TextInput value={plan} onChange={(e) => setPlan(e.target.value)} maxLength={40} placeholder="Pilot" />
          </Label>
          <Button type="submit" disabled={busy} data-testid="institute-create" className="max-sm:w-full">
            {busy ? "Adding…" : "Add"}
          </Button>
        </form>
        <div className="mt-3 empty:hidden">
          <Outcome error={error} done={done} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">All institutes</h2>
        {status === "LoadingFirstPage" ? (
          <p className="mt-3 text-sm text-mute">Loading…</p>
        ) : results.length === 0 ? (
          <div className="mt-3">
            <ListEmpty>No institutes yet. Add the first one above.</ListEmpty>
          </div>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="institute-list">
            {results.map((i) => (
              <li key={i._id} className="flex flex-wrap items-center gap-3 rounded-control bg-white/80 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.name}</p>
                  <p className="text-xs text-mute touch:text-sm">{i.plan ?? "No plan label"}</p>
                </div>
                <Chip tone={i.status === "active" ? "mint" : "gold"}>{i.status === "active" ? "Active" : "Paused"}</Chip>
                <div className="flex gap-2">
                  <Button variant="quiet" onClick={() => onOpen(i._id, i.name)} disabled={openId === i._id} aria-label={`Open ${i.name}`}>
                    {openId === i._id ? "Opened" : "Open"}
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => setStatus(i._id, i.status === "active" ? "suspended" : "active")}
                    aria-label={`${i.status === "active" ? "Pause" : "Resume"} ${i.name}`}
                  >
                    {i.status === "active" ? "Pause" : "Resume"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager status={status} onMore={() => loadMore(25)} />
      </Card>
    </div>
  );
}
