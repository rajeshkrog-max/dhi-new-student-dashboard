#!/usr/bin/env node
// `pnpm responsive:sweep`: signs in as the demo student and the demo institute admin (joined through the real Join step), then opens every
// room, the staff screens, the Join page, the "not in a house" page, the door, the error page, the not found page and each loading screen at four widths against the running dev server, and prints a table. Exits 1 on any overflow, small target, small text, wrong screen
// or layout shift. Rules live in responsive-verdict.mjs. It needs the dev server, the funnel built (`pnpm --filter dhirise build`), the
// development backend with the demo institute seeded (`pnpm --filter @dhi/backend exec convex run demo:seed`) and the test sign in
// (VITE_TEST_SIGNIN=true), so it stays manual like `enter:check`, and it refuses production.
// Usage: pnpm responsive:sweep [--url http://localhost:8080] [--room mood,staff-people] [--width 360] [--shots dir] [-v]
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import { assertLocalDevelopment } from "./local-dev-guard.mjs";
import {
  ROOMS,
  WIDTHS,
  exitCodeFor,
  formatFailures,
  formatTable,
  isTouchWidth,
  judge,
} from "./responsive-verdict.mjs";
import { PEOPLE, TEST_STUDENT, signInCounselor, signInMember } from "./test-student.mjs";

function parseArgs(argv) {
  const out = {
    url: "http://localhost:8080",
    room: null,
    width: null,
    shots: null,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") out.url = argv[++i];
    else if (a === "--room") out.room = argv[++i];
    else if (a === "--width") out.width = Number(argv[++i]);
    else if (a === "--shots") out.shots = argv[++i];
    else if (a === "-v" || a === "--verbose") out.verbose = true;
  }
  return out;
}

/** Runs inside the page and returns raw facts. No judging here. `leakWords` are things this screen must not show (a student name, raw error text). */
function collectFacts(leakWords) {
  const vw = window.innerWidth;
  // With a Sheet open, only the Sheet counts: the page behind it is covered and not reachable.
  const root = document.querySelector('[role="dialog"]') ?? document.body;
  const touch = window.matchMedia("(pointer: coarse), (max-width: 1023.98px)").matches;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) !== 0;
  };
  const describe = (el) => {
    const cls =
      typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2) : [];
    const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 18);
    return `${el.tagName.toLowerCase()}${cls.length ? "." + cls.join(".") : ""}${label ? ` "${label}"` : ""}`;
  };
  const decorative = (el) => Boolean(el.closest("[data-decorative]"));
  // The sideways room an element has: the screen, cut down by every box around it that clips.
  // A box marked data-scroll-x scrolls on purpose, so what is inside it is not judged.
  const limitOf = (el) => {
    let left = 0;
    let right = vw;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (p.hasAttribute("data-scroll-x")) return null;
      if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) {
        const r = p.getBoundingClientRect();
        left = Math.max(left, r.left);
        right = Math.min(right, r.right);
      }
    }
    return { left, right };
  };

  const offenders = [];
  for (const el of root.querySelectorAll("*")) {
    if (!visible(el) || el.hasAttribute("data-scroll-x")) continue;
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg") continue;
    const limit = limitOf(el);
    if (!limit) continue;
    const r = el.getBoundingClientRect();
    if (r.right > limit.right + 1 || r.left < limit.left - 1) {
      if (getComputedStyle(el).position === "fixed") continue;
      offenders.push({
        sel: describe(el),
        left: r.left,
        right: r.right,
        limitLeft: limit.left,
        limitRight: limit.right,
      });
    }
  }

  const targets = [];
  const controls = root.querySelectorAll(
    'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="switch"], [role="tab"]',
  );
  for (const el of controls) {
    if (!visible(el) || el.disabled) continue;
    // Tapping a label reaches its field, so a field inside a label counts by the label's size.
    const box = el.matches("input, select, textarea") ? el.closest("label") || el : el;
    const r = box.getBoundingClientRect();
    let inSentence = false;
    if (el.tagName === "A") {
      const parent = el.parentElement;
      const own = [...(parent?.childNodes ?? [])]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join("");
      inSentence = own.length > 12;
    }
    targets.push({
      sel: describe(el),
      w: r.width,
      h: r.height,
      decorative: decorative(el),
      inSentence,
      dayCell: Boolean(el.closest("[data-day-cell]")),
    });
  }

  const texts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el || !visible(el) || el.closest("script, style, svg, [aria-hidden='true']")) continue;
    texts.push({
      sel: describe(el),
      size: parseFloat(getComputedStyle(el).fontSize),
      text,
      decorative: decorative(el),
    });
  }

  // Parts a room wants on the first screen (the DHI desk composer), as page coordinates.
  const firstScreen = [...root.querySelectorAll("[data-first-screen]")]
    .filter(visible)
    .map((el) => ({
      sel: describe(el),
      bottom: el.getBoundingClientRect().bottom + window.scrollY,
    }));

  // What the loading, error and not found screens are expected to show (spec house/0003).
  const bodyText = document.body.innerText;
  const clean = (el) => (el.textContent || "").replace(/\s+/g, " ").trim();
  const shownButtons = [...document.querySelectorAll("main button, main a[href]")].filter(visible).map(clean);
  const back = [...document.querySelectorAll("a[href]")].find((a) => clean(a) === "Back to the house");
  const page = {
    loading: [...document.querySelectorAll('[role="status"]')].some((el) => clean(el) === "Loading"),
    slowLine: bodyText.includes("This is taking longer than usual."),
    tryAgain: [...document.querySelectorAll("button")].filter(visible).some((el) => clean(el) === "Try again"),
    brandBar: [...document.querySelectorAll("header, aside")].filter(visible).some((el) => clean(el).includes("DHI")),
    h1: document.querySelector("h1") ? clean(document.querySelector("h1")) : "",
    buttons: shownButtons,
    backHref: back ? back.getAttribute("href") : null,
    leaked: leakWords.filter((word) => bodyText.includes(word)),
  };

  return {
    viewport: vw,
    height: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    touch,
    offenders,
    targets,
    texts,
    firstScreen,
    page,
    cls: typeof window.__cls === "number" ? window.__cls : undefined,
  };
}

