// The pure pieces of Your data (spec house/0005, AC-11, AC-12): the date a student sees in their access record, and the join of the download's
// pages into the one file the spec names.

// "2026-10-19" as "19 Oct 2026". The server sends an India day, so the label never moves with the device's time zone.
export function dayLabel(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return day;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type ExportSection = { section: string; rows: unknown[] };

type Header = { profile: unknown; consent: unknown; sharing: unknown; funnel: unknown };

// The pages come back as sections: the header once, then events in pages, then each room. The file is
// `{ schema, exportedAt, profile, consent, sharing, funnel, events: [{ type, day, id }], rooms: { <room>: [...] } }`. `funnel` holds the student's own
// DhiRise answers when they linked the check (`funnelLink.funnelExport`), and is null otherwise.
export function joinExport(schema: string, exportedAt: number, sections: ExportSection[]) {
  const header = (sections.find((s) => s.section === "header")?.rows[0] ?? {}) as Partial<Header>;
  const events = sections.filter((s) => s.section === "events").flatMap((s) => s.rows);
  const rooms: Record<string, unknown[]> = {};
  for (const s of sections) {
    if (s.section === "header" || s.section === "events") continue;
    rooms[s.section] = [...(rooms[s.section] ?? []), ...s.rows];
  }
  return { schema, exportedAt, profile: header.profile ?? null, consent: header.consent ?? [], sharing: header.sharing ?? null, funnel: header.funnel ?? null, events, rooms };
}
