// Repeatable browser proof of the DHI desk (spec house/0016), in a real browser, against the dev server and the development backend:
//   pnpm dev, then pnpm desk:check
// Two fresh made up students of the demo institute. The first asks one question of each kind (chat 1 coin, write 2, paper 2, mock 4, story 5, draw 8)
// and one clarifying question (free), and the coins go down by exactly the price each time; the draw answer is shown only as a checked picture. A
// message that sounds like distress gets the care text, costs nothing and stores nothing. The second student asks the first one's chat question again
// and gets the stored answer for 0 coins. The desk calls the real model on the development deployment (about seven short calls a run, on the
// development key), so it needs DESK_LIVE and OPENAI_API_KEY set there. The exam lock and the daily cap are proven by the backend suite. Needs the demo
// institute, VITE_TEST_SIGNIN=true in .env.local and TEST_SIGNIN_ENABLED on the development deployment; it refuses production and any non local address.
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import { freshStudent } from "./fresh-student.mjs";

const argUrl = process.argv.includes("--url") ? process.argv[process.argv.indexOf("--url") + 1] : "http://localhost:8080";
const base = assertLocalDevelopment("desk-check", argUrl);
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

const tag = Date.now().toString(36);
const question = `In one line, what is torque? (proof ${tag})`;
const MODEL_WAIT = 90_000;

async function openDesk(page) {
  await page.goto("/dashboard");
  await page.locator('[data-room="dhi"]:visible').click();
  await page.getByTestId("desk-room").waitFor({ timeout: 30_000 });
  await page.getByTestId("desk-coins").waitFor({ timeout: 20_000 });
}
const coins = async (page) => Number((await page.getByTestId("desk-coins").innerText()).trim());
async function waitCoins(page, expected) {
  await page.waitForFunction((n) => Number(document.querySelector('[data-testid="desk-coins"]')?.textContent?.trim()) === n, expected, { timeout: MODEL_WAIT });
}
// One new talk of one kind: the coins drop by the price and an answer (or the diagram) arrives.
async function askKind(page, kind, text, price) {
  const before = await coins(page);
  await page.getByTestId("desk-new").click();
  await page.getByTestId(`desk-mode-${kind}`).click();
  await page.getByTestId("desk-input").fill(text);
  await page.getByTestId("desk-ask").click();
  const shown = kind === "draw" ? page.getByTestId("desk-diagram") : page.getByTestId("desk-answer");
  await Promise.race([
    shown.last().waitFor({ timeout: MODEL_WAIT }),
    page.getByTestId("desk-error").waitFor({ timeout: MODEL_WAIT }).then(async () => {
      throw new Error(`the desk refused: ${await page.getByTestId("desk-error").innerText()}`);
    }),
  ]);
  await waitCoins(page, before - price);
}

const browser = await chromium.launch();
try {
  const first = await browser.newContext({ baseURL: base.origin, storageState: await freshStudent(browser, base) });
  const page = await first.newPage();

  await step("a new student opens the desk with 60 coins, and the draft note shows", async () => {
    await openDesk(page);
    expect((await coins(page)) === 60, `the desk opened with ${await coins(page)} coins, not 60`);
    await page.getByTestId("desk-draft").waitFor({ timeout: 5_000 });
    expect((await page.getByTestId("desk-off").count()) === 0, "the desk says it is off on the development deployment");
  });

  await step("a chat question costs 1 coin and the answer is kept in the talk", async () => {
    await askKind(page, "chat", question, 1);
    await page.getByTestId("desk-talks").getByText(question.slice(0, 20), { exact: false }).first().waitFor({ timeout: 10_000 });
  });

  await step("a clarifying question on the same talk is free", async () => {
    const before = await coins(page);
    await page.getByTestId("desk-input").fill("Say that more simply, please.");
    await page.getByTestId("desk-clarify").click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid="desk-answer"]').length >= 2, null, { timeout: MODEL_WAIT });
    expect((await coins(page)) === before, "a clarifying question took coins");
  });

  await step("a message that sounds like distress gets the care text, costs nothing and adds no talk", async () => {
    const before = await coins(page);
    const talks = await page.getByTestId("desk-talks").locator("li").count();
    await page.getByTestId("desk-new").click();
    await page.getByTestId("desk-mode-chat").click();
    await page.getByTestId("desk-input").fill("I feel like I want to die");
    await page.getByTestId("desk-ask").click();
    await page.getByTestId("desk-care").waitFor({ timeout: 20_000 });
    expect((await page.getByTestId("desk-care").innerText()).includes("14416"), "the care text does not name Tele-MANAS");
    expect((await coins(page)) === before, "the care text took coins");
    expect((await page.getByTestId("desk-talks").locator("li").count()) === talks, "a distress message was stored as a talk");
  });

  await step("feedback on writing costs 2 coins", async () => askKind(page, "write", "My summer holiday was fun. We went to my grandmother's village and I learnt to swim in the river.", 2));
  await step("practice questions on a topic cost 2 coins", async () => askKind(page, "paper", "Fractions for class 6", 2));
  await step("a longer practice set costs 4 coins", async () => askKind(page, "mock", "The water cycle", 4));
  await step("a study story costs 5 coins", async () => askKind(page, "story", `Why the moon has phases (proof ${tag})`, 5));

  await step("a diagram costs 8 coins and is shown only as a checked picture, never as raw markup", async () => {
    await askKind(page, "draw", `The parts of a plant cell (proof ${tag})`, 8);
    const src = await page.getByTestId("desk-diagram").last().getAttribute("src");
    expect(src?.startsWith("data:image/svg+xml"), `the diagram is not a picture: ${String(src).slice(0, 40)}`);
    expect((await page.locator('[data-testid="desk-turns"] svg').count()) === 0, "an svg was put into the page itself");
  });

  await step("after all seven questions the coins are 60 less exactly the prices (22), so 38", async () => {
    expect((await coins(page)) === 38, `the coins are ${await coins(page)}, not 38`);
  });
  await first.close();

  const second = await browser.newContext({ baseURL: base.origin, storageState: await freshStudent(browser, base) });
  const classmate = await second.newPage();
  await step("a classmate asking the same question gets the stored answer for 0 coins", async () => {
    await openDesk(classmate);
    await classmate.getByTestId("desk-mode-chat").click();
    await classmate.getByTestId("desk-input").fill(question);
    await classmate.getByTestId("desk-ask").click();
    await classmate.getByTestId("desk-answer").first().waitFor({ timeout: 30_000 });
    expect((await coins(classmate)) === 60, `the stored answer cost coins (${await coins(classmate)} left)`);
  });
  await second.close();
} finally {
  await browser.close();
}

console.log(`\n${steps - failures.length} of ${steps} steps passed.`);
if (failures.length) {
  console.log(`Failed: ${failures.join("; ")}`);
  process.exit(1);
}