async function openMenuIfDrawer(page, width) {
  if (!isTouchWidth(width)) return;
  await page.getByTestId("menu-button").click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
}

// Extra states of a room, reached after opening it. Each one is swept like a room.
const SCENES = {
  // The sitting needs a paper that is open now for the demo student: `prepare` makes one (papersProof:openDemoPaper).
  "papers-sit": { room: "papers", run: sitExam },
  "papers-hint": {
    room: "papers",
    run: async (page) => {
      await sitExam(page);
      await page.getByTestId("hint-button-0").click();
      await page.getByTestId("hint-0").waitFor({ timeout: 20_000 });
    },
  },
  "papers-menu": {
    room: "papers",
    run: async (page, width) => {
      await sitExam(page);
      await openMenuIfDrawer(page, width);
    },
  },
  // The desk's Learn panel (house spec 0031): the topic map, a topic page with the written answer box, and a practice round. `prepare` gives the demo
  // student's class a made up practice bank on Ratios (learnProof:bankFor).
  "dhi-learn": {
    room: "dhi",
    run: async (page) => {
      await page.getByTestId("desk-tab-learn").click();
      await page.getByTestId("learn-topics").waitFor({ timeout: 30_000 });
      await page.waitForTimeout(800);
    },
  },
  "dhi-learn-topic": {
    room: "dhi",
    run: async (page) => {
      await page.getByTestId("desk-tab-learn").click();
      await page.getByTestId("learn-topic").filter({ hasText: "Ratios" }).first().click();
      await page.getByTestId("learn-write").click();
      await page.getByTestId("learn-written").waitFor({ timeout: 30_000 });
      await page.waitForTimeout(800);
    },
  },
  "dhi-learn-round": {
    room: "dhi",
    run: async (page) => {
      await page.getByTestId("desk-tab-learn").click();
      await page.getByTestId("learn-topic").filter({ hasText: "Ratios" }).first().click();
      await page.getByTestId("learn-practise").click();
      await page.getByTestId("learn-round").waitFor({ timeout: 30_000 });
      await page.getByTestId("learn-option").first().check();
      await page.getByTestId("learn-check").click();
      await page.getByTestId("learn-result").waitFor({ timeout: 20_000 });
      await page.waitForTimeout(800);
    },
  },
  // A kept academic film's two checks (house spec 0030); `prepare` marks one watched for the demo student (learnProof:keepFilm).
  "modules-checks": {
    room: "modules",
    run: async (page) => {
      await page.getByTestId("film-card").first().waitFor({ timeout: 30_000 });
      await page.getByTestId("film-card").filter({ hasText: KEPT_FILM.title || "" }).first().click();
      await page.locator('[data-testid="film-checks"], [data-testid="film-checks-done"]').first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(800);
    },
  },
  "mood-day": { room: "mood", run: (page, width) => openMoodDay(page, width) },
  "mood-help": {
    room: "mood",
    run: async (page, width) => {
      await openMoodDay(page, width);
      await page.getByRole("button", { name: /Ask DHI for a sitting/ }).click();
      await page.getByRole("button", { name: /Yes, write to them/ }).click();
    },
  },
  "meals-custom": {
    room: "day",
    run: async (page) => {
      await page.getByRole("button", { name: /Add a dish that is not listed/ }).click();
    },
  },
  "habits-new": {
    room: "habits",
    run: async (page) => {
      await page.getByRole("button", { name: /New habit/ }).click();
    },
  },
  "habits-slide": {
    room: "habits",
    run: async (page) => {
      // The room is real now (spec house/0007): the demo student's habits come from the server, so make one if there is none yet.
      await page.waitForFunction(() => !document.body.innerText.includes("Loading…"), null, { timeout: 30_000 });
      if (!(await page.getByRole("button", { name: /day streak/ }).count())) {
        await page.getByRole("button", { name: /New habit/ }).click();
        await page.getByTestId("habit-title").fill("Sweep habit");
        await page.getByTestId("habit-create").click();
        await page.getByTestId("habit-title").waitFor({ state: "detached", timeout: 20_000 });
      }
      await page
        .getByRole("button", { name: /day streak/ })
        .first()
        .click();
    },
  },
  "habits-month": {
    room: "habits",
    run: async (page) => {
      await page.getByRole("button", { name: "month", exact: true }).click();
    },
  },
  // The study hour needs an hour that is open now: `prepare` opens one (hourProof:openNow). Sitting in each mode shows the seat, the list and the chat.
  "hour-live": { room: "hour", run: (page) => sitInMode(page, "live") },
  "hour-dnd": { room: "hour", run: (page) => sitInMode(page, "dnd") },
  "hour-away": { room: "hour", run: (page) => sitInMode(page, "away") },
  // The Progress page with a heavy fortnight stored for the demo student (`prepare`): a pattern, the days behind it, the expression note and the
  // support message. The room itself is swept too, with the same days.
  "progress-days": {
    room: "progress",
    run: async (page) => {
      await page.getByTestId("pattern").first().waitFor({ timeout: 30_000 });
      await page.getByText("See the days").first().click();
    },
  },
  // House spec 0028: the desk card with a subject tapped and its topics shown, the study hour card with a subject tapped, and the two connections.
  "dhi-card": {
    room: "dhi",
    run: async (page) => {
      await page.getByTestId("desk-feeling-card").waitFor({ timeout: 30_000 });
      await page.getByTestId("desk-subject-maths").click();
      await page.getByTestId("desk-topic").first().waitFor({ timeout: 20_000 });
    },
  },
  "hour-card": {
    room: "hour",
    run: async (page) => {
      await page.getByTestId("feedback-card").waitFor({ timeout: 30_000 });
      await page.getByTestId("subject-science").click();
    },
  },
  "progress-connections": {
    room: "progress",
    run: async (page) => {
      await page.locator('[data-connection="subject_feeling"]').waitFor({ timeout: 30_000 });
      await page.locator('[data-connection="topic_desk_papers"]').scrollIntoViewIfNeeded();
    },
  },
  "progress-hinglish": {
    room: "progress",
    run: async (page) => {
      await page.getByTestId("lang-hi").click();
      await page.getByTestId("pattern").first().waitFor({ timeout: 30_000 });
      await page.getByText("Din dekhein").first().click();
    },
  },
};

