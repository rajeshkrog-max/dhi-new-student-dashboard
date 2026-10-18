// Copies the two shared engine scripts from packages/engine/ into public/dhiinterviews/js/engine/, so the pages keep loading
// them from the same public addresses as before (spec 0001, child 0002). The copies are generated and git ignored: edit the
// files in packages/engine/, never the copies. The backend runs the very same two files (scoring on the server).
//   node scripts/sync-engine.mjs           copy what is missing or differs (dev, build and test run this first)
//   node scripts/sync-engine.mjs --check   change nothing; exit 1 when a copy is missing or differs
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ENGINE_FILES = ["questions.js", "score.js"];
export const SOURCE_DIR = new URL("../../../packages/engine/", import.meta.url);
export const COPY_DIR = new URL("../public/dhiinterviews/js/engine/", import.meta.url);

// One entry per file: "ok", "missing" (no copy) or "differs" (a copy that is not the package's file, byte for byte).
export function engineStatus() {
  return ENGINE_FILES.map((file) => {
    const copy = new URL(file, COPY_DIR);
    const state = !existsSync(copy) ? "missing" : readFileSync(copy).equals(readFileSync(new URL(file, SOURCE_DIR))) ? "ok" : "differs";
    return { file, state };
  });
}

export function syncEngine() {
  mkdirSync(COPY_DIR, { recursive: true });
  const copied = [];
  for (const { file, state } of engineStatus()) {
    if (state === "ok") continue;
    copyFileSync(new URL(file, SOURCE_DIR), new URL(file, COPY_DIR));
    copied.push(file);
  }
  return copied;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--check")) {
    const bad = engineStatus().filter((s) => s.state !== "ok");
    for (const s of bad) console.error(`public/dhiinterviews/js/engine/${s.file} is ${s.state}. Run: pnpm --filter dhirise sync:engine`);
    process.exit(bad.length ? 1 : 0);
  }
  const copied = syncEngine();
  if (copied.length) console.log(`Copied from packages/engine: ${copied.join(", ")}`);
}
