import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { EXCEPTIONS, checkCatalog, parseCatalog } from "./check-catalog.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A throwaway workspace: a catalog and one package.json per part. */
function makeWorkspace({ catalog, parts }) {
  const root = mkdtempSync(join(tmpdir(), "check-catalog-"));
  const lines = Object.entries(catalog).map(([name, version]) => `  ${name}: ${version}`);
  writeFileSync(join(root, "pnpm-workspace.yaml"), `catalog:\n${lines.join("\n")}\nother: 1\n`);
  for (const [dir, json] of Object.entries(parts)) {
    const target = dir === "." ? root : join(root, dir);
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, "package.json"), JSON.stringify(json));
  }
  return root;
}

test("parseCatalog reads plain, quoted and commented entries and stops at the next key", () => {
  const text = [
    "packages:",
    '  - "apps/*"',
    "catalog:",
    "  vite: 8.3.3 # pinned",
    '  "@scope/lib": ~1.2.3',
    "  better-auth: '~1.6.33'",
    "minimumReleaseAge: 1440",
  ].join("\r\n");
  assert.deepEqual([...parseCatalog(text)], [
    ["vite", "8.3.3"],
    ["@scope/lib", "~1.2.3"],
    ["better-auth", "~1.6.33"],
  ]);
});

test("an honest workspace has no problems", () => {
  const root = makeWorkspace({
    catalog: { vite: "8.3.3" },
    parts: {
      ".": { name: "house", devDependencies: { vite: "catalog:", zod: "^4.0.0" } },
      "apps/joining": { name: "funnel", devDependencies: { vite: "catalog:" } },
    },
  });
  assert.deepEqual(checkCatalog(root), []);
});

test("a part that pins a catalog library directly is reported", () => {
  const root = makeWorkspace({
    catalog: { vite: "8.3.3" },
    parts: {
      ".": { name: "house", devDependencies: { vite: "catalog:" } },
      "apps/joining": { name: "funnel", devDependencies: { vite: "8.3.3" } },
    },
  });
  const problems = checkCatalog(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /apps\/joining: "vite" is pinned to 8\.3\.3/);
});

test('"catalog:" for a library the catalog does not name is reported', () => {
  const root = makeWorkspace({
    catalog: { vite: "8.3.3" },
    parts: { ".": { name: "house", dependencies: { "better-auth": "catalog:" } } },
  });
  assert.match(checkCatalog(root)[0], /"better-auth" uses "catalog:" but the catalog does not name/);
});

test("two parts on different versions of a library outside the catalog are reported", () => {
  const root = makeWorkspace({
    catalog: { vite: "8.3.3" },
    parts: {
      ".": { name: "house", dependencies: { zod: "^4.0.0" } },
      "apps/joining": { name: "funnel", dependencies: { zod: "^3.0.0" } },
    },
  });
  const problems = checkCatalog(root);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /"zod" is used at different versions/);
});

test("a listed exception may differ between parts", () => {
  assert.ok(EXCEPTIONS.has("typescript"));
  const root = makeWorkspace({
    catalog: { vite: "8.3.3" },
    parts: {
      ".": { name: "house", devDependencies: { typescript: "^5.7.0" } },
      "apps/joining": { name: "funnel", devDependencies: { typescript: "^7.0.2" } },
    },
  });
  assert.deepEqual(checkCatalog(root), []);
});

test("workspace: links are ignored", () => {
  const root = makeWorkspace({
    catalog: { vite: "8.3.3" },
    parts: {
      ".": { name: "house", dependencies: { "@dhi/engine": "workspace:*" } },
      "apps/joining": { name: "funnel", dependencies: { "@dhi/engine": "workspace:*" } },
    },
  });
  assert.deepEqual(checkCatalog(root), []);
});

test("this repository's own shared version list is honest", () => {
  assert.deepEqual(checkCatalog(REPO_ROOT), []);
});