const KEPT_FILM = { title: "" };

// Data the scenes above need, made once before the sweep with the development helpers (the sweep refuses production, and so do they).
function prepare(selected) {
  const run = (command) => execSync(`npx convex run ${command}`, { cwd: "packages/backend", stdio: "pipe" });
  // A proof that stopped part way may have left the demo student in a sitting, which the server's exam lock would hold them in.
  run("papersProof:resetDemoSitting");
  const wants = (prefix) => selected.some((name) => name === prefix || name.startsWith(`${prefix}-`));
  if (wants("papers")) {
    run("papersProof:assignDemoTeacher");
    run("papersProof:openDemoPaper");
  }
  if (wants("hour")) run(`hourProof:openNow "${JSON.stringify({ minutes: 120 }).replace(/"/g, '\\"')}"`);
  // The heavy fortnight with the tagged days under it (house spec 0028), so the page also holds the topic and subject connections.
  if (wants("progress")) run(`brainProof:seed "${JSON.stringify({ email: PEOPLE.student.email, scenario: "sweep" }).replace(/"/g, '\\"')}"`);
  // A pending card for the desk and for the study hour (house spec 0028: the subject and topic taps). A card stays until answered, so one is enough.
  // A made up practice bank for the demo student's class, for the Learn scenes (house spec 0031).
  if (wants("dhi")) run(`learnProof:bankFor "${JSON.stringify({ email: PEOPLE.student.email }).replace(/"/g, '\\"')}"`);
  if (wants("modules")) KEPT_FILM.title = JSON.parse(run(`learnProof:keepFilm "${JSON.stringify({ email: PEOPLE.student.email }).replace(/"/g, '\\"')}"`).toString() || "null")?.title ?? "";
  if (wants("dhi")) run(`topicsProof:openDeskCard "${JSON.stringify({ email: PEOPLE.student.email }).replace(/"/g, '\\"')}"`);
  if (wants("hour")) run(`hourProof:addFinishedStay "${JSON.stringify({ email: PEOPLE.student.email, minutes: 25 }).replace(/"/g, '\\"')}"`);
}

