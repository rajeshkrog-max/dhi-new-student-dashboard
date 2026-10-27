// The DHI admin's overview (house spec 0026): one row an institute, counts only. No names and nothing from a student's rooms.
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { Card } from "@/components/dhi/ui/card";
import { STAFF_WORDS, STAFF_WORDS_APPROVED } from "@/lib/dhi/staff-words";

export function OverviewSection() {
  const [now] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  const rows = useQuery(api.staffHome.overview, { now });
  const c = STAFF_WORDS.cols;
  return (
    <div className="space-y-4" data-testid="staff-overview">
      {!STAFF_WORDS_APPROVED && <p className="text-xs text-mute">{STAFF_WORDS.draft}</p>}
      <Card className="space-y-3">
        <p className="text-sm text-mute">{STAFF_WORDS.overviewIntro}</p>
        {rows === undefined ? (
          <p className="text-sm text-mute">{STAFF_WORDS.loading}</p>
        ) : (
          <div className="overflow-x-auto focus-visible:focus-ring" data-scroll-x tabIndex={0} role="region" aria-label={STAFF_WORDS.overviewTitle}>
            <table className="w-full text-sm" data-testid="overview-table">
              <thead>
                <tr className="text-left text-xs text-mute">
                  {[c.name, c.status, c.classes, c.students, c.staff, c.invites, c.papers, c.desk].map((h) => (
                    <th key={h} className="py-1 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.instituteId} className="border-t border-home/10">
                    <td className="py-1 pr-3 whitespace-nowrap">{r.name}</td>
                    <td className="py-1 pr-3">{STAFF_WORDS.status[r.status] ?? r.status}</td>
                    <td className="py-1 pr-3">{r.classes}</td>
                    <td className="py-1 pr-3">{r.students}</td>
                    <td className="py-1 pr-3">{r.staff}</td>
                    <td className="py-1 pr-3">{r.invitesPending}</td>
                    <td className="py-1 pr-3">{r.papersThisMonth}</td>
                    <td className="py-1 pr-3">{r.deskThisMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
