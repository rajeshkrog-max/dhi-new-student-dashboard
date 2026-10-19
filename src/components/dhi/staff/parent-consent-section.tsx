import { useState } from "react";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Chip } from "@/components/dhi/ui/chip";
import { Notice } from "@/components/dhi/ui/notice";
import { Label, ListEmpty, Outcome, Pager, SelectInput, type ClassId, type MemberId } from "@/components/dhi/staff/staff-parts";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

type RecordResult = FunctionReturnType<typeof api.consent.recordParent>;
type Status = "needed" | "onFile" | "schoolWithdrew";
const STATUS_WORDS: Record<Status, string> = { needed: "Not recorded", onFile: "On file", schoolWithdrew: "Withdrawn by school" };
const SKIP_WORDS: Record<string, string> = {
  adult: "marked 18 or over",
  other_institute: "not in this institute",
  already_on_file: "already on file",
  removed: "paused",
};

// Parent consent (spec house/0005, AC-3, AC-5, AC-20). Only an institute admin sees this. The school says that a parent's written consent is on
// file, for one student or a whole class, or that a parent withdrew it. The house stores who, when and which wording, and nothing about the
// parent. The list shows only the school's own side, never a student's own withdrawal.
export function ParentConsentSection() {
  const notice = useQuery(api.consent.parentNotice, {});
  const classes = usePaginatedQuery(api.classes.list, {}, { initialNumItems: 25 });
  const [classId, setClassId] = useState<ClassId | "">("");
  const [status, setStatus] = useState<Status | "">("");
  const list = usePaginatedQuery(
    api.consent.parentList,
    { ...(classId ? { classId } : {}), ...(status ? { status } : {}) },
    { initialNumItems: 25 },
  );
  const record = useMutation(api.consent.recordParent);
  const withdrew = useMutation(api.consent.recordParentWithdrawn);
  const restored = useMutation(api.consent.recordParentRestored);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(call: () => Promise<{ ok: boolean; code?: string } | unknown>, ok: (r: unknown) => string) {
    setError("");
    setDone("");
    setBusy(true);
    try {
      const r = (await call()) as { ok?: boolean; code?: string } | undefined;
      if (r && r.ok === false) setError(refusalWords(r.code));
      else setDone(ok(r));
    } catch (e) {
      setError(refusalWords(codeOf(e)));
    }
    setBusy(false);
  }

  // A whole class, 50 at a time, until the server says it is done.
  async function recordClass() {
    if (!classId) return;
    setError("");
    setDone("");
    setBusy(true);
    try {
      let cursor: string | null = null;
      let recorded = 0;
      const skipped: Record<string, number> = {};
      for (let i = 0; i < 100; i++) {
        const r: RecordResult = await record({ classId, cursor });
        if (!r.ok) {
          setError(refusalWords(r.code));
          setBusy(false);
          return;
        }
        recorded += r.recorded;
        for (const s of r.skipped) skipped[s.reason] = (skipped[s.reason] ?? 0) + 1;
        if (r.isDone) break;
        cursor = r.continueCursor;
      }
      const skips = Object.entries(skipped).map(([k, n]) => `${n} ${SKIP_WORDS[k] ?? k}`);
      setDone(`Recorded for ${recorded} student${recorded === 1 ? "" : "s"}.${skips.length ? ` Left out: ${skips.join(", ")}.` : ""}`);
    } catch (e) {
      setError(refusalWords(codeOf(e)));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-sm font-semibold">What the school says</h2>
        {(!notice || !notice.approved) && (
          <Notice tone="danger" data-testid="draft-mark" className="mt-2 px-4 py-3 text-sm">
            Draft words. The owner has not approved them, and a legal check on a school recording a parent&apos;s consent is still owed. Use only people made up for testing.
          </Notice>
        )}
        <div className="mt-3 min-h-52 space-y-2 rounded-control border border-home/15 bg-white/80 p-4 text-sm touch:text-base" data-testid="parent-words">
          {notice ? notice.lines.map((l, i) => <p key={i}>{l}</p>) : <p className="text-mute">Loading…</p>}
        </div>
        <p className="mt-2 text-xs text-mute touch:text-sm">Press Record only when the parent or guardian&apos;s written consent is on file at your school. DHI keeps who recorded it, when and which wording, and nothing about the parent.</p>
      </Card>

      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label text="Class">
            <SelectInput value={classId} onChange={(e) => setClassId(e.target.value as ClassId | "")} data-testid="parent-class">
              <option value="">All classes</option>
              {classes.results.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.grade} {c.section}
                </option>
              ))}
            </SelectInput>
          </Label>
          <Label text="Show">
            <SelectInput value={status} onChange={(e) => setStatus(e.target.value as Status | "")} data-testid="parent-status">
              <option value="">Everyone under 18</option>
              <option value="needed">Not recorded</option>
              <option value="onFile">On file</option>
              <option value="schoolWithdrew">Withdrawn by school</option>
            </SelectInput>
          </Label>
        </div>
        {classId && (
          <div className="mt-3">
            <Button disabled={busy} onClick={recordClass} data-testid="record-class">
              Record consent for this whole class
            </Button>
          </div>
        )}
        <div className="mt-3 empty:hidden">
          <Outcome error={error} done={done} />
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold">Students under 18</h2>
        {list.status === "LoadingFirstPage" ? (
          <p className="mt-3 text-sm text-mute">Loading…</p>
        ) : list.results.length === 0 ? (
          <div className="mt-3">
            <ListEmpty>No students under 18 here yet.</ListEmpty>
          </div>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="parent-list">
            {list.results.map((s) => (
              <li key={s.memberId} className="rounded-control bg-white/80 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    {s.className && <p className="truncate text-xs text-mute touch:text-sm">{s.className}</p>}
                  </div>
                  <Chip tone={s.status === "onFile" ? "mint" : s.status === "needed" ? "gold" : "lilac"}>{STATUS_WORDS[s.status]}</Chip>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.status === "needed" && (
                    <Button disabled={busy} aria-label={`Record consent for ${s.name}`} onClick={() => run(() => record({ memberIds: [s.memberId as MemberId] }), () => `Recorded for ${s.name}.`)}>
                      Record consent
                    </Button>
                  )}
                  {s.status === "onFile" && (
                    <Button variant="quiet" disabled={busy} aria-label={`Record that a parent of ${s.name} withdrew`} onClick={() => run(() => withdrew({ memberId: s.memberId as MemberId }), () => `Withdrawal recorded for ${s.name}.`)}>
                      Parent withdrew
                    </Button>
                  )}
                  {s.status === "schoolWithdrew" && (
                    <Button variant="quiet" disabled={busy} aria-label={`Record that a parent of ${s.name} restored consent`} onClick={() => run(() => restored({ memberId: s.memberId as MemberId }), () => `Consent restored for ${s.name}.`)}>
                      Parent restored
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pager status={list.status} onMore={() => list.loadMore(25)} />
      </Card>
    </div>
  );
}