// The room is real now (spec house/0006): its days come from the server. Make sure today has a colour, then open the month that holds it: by its
// row on touch, by the strip on desktop. The day rule is the house's: 04:00 to 04:00 India time.
async function openMoodDay(page, width) {
  const day = new Date(Date.now() + (5.5 - 4) * 3600 * 1000).toISOString().slice(0, 10);
  const monthName = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(day.slice(5, 7)) - 1];
  await page.getByTestId("mood-note").waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="mood-save"]')?.textContent?.includes("Loading"), null, { timeout: 30_000 });
  if (!(await page.getByTestId("mood-saved").count())) {
    await page.locator("article button", { hasText: "Content" }).first().click();
    await page.getByTestId("mood-save").click();
    await page.getByTestId("mood-saved").waitFor({ timeout: 20_000 });
  }
  if (isTouchWidth(width)) {
    await page.getByRole("button", { name: "Open " + monthName }).click();
    await page.locator("[data-day-cell]:not([disabled])").first().click();
  } else {
    await page.locator('button[title^="' + day.slice(0, 8) + '"]:not([disabled])').first().click();
  }
}

// Sits in the study hour in a mode: the first press is "enter", and once the student sits the same modes are "mode" buttons, so either is clicked.
async function sitInMode(page, mode) {
  await page.locator(`[data-testid="enter-${mode}"], [data-testid="mode-${mode}"]`).first().click();
  await page.getByTestId("my-seat").waitFor({ timeout: 20_000 });
}

async function sitExam(page) {
  const paper = page.getByTestId("exam-row").filter({ hasText: "Sweep paper" });
  await paper.waitFor({ timeout: 30_000 });
  await paper.getByRole("button", { name: /Start paper|Continue paper/ }).click();
  await page.getByTestId("sitting").waitFor({ timeout: 20_000 });
}

