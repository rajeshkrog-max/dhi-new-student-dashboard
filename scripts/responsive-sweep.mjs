#!/usr/bin/env node
// `pnpm responsive:sweep`: opens every room and the sign in page at four widths against the
// running dev server and prints a table. Exits 1 on any overflow, small target or small text.
// Rules live in responsive-verdict.mjs. Usage:
//   pnpm responsive:sweep [--url http://localhost:8080] [--room mood] [--width 360] [--shots dir] [-v]
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import {
  ROOMS,
  WIDTHS,
  exitCodeFor,
  formatFailures,
  formatTable,
  isTouchWidth,
  judge,
} from "./responsive-verdict.mjs";

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

/** Runs inside the page and returns raw facts. No judging here. */
function collectFacts() {
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

  return {
    viewport: vw,
    height: window.innerHeight,
    scrollWidth: document.documentElement.scrollWidth,
    touch,
    offenders,
    targets,
    texts,
    firstScreen,
  };
}

async function openMenuIfDrawer(page, width) {
  if (!isTouchWidth(width)) return;
  await page.getByTestId("menu-button").click();
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 5000 });
}

// Extra states of a room, reached after opening it. Each one is swept like a room.
const SCENES = {
  "papers-sit": { room: "papers", run: sitExam },
  "papers-hint": {
    room: "papers",
    run: async (page) => {
      await sitExam(page);
      await page.getByRole("button", { name: /Ask DHI to open this question/ }).click();
    },
  },
  "papers-submit": {
    room: "papers",
    run: async (page) => {
      await sitExam(page);
      await page.getByRole("button", { name: "Stop" }).click();
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
  "meals-log": {
    room: "day",
    run: async (page) => {
      await page.getByRole("button", { name: /Log a plate/ }).click();
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
  "blog-write": {
    room: "blog",
    run: async (page) => {
      await page.getByRole("button", { name: "Write", exact: true }).click();
    },
  },
  "blog-read": {
    room: "blog",
    run: async (page) => {
      await page.locator("button:has(img)").first().click();
    },
  },
  "hour-all": {
    room: "hour",
    run: async (page) => {
      await page.getByRole("button", { name: /View all/ }).click();
    },
  },
  "hour-chat": {
    room: "hour",
    run: async (page) => {
      await page.getByRole("button", { name: "Chat", exact: true }).click();
    },
  },
  "hour-dnd": {
    room: "hour",
    run: async (page) => {
      await page.getByRole("button", { name: "dnd", exact: true }).click();
    },
  },
  "hour-away": {
    room: "hour",
    run: async (page) => {
      await page.getByRole("button", { name: "away", exact: true }).click();
    },
  },
  // From 1024 the Sittings rail and the drawing pane are part of the page, so there is nothing to open.
  "dhi-sittings": {
    room: "dhi",
    run: async (page, width) => {
      if (isTouchWidth(width))
        await page.getByRole("button", { name: "Sittings", exact: true }).click();
    },
  },
  "dhi-drawing": {
    room: "dhi",
    run: async (page, width) => {
      if (isTouchWidth(width)) await page.getByRole("button", { name: /Open drawing/ }).click();
    },
  },
  "signin-invite": {
    room: "signin",
    run: async (page) => {
      await page.getByRole("button", { name: "Invite letter" }).click();
    },
  },
  "papers-menu": {
    room: "papers",
    run: async (page, width) => {
      await sitExam(page);
      await openMenuIfDrawer(page, width);
    },
  },
};

// The demo days are in September, so open that month first: by its row on touch, by the strip on desktop.
async function openMoodDay(page, width) {
  if (isTouchWidth(width)) {
    await page.getByRole("button", { name: "Open September" }).click();
    await page.locator("[data-day-cell]:not([disabled])").first().click();
  } else {
    await page.locator('button[title^="2026-09-"]:not([disabled])').first().click();
  }
}

async function sitExam(page) {
  await page
    .locator("article", { hasText: "Biology" })
    .getByRole("button", { name: "Open sitting" })
    .click();
  await page.getByRole("button", { name: "Start sitting" }).first().click();
}

async function visit(page, base, target, width) {
  const scene = SCENES[target];
  const room = scene ? scene.room : target;
  // The sign in page shows at `/` after Leave; `/home` always shows the house.
  await page.goto(room === "signin" ? `${base}/` : `${base}/home`, { waitUntil: "networkidle" });
  // Every visit starts from a fresh demo state, so one scene cannot leak into the next.
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  if (room === "signin") {
    await openMenuIfDrawer(page, width);
    await page.locator('[data-testid="leave"]:visible').click();
    // The house is gone once the sign in form is up.
    await page.getByTestId("menu-button").waitFor({ state: "detached", timeout: 5000 });
  } else if (room !== "home") {
    await openMenuIfDrawer(page, width);
    await page.locator(`[data-room="${room}"]:visible`).click();
  }
  if (scene) await scene.run(page, width);
  await page.waitForTimeout(500);
  return page.evaluate(collectFacts);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rooms = args.room ? [args.room] : [...ROOMS, ...Object.keys(SCENES), "signin"];
  const widths = args.width ? [args.width] : WIDTHS;
  if (args.shots) mkdirSync(args.shots, { recursive: true });

  const browser = await chromium.launch();
  const rows = [];
  try {
    for (const width of widths) {
      const touch = isTouchWidth(width);
      const context = await browser.newContext({
        viewport: { width, height: touch ? 740 : 800 },
        hasTouch: touch,
        isMobile: touch,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      for (const room of rooms) {
        try {
          const facts = await visit(page, args.url, room, width);
          rows.push(judge(room, width, facts));
          if (args.shots) {
            // A fixed Sheet is only placed right in a viewport shot, so use one while a dialog is open.
            const dialog = await page.evaluate(() =>
              Boolean(document.querySelector('[role="dialog"]')),
            );
            await page.screenshot({
              path: join(args.shots, `${room}-${width}.png`),
              fullPage: !dialog,
            });
          }
        } catch (err) {
          rows.push({ room, width, ok: false, error: String(err.message ?? err).split("\n")[0] });
        }
      }
      await context.close();
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
