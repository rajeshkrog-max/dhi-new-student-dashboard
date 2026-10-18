// Deploys the house Worker (spec 0004, spec 0008): `pnpm deploy:house`. It never reads .env.local for the build. It builds with the production
// Convex address and the test sign in off, refuses to continue if the build holds the development address or a sign in switch that is on,
// removes the local only `.dev.vars` the build writes, and then runs `wrangler deploy`. Extra arguments go to wrangler (for example
// `--dry-run`). The routes that put the house on dhirise.com are in wrangler.jsonc.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const PRODUCTION_CONVEX_URL = "https://abundant-caiman-975.convex.cloud";
const DEVELOPMENT_DEPLOYMENT = "proper-camel-616";

function run(command, args, env = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true, env: { ...process.env, ...env } });
  if (result.status !== 0) {
    console.error(`deploy-house: \`${command} ${args.join(" ")}\` failed.`);
    process.exit(result.status ?? 1);
  }
}

function filesUnder(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

console.log("deploy-house: building for production");
run("pnpm", ["build"], { PUBLIC_CONVEX_URL: PRODUCTION_CONVEX_URL, VITE_TEST_SIGNIN: "false" });

rmSync("dist/server/.dev.vars", { force: true });

for (const dir of ["dist/client", "dist/server"]) {
  if (!existsSync(dir)) {
    console.error(`deploy-house: ${dir} is missing after the build.`);
    process.exit(1);
  }
}
const texts = [...filesUnder("dist/client"), ...filesUnder("dist/server")]
  .filter((f) => /\.(js|mjs|json|html|css)$/.test(f))
  .map((f) => ({ f, text: readFileSync(f, "utf8") }));
if (!texts.some((t) => t.text.includes(PRODUCTION_CONVEX_URL))) {
  console.error("deploy-house: the build does not hold the production Convex address. Not deploying.");
  process.exit(1);
}
const bad = texts.filter((t) => t.text.includes(DEVELOPMENT_DEPLOYMENT) || /VITE_TEST_SIGNIN\W{0,6}true/.test(t.text));
if (bad.length) {
  console.error(`deploy-house: the build holds the development address or an enabled test sign in (${bad.map((b) => b.f).join(", ")}). Not deploying.`);
  process.exit(1);
}

console.log("deploy-house: build is clean, deploying the Worker");
run("pnpm", ["exec", "wrangler", "deploy", ...process.argv.slice(2)]);
