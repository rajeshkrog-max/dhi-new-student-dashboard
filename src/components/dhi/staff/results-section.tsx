// Results, for institute admins (spec house/0011, AC-7): the confirmed marks and remarks of the students of one class, and never an answer. Named
// results open through a mutation (house spec 0005): each open leaves a record the student can see in Your data, so the screen opens when a class
// is chosen and when the admin asks again, and it is not live.
import { useCallback, useEffect, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { GenericId } from "convex/values";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { Label, NoClassYet, SelectInput, useScope } from "@/components/dhi/staff/staff-parts";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

export function ResultsSection() {
  const scope = useScope();
  const classes = usePaginatedQuery(api.classes.list, scope.needsInstitute ? "skip" : { instituteId: scope.instituteId }, { initialNumItems: 50 });
  const [classId, setClassId] = useState<GenericId<"classes"> | "">("");

  return (
    <div className="space-y-5" data-testid="results-section">
      <Card>
        <Label text="Class">
          <SelectInput data-testid="results-class" value={classId} onChange={(e) => setClassId(e.target.value as GenericId<"classes">)}>
            <option value="">Choose a class</option>
            {classes.results.map((c) => (
              <option key={c._id} value={c._id}>
                {c.grade} {c.section}
              </option>
            ))}
          </SelectInput>
          <NoClassYet status={classes.status} count={classes.results.length} />
        </Label>
      </Card>
      {/* Keyed by the class, so choosing another class starts from its first page instead of asking for the old page number of the new class. */}
      {classId && <ClassResults key={classId} classId={classId} />}
    </div>
  );
}

function ClassResults({ classId }: { classId: GenericId<"classes"> }) {
  const open = useMutation(api.papers.resultsForClass);
  const [view, setView] = useState<FunctionReturnType<typeof api.papers.resultsForClass> | null>(null);
  const [page, setPage] = useState(0);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setView(await open({ classId, page }));
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }, [open, classId, page]);
  useEffect(() => {
    void load();
  }, [load]);

  const pages = view ? Math.max(1, Math.ceil(view.total / 50)) : 1;
  return (
    <Card className="space-y-3" data-testid="class-results">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Confirmed marks</h2>
        <Button variant="quiet" onClick={load}>
          Refresh
        </Button>
      </div>
      <p className="text-xs text-mute">Each time this page opens, the students shown can see in Your data that a school admin looked at their results. Answers are never shown here.</p>
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      {view && view.students.length === 0 && <p className="text-sm text-mute">No students to show for this class.</p>}
      {view?.students.map((s, i) => (
        <div key={`${s.name}-${i}`} className="rounded-control border border-home/15 bg-white/70 p-3" data-testid="result-student">
          <p className="text-sm font-medium">{s.name}</p>
          {s.papers.length === 0 ? (
            <p className="text-xs text-mute">No confirmed marks yet.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm">
              {s.papers.map((p, i) => (
                <li key={i}>
                  {p.title}: {p.total} of {p.maxTotal}
                  {p.remarks ? `. ${p.remarks}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      {pages > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <Button variant="quiet" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous 50
          </Button>
          <span className="text-xs text-mute">
            Page {page + 1} of {pages}
          </span>
          <Button variant="quiet" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
            Next 50
          </Button>
        </div>
      )}
    </Card>
  );
}
