#!/usr/bin/env node
// `pnpm look:check`: stops the old look coming back (spec house/0003, AC-13). It scans src/**/*.{ts,tsx,css} for a hand typed colour or a free
// corner size, which belong in `@theme` in src/styles.css as a named token. Hits that existed when the check was added are recorded in
// scripts/look-check.baseline.json, so a room the look pass leaves alone does not fail. A new hit fails, and the count may only go down.
//   pnpm look:check            fail on any hit above the baseline
//   pnpm look:check --update   write the baseline (refuses to raise any count)
// A line that holds `look-ok: <reason>` is exempt. The `@theme` block and the `@keyframes` blocks of styles.css are exempt too, and so is
// the generated routeTree.gen.ts.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const CATEGORIES = ["hex", "color-function", "inline-style", "svg-paint", "rounded"];

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
const COLOR_FUNCTION = /\b(?:rgba?|hsla?)\(/g;
const SVG_PAINT = /\b(?:fill|stroke)=["']#[0-9a-fA-F]{3,8}["']/g;
const ROUNDED = /\brounded(?:-(?:t|r|b|l|s|e|tl|tr|br|bl|ss|se|es|ee))?-(?:\[[^\]]*\]|xl|2xl|3xl)(?![\w-])/g;
const STYLE_PROP = /\b(?:color|background(?:Color|Image)?|border(?:Top|Right|Bottom|Left)?Color|outlineColor|fill|stroke|boxShadow|textShadow)\s*:\s*(["'`])(?!var\()/;
const STYLE_ATTR = /style=\{\{([^}]*)\}\}/g;

function count(re, text) {
  return [...text.matchAll(re)].length;
}

/** Drops comments from one line so a note that quotes a colour does not count. */
function codeOf(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return "";
  return line.replace(/\/\*.*?\*\//g, "").replace(/\s\/\/\s[^"'`]*$/, "");
}

/** Counts the hits of one file's text by category. `isStyles` turns on the styles.css block exemptions. */
export function scanText(text, { isStyles = false } = {}) {
  const hits = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const lines = text.split("\n");
  let skipDepth = 0;
  let skipping = false;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (isStyles) {
      if (!skipping && /^\s*@(?:theme|keyframes)\b/.test(raw)) skipping = true;
      if (skipping) {
        skipDepth += count(/\{/g, raw) - count(/\}/g, raw);
        if (skipDepth <= 0 && raw.includes("}")) {
          skipping = false;
          skipDepth = 0;
        }
        continue;
      }
    }
    if (raw.includes("look-ok:")) continue;
    const line = codeOf(raw);
    if (!line) continue;

    const svg = count(SVG_PAINT, line);
    hits["svg-paint"] += svg;
    // An SVG paint hex is counted once, as svg-paint, not again as a plain hex.
    hits.hex += count(HEX, line.replace(SVG_PAINT, ""));
    hits["color-function"] += count(COLOR_FUNCTION, line);
    hits.rounded += count(ROUNDED, line);
  }

  // Inline `style={{ ... }}` can span lines, so it is scanned on the whole text. A `look-ok:` on the line it starts on exempts it.
  for (const match of text.matchAll(STYLE_ATTR)) {
    if (!STYLE_PROP.test(match[1])) continue;
    const startLine = text.slice(0, match.index).split("\n").length - 1;
    if (lines[startLine]?.includes("look-ok:")) continue;
    hits["inline-style"] += 1;
  }
  return hits;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else if (/\.(?:ts|tsx|css)$/.test(entry.name) && entry.name !== "routeTree.gen.ts") out.push(path);
  }
  return out;
}

/** Scans a folder and returns `{ "src/a.tsx": { hex: 2, rounded: 1 } }`, listing only files and categories with hits. */
export function scanTree(root, folder = "src") {
  const result = {};
  for (const file of walk(join(root, folder)).sort()) {
    const rel = relative(root, file).split(sep).join("/");
    const hits = scanText(readFileSync(file, "utf8"), { isStyles: rel === "src/styles.css" });
    const kept = Object.fromEntries(Object.entries(hits).filter(([, n]) => n > 0));
    if (Object.keys(kept).length) result[rel] = kept;
  }
  return result;
}

/** Compares a scan with the baseline: what went up (fails) and what went down (a note). */
export function compare(current, baseline) {
  const worse = [];
  const better = [];
  const files = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const file of [...files].sort()) {
    for (const category of CATEGORIES) {
      const now = current[file]?.[category] ?? 0;
      const before = baseline[file]?.[category] ?? 0;
      if (now > before) worse.push({ file, category, before, now });
      else if (now < before) better.push({ file, category, before, now });
    }
  }
  return { worse, better };
}

function main() {
  const root = process.cwd();
  const baselinePath = join(root, "scripts", "look-check.baseline.json");
  const current = scanTree(root);
  const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
  const { worse, better } = compare(current, baseline);

  if (process.argv.includes("--update")) {
    if (worse.length && existsSync(baselinePath)) {
      console.error("look:check: refusing to raise the baseline. Use a token from src/styles.css, or mark a one off line with `look-ok: <reason>`.");
      for (const w of worse) console.error(`  ${w.file}  ${w.category}  ${w.before} -> ${w.now}`);
      process.exit(1);
    }
    writeFileSync(baselinePath, JSON.stringify(current, null, 2) + "\n");
    const total = Object.values(current).reduce((n, c) => n + Object.values(c).reduce((a, b) => a + b, 0), 0);
    console.log(`look:check: baseline written (${total} hits in ${Object.keys(current).length} files).`);
    return;
  }

  if (worse.length) {
    console.error("look:check: new hand typed colours or corner sizes. Use a token from `@theme` in src/styles.css, or mark a one off picture colour with `look-ok: <reason>`.");
    for (const w of worse) console.error(`  ${w.file}  ${w.category}  ${w.before} -> ${w.now}`);
    process.exit(1);
  }
  if (better.length) {
    console.log("look:check: fewer hits than the baseline. Run `pnpm look:check --update` to lock the gain in.");
    for (const b of better) console.log(`  ${b.file}  ${b.category}  ${b.before} -> ${b.now}`);
  }
  const total = Object.values(current).reduce((n, c) => n + Object.values(c).reduce((a, b) => a + b, 0), 0);
  console.log(`look:check: ok (${total} hits, all within the baseline).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
