// A teacher's page for one student of their class (house spec 0026): every paper sent to them, newest first, with its confirmed mark and remarks,
// or whether it was missed, excused or is still waiting. Never an answer and nothing from a room. It opens through a mutation because it is named
// data: the student sees the look in Your data, so it loads when the teacher opens it, not live.
import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Sheet } from "@/components/dhi/sheet";
import { Button } from "@/components/dhi/ui/button";
import { Notice } from "@/components/dhi/ui/notice";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";
import { STAFF_WORDS } from "@/lib/dhi/staff-words";

type Page = FunctionReturnType<typeof api.papers.studentForTeacher>;
const day = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

export function StudentPapers({ memberId, name, onClose }: { memberId: GenericId<"members">; name: string; onClose: () => void }) {
  const open = useMutation(api.papers.studentForTeacher);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    open({ memberId })
      .then((p) => live && setPage(p))
      .catch((err) => live && setError(refusalWords(codeOf(err))));
    return () => {
      live = false;
    };
  }, [open, memberId]);

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()} side="right" title={STAFF_WORDS.studentTitle(name)}>
      <div className="space-y-3" data-testid="student-papers">
        <p className="text-xs text-mute">{STAFF_WORDS.studentLook}</p>
        {error && (
          <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
            {error}
          </Notice>
        )}
        {!page && !error && <p className="text-sm text-mute">{STAFF_WORDS.loading}</p>}
        {page && <p className="text-sm">{page.className}</p>}
        {page && page.papers.length === 0 && <p className="text-sm text-mute">{STAFF_WORDS.noPapers}</p>}
        {page && page.papers.length > 0 && (
          <ul className="space-y-2">
            {page.papers.map((p, i) => (
              <li key={i} className="rounded-control border border-home/15 bg-white/70 p-3 text-sm" data-testid="student-paper">
                <p className="font-medium">{p.title}</p>
                <p className="text-xs text-mute">{STAFF_WORDS.due(day(p.dueAt))}</p>
                <p>{p.state === "confirmed" ? STAFF_WORDS.mark(p.total, p.maxTotal) : STAFF_WORDS.state[p.state]}</p>
                {p.remarks && <p className="text-xs whitespace-pre-line">{p.remarks}</p>}
              </li>
            ))}
          </ul>
        )}
        <Button variant="quiet" onClick={onClose} data-testid="student-papers-close">
          {STAFF_WORDS.close}
        </Button>
      </div>
    </Sheet>
  );
}
