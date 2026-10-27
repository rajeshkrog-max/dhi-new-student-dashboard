// A staff member's own data (dataRights.exportStaffMine): one file with who they are, their classes, the papers they built, their films and their
// own actions. Nothing of a student's is in it; a student's marks are in the student's own download.
import { useState } from "react";
import { Download } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@dhi/backend/api";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Outcome } from "@/components/dhi/staff/staff-parts";
import { refusalWords } from "@/lib/dhi/house-words";

export function StaffDataSection() {
  const exportMine = useMutation(api.dataRights.exportStaffMine);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function download() {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const r = await exportMine({});
      if (!r.ok) {
        setError(refusalWords(r.code));
        return;
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(r.file, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "dhi-my-staff-data.json";
      a.click();
      URL.revokeObjectURL(url);
      setDone("Your file is downloaded.");
    } catch {
      setError("The download did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3" data-testid="staff-data">
      <h2 className="text-sm font-semibold">Your data</h2>
      <p className="text-sm text-mute touch:text-base">
        One file with what the house holds about you as staff: your profile, your classes, the papers you built, your films, and the dates of what
        you did. A student's answers and marks are not in it; they belong to the student.
      </p>
      <Button variant="quiet" disabled={busy} onClick={download} data-testid="staff-download">
        <Download className="size-4" aria-hidden /> Download my data
      </Button>
      <div className="empty:hidden">
        <Outcome error={error} done={done} />
      </div>
    </Card>
  );
}
