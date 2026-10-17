#!/usr/bin/env node
/**
 * Keeps the shared version list honest (spec 0006, AC-6; the list itself is spec 0005).
 *
 * `pnpm-workspace.yaml` names one version for each library both parts use, under `catalog:`.
 * This check fails when:
 *   - a part pins a catalog library directly instead of writing "catalog:",
 *   - a part writes "catalog:" for a library the catalog does not name,
 *   - two parts use the same library at different versions and it is neither in the catalog
 *     nor in EXCEPTIONS below.
 *
 *   node scripts/check-catalog.mjs
 *
 * Exit 0 when the list is honest, 1 with one line per problem otherwise.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Libraries allowed to differ between parts, each with the reason. Remove an entry once the
 * library joins the catalog (spec 0005's first thin thread settles both of these).
 */
export const EXCEPTIONS = new Map([
  ["typescript", "house on 5, funnel on 7: settled in spec 0005's first thin thread"],
  ["@types/node", "house on 22, funnel on 26: settled in spec 0005's first thin thread"],
]);

const DEPENDENCY_SECTIONS = ["dependencies", "devDependencies", "optionalDependencies"];

/** The `catalog:` map of a pnpm-workspace.yaml, as name to version. Only the plain default catalog. */
export function parseCatalog(yamlText) {
  const catalog = new Map();
  let inside = false;
  for (const raw of yamlText.split(/\r?\n/)) {
    if (/^catalog:\s*$/.test(raw)) {
      inside = true;
      continue;
    }
    if (!inside) continue;
    if (/^\S/.test(raw)) break; // the next top level key ends the block
    const line = raw.replace(/\s+#.*$/, "");
    const match = /^\s+("[^"]+"|'[^']+'|[^\s:]+)\s*:\s*(.+?)\s*$/.exec(line);
    if (!match) continue;
    const unquote = (value) => value.replace(/^(["'])(.*)\1$/, "$2");
    catalog.set(unquote(match[1]), unquote(match[2]));
  }
  return catalog;
}

/** Every package.json in the workspace: the root project, apps/*, packages/*. */
export function workspaceManifests(root) {
  const manifests = [];
  const add = (dir, label) => {
    const file = join(dir, "package.json");
    if (existsSync(file)) manifests.push({ label, json: JSON.parse(readFileSync(file, "utf8")) });
  };
  add(root, "root");
  for (const group of ["apps", "packages"]) {
    const base = join(root, group);
    if (!existsSync(base)) continue;
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory()) add(join(base, entry.name), `${group}/${entry.name}`);
    }
  }
  return manifests;
}

/** The problems found, one string each. An empty list means the shared version list is honest. */
export function checkCatalog(root) {
  const workspaceFile = join(root, "pnpm-workspace.yaml");
  if (!existsSync(workspaceFile)) return ["pnpm-workspace.yaml is missing"];
  const catalog = parseCatalog(readFileSync(workspaceFile, "utf8"));
  const problems = [];
  const used = new Map(); // library -> Map(version -> [parts])

  for (const { label, json } of workspaceManifests(root)) {
    for (const section of DEPENDENCY_SECTIONS) {
      for (const [name, version] of Object.entries(json[section] ?? {})) {
        if (version === "catalog:") {
          if (!catalog.has(name)) {
            problems.push(`${label}: "${name}" uses "catalog:" but the catalog does not name it`);
          }
          continue;
        }
        if (version.startsWith("workspace:")) continue;
        if (catalog.has(name) && !EXCEPTIONS.has(name)) {
          problems.push(`${label}: "${name}" is pinned to ${version}, write "catalog:" instead`);
          continue;
        }
        if (!used.has(name)) used.set(name, new Map());
        const versions = used.get(name);
        versions.set(version, [...(versions.get(version) ?? []), label]);
      }
    }
  }

  for (const [name, versions] of used) {
    if (versions.size < 2 || catalog.has(name) || EXCEPTIONS.has(name)) continue;
    const detail = [...versions].map(([v, parts]) => `${parts.join(" and ")} on ${v}`).join(", ");
    problems.push(
      `"${name}" is used at different versions (${detail}): add it to the catalog or to EXCEPTIONS`,
    );
  }
  return problems;
}

function main() {
  const root = join(fileURLToPath(import.meta.url), "..", "..");
  const problems = checkCatalog(root);
  if (problems.length === 0) {
    console.log("check-catalog: the shared version list is honest");
    return;
  }
  for (const problem of problems) console.error(`check-catalog: ${problem}`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
