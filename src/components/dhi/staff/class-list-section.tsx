import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { ChooseInstitute, Label, Outcome, useScope } from "@/components/dhi/staff/staff-parts";
import { parseClassList, type ClassListRow } from "@/lib/dhi/class-list";
import { badRowWords, codeOf, refusalWords } from "@/lib/dhi/house-words";

type BadRow = { row: number; reason: string };

// A class list (spec house/0002, AC-4): one student a line as name, Google email, class and under 18 yes or no. The whole list is checked
// together: if every row is fine every student is invited, and if any row is not, nobody is and each bad row says why. The class must already
// exist; a list never makes classes.
export function ClassListSection() {
  const scope = useScope();
  const send = useMutation(api.invites.createBatch);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ClassListRow[]>([]);
  const [bad, setBad] = useState<BadRow[]>([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  if (scope.needsInstitute) return <ChooseInstitute />;

  function read(value: string) {
    setText(value);
    setRows(parseClassList(value));
    setBad([]);
    setError("");
    setDone("");
  }

  async function pickFile(file: File | undefined) {
    if (!file) return;
    read(await file.text());
  }

  async function submit() {
    setError("");
    setDone("");
    setBad([]);
    setBusy(true);
    try {
      const result = await send({ rows, ...(scope.instituteId ? { instituteId: scope.instituteId } : {}) });
      if (result.ok) {
        setDone(`${result.count} ${result.count === 1 ? "student was" : "students were"} invited. They join by signing in with their Google email and pressing Join.`);
        setText("");
        setRows([]);
      } else {
        setError(refusalWords(result.code));
        setBad(result.badRows ?? []);
      }
    } catch (err) {
      setError(refusalWords(codeOf(err)));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <Card>
        <h2 className="text-sm font-semibold">Upload a class list</h2>
        <p className="mt-2 text-sm text-mute">
          One student a line: name, Google email, class and under 18 (yes or no). For example: Asha Rao, asha@school.edu, 10A, no. You can paste the list
          or choose a file saved as CSV. Up to 300 students at a time.
        </p>
        <div className="mt-3 grid gap-3">
          <Label text="Choose a CSV file">
            <input
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/plain"
              onChange={(e) => void pickFile(e.target.files?.[0])}
              className="block w-full min-w-0 text-sm file:mr-3 file:h-11 file:rounded-full file:border-0 file:bg-home file:px-5 file:text-sm file:font-medium file:text-paper"
              data-testid="class-list-file"
            />
          </Label>
          <Label text="Or paste the list here">
            <textarea
              value={text}
              onChange={(e) => read(e.target.value)}
              rows={7}
              spellCheck={false}
              placeholder={"Asha Rao, asha@school.edu, 10A, no\nMeera Iyer, meera@school.edu, 10A, yes"}
              className="block w-full min-w-0 rounded-control border border-home/20 bg-white px-3 py-2.5 font-mono text-sm text-home placeholder:text-mute"
              data-testid="class-list-text"
            />
          </Label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button onClick={submit} disabled={busy || rows.length === 0} data-testid="class-list-send" className="max-sm:w-full">
            {busy ? "Checking…" : rows.length === 0 ? "Invite students" : `Invite ${rows.length} ${rows.length === 1 ? "student" : "students"}`}
          </Button>
        </div>
        <div className="mt-3 empty:hidden">
          <Outcome error={error} done={done} />
        </div>
      </Card>

      {bad.length > 0 && (
        <Card data-testid="class-list-bad">
          <h2 className="text-sm font-semibold">Rows to fix ({bad.length})</h2>
          <p className="mt-1 text-sm text-mute">Nobody was invited. Fix these rows and send the list again.</p>
          <ul className="mt-3 space-y-2">
            {bad.map((b) => (
              <li key={b.row} className="rounded-control bg-white/80 px-3 py-2.5 text-sm">
                <p className="font-medium">
                  Row {b.row}
                  {rows[b.row - 1]?.name ? `: ${rows[b.row - 1].name}` : ""}
                </p>
                <p className="text-mute">{badRowWords(b.reason)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