// The screens that are not rooms. `auth` says who is signed in; `hold` stalls the sign in calls so the loading screen stays up; `wait` is how long
// to look at it (ms); `settle` lets the held calls go and measures the layout shift while the real screen replaces the skeleton.
const NAME = TEST_STUDENT.name;
const RAW_ERROR = ["thrown on purpose", "__throw"];
// Loading, error and not found screens must show no student name. A screen that ends on the real dashboard (`showsStudent`) legitimately does.
const LEAKS = [NAME, ...RAW_ERROR];
const BACK_DASHBOARD = { h1: "This page is not here", buttons: ["Back to the house"], backHref: "/dashboard", brandBar: true };
// The staff screens (spec house/0002, AC-18) are reached as the demo institute admin, through the menu like a person does.
const staffScreen = (room, title) => ({
  auth: "staff",
  path: "/staff",
  // The staff area opens on Home (house spec 0026), whatever the screen asked for; `run` then opens its own screen through the menu.
  ready: (p) => p.getByRole("heading", { name: "Home", level: 1 }),
  run: async (p, width) => {
    await openMenuIfDrawer(p, width);
    await p.locator(`[data-room="${room}"]:visible`).click();
    await p.getByRole("heading", { name: title, level: 1 }).waitFor({ timeout: 20_000 });
    await p.waitForTimeout(800);
  },
  expect: { h1: title },
  showsStudent: true,
});
const SCREENS = {
  join: {
    auth: "newcomer",
    path: "/join",
    ready: (p) => p.getByRole("heading", { name: "You are invited" }),
    expect: { h1: "You are invited", buttons: ["Join", "Not now"], brandBar: true },
    leakNames: [PEOPLE.newcomer.name],
  },
  "not-in-house": {
    auth: "stranger",
    path: "/dashboard",
    ready: (p) => p.getByRole("heading", { name: "You are not in a house yet" }),
    expect: { h1: "You are not in a house yet", buttons: ["Leave"], brandBar: true },
    leakNames: [PEOPLE.stranger.name],
  },
  "staff-home": { ...staffScreen("home", "Home"), run: (p) => p.getByTestId("staff-home").waitFor({ timeout: 20_000 }) },
  "staff-classes": staffScreen("classes", "Classes"),
  "staff-people": staffScreen("people", "People"),
  "staff-invites": staffScreen("invites", "Invites"),
  "staff-list": staffScreen("list", "Class list"),
  "staff-parent": staffScreen("parent", "Parent consent"),
  // The teacher's papers screen with the builder's bank and repeat choices, the written answer queue and the syllabus map (house specs 0030, 0031).
  "staff-papers": { ...staffScreen("papers", "Papers and review"), auth: "teacher" },
  // The school report (spec house/0025), opened for Class 10 A of the demo institute, with the room counts below it.
  "staff-report": {
    ...staffScreen("report", "School report"),
    run: async (p, width) => {
      await openMenuIfDrawer(p, width);
      await p.locator('[data-room="report"]:visible').click();
      await p.getByTestId("school-class").selectOption({ label: "Class 10 A" });
      await p.getByTestId("school-open").click();
      await p.getByTestId("school-rooms").waitFor({ timeout: 30_000 });
      await p.waitForTimeout(800);
    },
  },
  // The counselor's Sessions (spec house/0024), as the demo counselor, with a free time and the demo student's booking (`counselProof:seedDemo`).
  "staff-counsel": {
    auth: "counselor",
    path: "/staff",
    ready: (p) => p.getByTestId("counsel-booking"),
    expect: { h1: "Sessions" },
    showsStudent: true,
  },
  // The consent screen (spec house/0005, AC-20): the notice, the locked I agree, and Your data for a student who is not through consent.
  consent: {
    auth: "gate",
    path: "/dashboard",
    ready: (p) => p.getByRole("heading", { name: "Before you enter" }),
    run: async (p) => {
      await p.waitForFunction(() => (document.querySelector('[data-testid="notice-box"]')?.textContent ?? "").includes("privacy@"), null, { timeout: 20_000 });
    },
    expect: { h1: "Before you enter", brandBar: true },
    leakNames: [PEOPLE.gate.name],
  },
  "consent-data": {
    auth: "gate",
    path: "/dashboard",
    ready: (p) => p.getByRole("heading", { name: "Before you enter" }),
    run: async (p) => {
      await p.getByTestId("toggle-data").click();
      await p.getByTestId("your-data").waitFor({ timeout: 20_000 });
      await p.waitForTimeout(800);
    },
    expect: { h1: "Your data", brandBar: true },
    leakNames: [PEOPLE.gate.name],
  },
  door: { auth: "anon", path: "/enter", ready: (p) => p.getByTestId("landing-signin") },
  "door-day": {
    auth: "anon",
    path: "/enter",
    ready: (p) => p.getByTestId("landing-signin"),
    run: (p) => p.getByRole("button", { name: "Switch to day" }).click(),
  },
  "door-invite": {
    auth: "anon",
    path: "/enter",
    ready: (p) => p.getByTestId("landing-signin"),
    run: (p) => p.getByRole("button", { name: "Invite letter" }).click(),
  },
  notfound: { auth: "user", path: "/dashboard/nothing-here", ready: (p) => p.getByRole("heading", { name: "This page is not here" }), expect: BACK_DASHBOARD },
  "notfound-door": {
    auth: "anon",
    path: "/enter/nothing-here",
    ready: (p) => p.getByRole("heading", { name: "This page is not here" }),
    expect: { ...BACK_DASHBOARD, backHref: "/" },
  },
  error: {
    auth: "user",
    path: "/dashboard?__throw=1",
    ready: (p) => p.getByRole("heading", { name: "Something went wrong" }),
    expect: { h1: "Something went wrong", buttons: ["Try again", "Back to the house"], backHref: "/dashboard", brandBar: true },
    consoleHas: "thrown on purpose",
  },
  "room-paused": {
    auth: "user",
    path: "/dashboard?__throw=room",
    ready: (p) => p.getByRole("heading", { name: "This room paused" }),
    consoleHas: "thrown on purpose",
    showsStudent: true,
  },
  "wait-dashboard": { auth: "user", path: "/dashboard", hold: true, wait: 1000, expect: { loading: true, notSlow: true, brandBar: true } },
  "slow-dashboard": { auth: "user", path: "/dashboard", hold: true, wait: 10500, expect: { loading: true, slow: true, brandBar: true } },
  "settle-dashboard": { auth: "user", path: "/dashboard", hold: true, wait: 1000, settle: (p) => p.locator('section[aria-label="House"] h1'), showsStudent: true },
  "wait-door": { auth: "anon", path: "/enter", hold: true, wait: 1000, expect: { loading: true, notSlow: true, brandBar: false } },
  "slow-door": { auth: "anon", path: "/enter", hold: true, wait: 10500, expect: { loading: true, slow: true, brandBar: false } },
  "settle-door": { auth: "anon", path: "/enter", hold: true, wait: 1000, settle: (p) => p.getByTestId("landing-signin") },
};

