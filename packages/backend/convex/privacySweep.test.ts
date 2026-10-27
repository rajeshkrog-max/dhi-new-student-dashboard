/// <reference types="vite/client" />
// The privacy sweep of the production run (Phase 2). Free text in events is refused by the registry itself (eventLog.test.ts, AC-8), and the parent
// page by `weekOf` (parentSharing.test.ts). This file adds two scans:
//   1. Every house table the data map marks `erased` (a person's own rows) is read by an exporter, so the download holds what the erase deletes
//      (a student's in `exportMine` and the room exporters, a staff member's in `exportStaffMine`).
//   2. A log line in a house file carries counts only: every value put into it is a `.length` or a named count, never a name, an email or a text.
import { describe, expect, test } from "vitest";
import { DATA_MAP } from "./dataMap";

const NO_STAFF_DOWNLOAD = new Set<string>();
const COUNTS = new Set(["mismatches", "checked", "erased", "skipped"]);

const files = import.meta.glob("./*.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const house = Object.entries(files).filter(([name, text]) => !name.endsWith(".test.ts") && /require(Member|MemberAllowLocked|DhiAdmin)\(|recordEvent\(|internalMutation/.test(text) && /houseAuth|eventLog|eraseCore|brainRollup|retention/.test(text));

describe("the privacy sweep", () => {
  test("every house table of a person's own rows is read by an exporter", () => {
    const exporters = Object.entries(files)
      .filter(([name]) => /Room\.ts$/.test(name) || ["./dataRights.ts", "./eventData.ts", "./funnelLink.ts"].includes(name))
      .map(([name, text]) => (/Room\.ts$/.test(name) ? text.split(/eraser:/)[0] : text.split(/export const eraseMine/)[0]))
      .join("\n");
    const erased = Object.entries(DATA_MAP).filter(([, e]) => e.owner === "house" && e.class === "erased").map(([table]) => table);
    expect(erased.length).toBeGreaterThan(15);
    const missing = erased.filter((table) => !NO_STAFF_DOWNLOAD.has(table) && !new RegExp(`["']${table}["']`).test(exporters));
    expect(missing, `erased but never exported: ${missing.join(", ")}`).toEqual([]);
  });

  test("a house log line carries counts only", () => {
    expect(house.length).toBeGreaterThan(20);
    for (const [name, text] of house) {
      for (const line of text.split("\n").filter((l) => /console\.(log|warn|error|info)\(/.test(l) && !l.trim().startsWith("//"))) {
        for (const m of line.matchAll(/\$\{([^}]+)\}/g)) {
          const expr = m[1].trim();
          expect(expr.endsWith(".length") || COUNTS.has(expr), `${name} logs \${${expr}}`).toBe(true);
        }
        expect(/console\.\w+\([^`]*,/.test(line), `${name} logs a value next to its message`).toBe(false);
      }
    }
  });
});
