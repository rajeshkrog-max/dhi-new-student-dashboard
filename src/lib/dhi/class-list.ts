// Reads a class list a teacher or admin pastes or uploads (spec house/0002, AC-4): one student a line, as name, Google email, class and under 18
// yes or no. It only turns text into rows. Whether a row is good (a real name, a free email, a class of the institute) is the server's
// decision, so a row that is short or odd is passed on with what is there and the server names the reason.

export type ClassListRow = { name: string; email: string; class: string; under18: boolean | null };

// A comma, a semicolon or a tab, by whichever the first line uses most. Spreadsheets give commas or semicolons, and a paste from one gives tabs.
function delimiterOf(line: string): string {
  const counts: [string, number][] = [
    ["\t", line.split("\t").length],
    [";", line.split(";").length],
    [",", line.split(",").length],
  ];
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

// One line into cells. A cell in double quotes may hold the delimiter, and "" inside quotes is one quote.
export function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

export function parseUnder18(raw: string | undefined): boolean | null {
  const word = (raw ?? "").trim().toLowerCase();
  if (["yes", "y", "true", "1", "under 18", "minor"].includes(word)) return true;
  if (["no", "n", "false", "0", "18 or over", "adult"].includes(word)) return false;
  return null;
}

const looksLikeHeader = (cells: string[]) => /^(student\s*)?name$/i.test(cells[0] ?? "") && /mail/i.test(cells[1] ?? "");

export function parseClassList(text: string): ClassListRow[] {
  // A spreadsheet export may start with a byte order mark (U+FEFF); drop it so the first cell reads cleanly.
  const plain = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = plain.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const delimiter = delimiterOf(lines[0]);
  const rows = lines.map((l) => splitLine(l, delimiter));
  const body = looksLikeHeader(rows[0]) ? rows.slice(1) : rows;
  return body.map((cells) => ({ name: cells[0] ?? "", email: cells[1] ?? "", class: cells[2] ?? "", under18: parseUnder18(cells[3]) }));
}
