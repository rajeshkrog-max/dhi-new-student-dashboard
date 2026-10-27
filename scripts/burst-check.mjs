// Burst proof for the busy moments (production run, Phase 2): many calls at once must end in a normal answer or a plain refusal (`rate_limited`,
// HTTP 429), never a server error. Against the dev server and the development backend only:
//   pnpm dev, then pnpm burst:check
// 1. Sign in: 30 wrong password sign ins at once through the dev proxy. Expect 401 or 429, never 5xx.
// 2. The desk: a fresh made up student asks one question (one real model call on the development key), then sends the same question 40 times at once.
//    Expect stored answers, `rate_limited` and `busy` (a conflict out of retries, nothing taken), never a thrown server error, and the coins never
//    below zero.
// 3. The study hour: the same student sits, then sends 30 heartbeats and 30 chat messages at once. Expect ok or `rate_limited`, never a server error.
// Needs the demo institute, VITE_TEST_SIGNIN=true in .env.local, TEST_SIGNIN_ENABLED on the development deployment and an open hour
// (`npx convex run hourProof:openNow '{"minutes":30}'`). It refuses production and any address that is not this machine.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@dhi/backend/api";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudent } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("burst-check", argUrl);
const convexUrl = /^PUBLIC_CONVEX_URL=(.+)$/m.exec(readFileSync(".env.local", "utf8"))?.[1]?.trim() ?? "";
if (!/^https:\/\/proper-camel-616\./.test(convexUrl)) {
  console.error("burst-check: .env.local must point at the development deployment proper-camel-616.");
  process.exit(2);
}

const failures = [];
let steps = 0;
async function step(label, run) {
  steps += 1;
  try {
    await run();
    console.log(`  ok   ${label}`);
  } catch (error) {
    failures.push(label);
    console.log(`  FAIL ${label}\n       ${String(error?.message ?? error).split("\n")[0]}`);
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
// A settled call as a short word: the refusal code, "ok", or "server error" for anything thrown that is not a ConvexError with a code.
async function outcome(promise) {
  try {
    const r = await promise;
    return r && r.ok === false ? r.code : "ok";
  } catch (error) {
    return error?.data?.code ?? `server error: ${String(error?.message ?? error).slice(0, 80)}`;
  }
}
const tally = (list) => list.reduce((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});

const browser = await chromium.launch();
try {
  await step("30 wrong password sign ins at once end in 401 or 429, never a server error", async () => {
    const tries = await Promise.all(
      Array.from({ length: 30 }, () =>
        fetch(`${base.origin}/api/auth/sign-in/email`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: base.origin },
          body: JSON.stringify({ email: "burst-nobody@example.test", password: "wrong-password-1" }),
        }).then((r) => r.status),
      ),
    );
    const counts = tally(tries.map(String));
    expect(tries.every((s) => s < 500), `server errors: ${JSON.stringify(counts)}`);
    console.log(`       statuses ${JSON.stringify(counts)}`);
  });

  const context = await browser.newContext({ baseURL: base.origin, storageState: await freshStudent(browser, base) });
  const page = await context.newPage();
  await page.goto("/dashboard");
  const { token } = await page.evaluate(async () => (await fetch("/api/auth/convex/token")).json());
  expect(typeof token === "string" && token.length > 20, "no Convex token for the student");
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);

  await step("40 desk questions at once end in stored answers or rate_limited, never a server error, and the coins stay at or above zero", async () => {
    const question = `In one line, what is inertia? (burst ${Date.now().toString(36)})`;
    expect((await outcome(client.action(api.deskAsk.ask, { kind: "chat", question }))) === "ok", "the first question was not answered");
    const results = await Promise.all(Array.from({ length: 40 }, () => outcome(client.action(api.deskAsk.ask, { kind: "chat", question }))));
    const counts = tally(results);
    console.log(`       ${JSON.stringify(counts)}`);
    expect(!results.some((r) => r.startsWith("server error")), `server errors: ${JSON.stringify(counts)}`);
    // A conflict that ran out of retries is the plain refusal `busy` (nothing taken); a server error never.
    expect(results.every((r) => ["ok", "rate_limited", "busy"].includes(r)), `an answer that is not ok, rate_limited or busy: ${JSON.stringify(counts)}`);
    const wallet = await client.query(api.desk.wallet, {});
    expect(wallet.balance >= 0, `the coins went below zero: ${wallet.balance}`);
  });

  await step("30 heartbeats and 30 chat messages at once end in ok or rate_limited, never a server error", async () => {
    const sat = await outcome(client.mutation(api.studyHour.enter, { mode: "live" }));
    expect(sat === "ok", `could not sit in the hour (${sat}); open one with hourProof:openNow`);
    const beats = await Promise.all(Array.from({ length: 30 }, () => outcome(client.mutation(api.studyHour.beat, {}))));
    const chats = await Promise.all(Array.from({ length: 30 }, (_, i) => outcome(client.mutation(api.studyHour.chat, { text: `burst ${i}` }))));
    const counts = { beats: tally(beats), chats: tally(chats) };
    console.log(`       ${JSON.stringify(counts)}`);
    expect(![...beats, ...chats].some((r) => r.startsWith("server error")), `server errors: ${JSON.stringify(counts)}`);
    await outcome(client.mutation(api.studyHour.leave, {}));
  });
  await context.close();
} finally {
  await browser.close();
}

console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.log(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
