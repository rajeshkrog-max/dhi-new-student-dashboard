import { useState, type FormEvent } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Chip } from "@/components/dhi/ui/chip";
import { ChooseInstitute, Label, ListEmpty, Outcome, Pager, SelectInput, TextInput, useScope, type ClassId, type MemberId } from "@/components/dhi/staff/staff-parts";
import { codeOf, refusalWords } from "@/lib/dhi/house-words";

export const GRADES = ["Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "College"] as const;
type Grade = (typeof GRADES)[number];

// Classes (spec house/0002). An admin makes a class (a grade and a section), archives one nobody is in, and gives teachers their classes. A
// teacher only sees the classes they were given. Classes are never made by an upload.
export function ClassesSection() {
  const scope = useScope();
  const isAdmin = scope.role === "institute_admin" || scope.role === "dhi_admin";
  const args = scope.needsInstitute ? "skip" : { instituteId: scope.instituteId };
  const { results, status, loadMore } = usePaginatedQuery(api.classes.list, args, { initialNumItems: 25 });
  const create = useMutation(api.classes.create);
  const archive = useMutation(api.classes.archive);
  const [grade, setGrade] = useState<Grade>("Class 10");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [openTeachers, setOpenTeachers] = useState<ClassId | null>(null);

  if (scope.needsInstitute) return <ChooseInstitute />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setDone("");
    try {
      await create({ grade, section, ...(scope.instituteId ? { instituteId: scope.instituteId } : {}) });
      setDone(`Class ${section.trim()} added.`);
      setSection("");
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  async function doArchive(classId: ClassId) {
    setError("");
    setDone("");
    try {
      await archive({ classId });
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  return (
    <div className="space-y-3">
      {isAdmin && (
        <Card>
          <h2 className="text-sm font-semibold">Add a class</h2>
          <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" data-testid="class-form">
            <Label text="Grade">
              <SelectInput value={grade} onChange={(e) => setGrade(e.target.value as Grade)} data-testid="class-grade">
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </SelectInput>
            </Label>
            <Label text="Section">
              <TextInput value={section} onChange={(e) => setSection(e.target.value)} required maxLength={12} placeholder="A" data-testid="class-section" />
            </Label>
            <Button type="submit" data-testid="class-create" className="max-sm:w-full">
              Add
            </Button>
          </form>
          <div className="mt-3 empty:hidden">
            <Outcome error={error} done={done} />
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-semibold">{isAdmin ? "Classes" : "Your classes"}</h2>
        {!isAdmin && (
          <div className="mt-3 empty:hidden">
            <Outcome error={error} done={done} />
          </div>
        )}
        {status === "LoadingFirstPage" ? (
          <p className="mt-3 text-sm text-mute">Loading…</p>
        ) : results.length === 0 ? (
          <div className="mt-3">
            <ListEmpty>{isAdmin ? "No classes yet. Add the first one above." : "You have no classes yet. Your institute admin gives you your classes."}</ListEmpty>
          </div>
        ) : (
          <ul className="mt-3 space-y-2" data-testid="class-list">
            {results.map((c) => (
              <li key={c._id} className="rounded-control bg-white/80 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {c.grade} {c.section}
                  </p>
                  {c.archived && <Chip tone="gold">Closed</Chip>}
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button variant="quiet" aria-expanded={openTeachers === c._id} onClick={() => setOpenTeachers(openTeachers === c._id ? null : c._id)}>
                        Teachers
                      </Button>
                      {!c.archived && (
                        <Button variant="quiet" onClick={() => doArchive(c._id)} aria-label={`Close ${c.grade} ${c.section}`}>
                          Close
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {isAdmin && openTeachers === c._id && <ClassTeachers classId={c._id} archived={c.archived} />}
              </li>
            ))}
          </ul>
        )}
        <Pager status={status} onMore={() => loadMore(25)} />
      </Card>
    </div>
  );
}

// Who has this class, and a way to give it to another teacher of the institute.
function ClassTeachers({ classId, archived }: { classId: ClassId; archived: boolean }) {
  const scope = useScope();
  const assigned = usePaginatedQuery(api.classes.teachers, { classId }, { initialNumItems: 25 });
  const teachers = usePaginatedQuery(api.members.list, { role: "teacher", ...(scope.instituteId ? { instituteId: scope.instituteId } : {}) }, { initialNumItems: 25 });
  const assign = useMutation(api.classes.assignTeacher);
  const unassign = useMutation(api.classes.unassignTeacher);
  const [pick, setPick] = useState<MemberId | "">("");
  const [error, setError] = useState("");
  const taken = new Set(assigned.results.map((t) => t.memberId));
  const free = teachers.results.filter((t) => t.status === "active" && !taken.has(t._id));

  async function run(call: () => Promise<unknown>) {
    setError("");
    try {
      await call();
      setPick("");
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t border-home/10 pt-3" data-testid="class-teachers">
      {assigned.results.length === 0 ? (
        <p className="text-sm text-mute">No teacher has this class yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {assigned.results.map((t) => (
            <li key={t.memberId} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{t.name}</span>
              <Button variant="quiet" onClick={() => run(() => unassign({ classId, memberId: t.memberId }))} aria-label={`Take ${t.name} off this class`}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!archived && (
        <div className="flex flex-wrap items-end gap-2">
          <Label text="Give this class to" className="min-w-40 flex-1">
            <SelectInput value={pick} onChange={(e) => setPick(e.target.value as MemberId)} data-testid="teacher-pick">
              <option value="">Choose a teacher</option>
              {free.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </SelectInput>
          </Label>
          <Button disabled={!pick} onClick={() => pick && run(() => assign({ classId, memberId: pick }))} data-testid="teacher-assign">
            Give
          </Button>
        </div>
      )}
      {error && <Outcome error={error} done="" />}
    </div>
  );
}