const dashboardReady = (page) => page.locator('section[aria-label="House"] h1').waitFor({ timeout: 30_000 });

async function visitRoom(page, base, target, width) {
  const scene = SCENES[target];
  const room = scene ? scene.room : target;
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  await dashboardReady(page);
  // Every visit starts from a fresh demo state, so one scene cannot leak into the next.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await dashboardReady(page);
  if (room !== "home") {
    await openMenuIfDrawer(page, width);
    await page.locator(`[data-room="${room}"]:visible`).click();
  }
  if (scene) await scene.run(page, width);
  await page.waitForTimeout(500);
  return { facts: await page.evaluate(collectFacts, []) };
}

async function visitScreen(page, base, screen, width) {
  const logged = [];
  page.on("console", (message) => logged.push(message.text()));
  const held = [];
  if (screen.hold) await page.route("**/api/auth/**", (route) => void held.push(route));
  await page.goto(`${base}${screen.path}`, { waitUntil: screen.hold ? "commit" : "networkidle" });
  if (screen.ready) await screen.ready(page).first().waitFor({ timeout: 30_000 });
  if (screen.run) await screen.run(page, width);
  if (screen.wait) await page.waitForTimeout(screen.wait);
  await page.waitForTimeout(400);
  if (screen.settle) {
    // Let the held sign in calls go, wait for the real screen, then give it a moment to settle before reading the shift score.
    await Promise.all(held.splice(0).map((route) => route.continue().catch(() => {})));
    await page.unroute("**/api/auth/**");
    await screen.settle(page).first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
  }
  if (screen.consoleHas && !logged.some((line) => line.includes(screen.consoleHas))) {
    throw new Error(`the console never got the error text "${screen.consoleHas}"`);
  }
  return { facts: await page.evaluate(collectFacts, screen.showsStudent ? RAW_ERROR : screen.leakNames ? [...screen.leakNames, ...RAW_ERROR] : LEAKS), expect: screen.expect };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const base = assertLocalDevelopment("responsive-sweep", args.url).origin;
  const everything = [...ROOMS, ...Object.keys(SCENES), ...Object.keys(SCREENS)];
  const rooms = args.room ? args.room.split(",") : everything;
  const widths = args.width ? [args.width] : WIDTHS;
  prepare(rooms);
  if (args.shots) mkdirSync(args.shots, { recursive: true });

  const browser = await chromium.launch();
  const rows = [];
  try {
    console.log(`Signing in as the demo people (${TEST_STUDENT.email} and the others) ...`);
    const states = {
      user: await signInMember(browser, new URL(base), PEOPLE.student),
      staff: await signInMember(browser, new URL(base), PEOPLE.admin),
      teacher: await signInMember(browser, new URL(base), PEOPLE.teacher),
      newcomer: await signInMember(browser, new URL(base), PEOPLE.newcomer, { join: false }),
      stranger: await signInMember(browser, new URL(base), PEOPLE.stranger, { join: false }),
      gate: await signInMember(browser, new URL(base), PEOPLE.gate),
    };
    if (rooms.some((r) => r === "counsel" || r === "staff-counsel")) {
      states.counselor = await signInCounselor(browser, new URL(base));
      const json = JSON.stringify({ counselorEmail: PEOPLE.counselor.email, studentEmail: PEOPLE.student.email }).replace(/"/g, '\\"');
      execSync(`npx convex run counselProof:seedDemo "${json}"`, { cwd: "packages/backend", stdio: "pipe" });
    }
    for (const width of widths) {
      const touch = isTouchWidth(width);
      const options = { viewport: { width, height: touch ? 740 : 800 }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 1 };
      const contexts = { anon: await browser.newContext(options) };
      for (const [key, state] of Object.entries(states)) contexts[key] = await browser.newContext({ ...options, storageState: state });
      // The layout shift score, from navigation until the page settles (spec house/0003, AC-5).
      for (const context of Object.values(contexts)) {
        await context.addInitScript(() => {
          window.__cls = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value;
          }).observe({ type: "layout-shift", buffered: true });
        });
      }
      for (const room of rooms) {
        const screen = SCREENS[room];
        // A fresh page for every visit, so held calls, listeners and the layout shift score never leak into the next one.
        const page = await contexts[screen ? screen.auth : "user"].newPage();
        try {
          const { facts, expect } = screen ? await visitScreen(page, base, screen, width) : await visitRoom(page, base, room, width);
          rows.push(judge(room, width, facts, expect));
          if (args.shots) {
            // A fixed Sheet is only placed right in a viewport shot, so use one while a dialog is open.
            const dialog = await page.evaluate(() => Boolean(document.querySelector('[role="dialog"]')));
            await page.screenshot({ path: join(args.shots, `${room}-${width}.png`), fullPage: !dialog });
          }
        } catch (err) {
          rows.push({ room, width, ok: false, error: String(err.message ?? err).split("\n")[0] });
        }
        await page.close();
        // A sitting scene leaves the demo student's paper open, and the server's exam lock would then close every later room: undo it.
        if (room.startsWith("papers-")) execSync("npx convex run papersProof:resetDemoSitting", { cwd: "packages/backend", stdio: "pipe" });
      }
      await Promise.all(Object.values(contexts).map((context) => context.close()));
    }
  } finally {
    await browser.close();
  }

  console.log(formatTable(rows, widths));
  if (args.verbose || exitCodeFor(rows) !== 0) {
    const detail = formatFailures(rows, args.verbose ? 40 : 6);
    if (detail) console.log("\n" + detail);
  }
  process.exit(exitCodeFor(rows));
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
