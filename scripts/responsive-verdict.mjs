// @ts-check
// Pure rules for `pnpm responsive:sweep` (spec house/0001). The runner collects raw facts from
// the page; everything that decides pass or fail lives here so it can be tested with node:test.

export const WIDTHS = [360, 768, 1024, 1280];
export const MIN_TARGET = 44;
export const MIN_TEXT = 12;
// The most layout shift a screen may show from navigation until it settles (spec house/0003, AC-5).
export const MAX_LAYOUT_SHIFT = 0.05;
// The seven column mood calendar may be 42 wide and 44 tall (named exception, AC-7).
export const DAY_CELL_MIN_WIDTH = 42;

export const ROOMS = [
  "home",
  "blog",
  "papers",
  "day",
  "mood",
  "habits",
  "sleep",
  "modules",
  "dhi",
  "hour",
  "counsel",
  "progress",
  "data",
];

/** The house side menu shows from 1024 pixels; below that the drawer and touch rules apply. */
export function isTouchWidth(width) {
  return width < 1024;
}

/**
 * @typedef {{ sel: string, left: number, right: number, limitLeft?: number, limitRight?: number }} Offender
 * @typedef {{ sel: string, w: number, h: number, decorative?: boolean, inSentence?: boolean, dayCell?: boolean }} Target
 * @typedef {{ sel: string, size: number, text: string, decorative?: boolean }} TextItem
 * @typedef {{ sel: string, bottom: number }} FirstScreenItem
 * @typedef {{
 *   viewport: number,
 *   height?: number,
 *   scrollWidth: number,
 *   touch: boolean,
 *   offenders: Offender[],
 *   targets: Target[],
 *   texts: TextItem[],
 *   firstScreen?: FirstScreenItem[],
 *   cls?: number,
 *   page?: { loading: boolean, slowLine: boolean, tryAgain: boolean, brandBar: boolean, h1: string, buttons: string[], backHref: string | null, leaked: string[] },
 * }} Facts
 * What a screen is expected to show, for the loading, error and not found screens (spec house/0003, AC-4 to AC-7).
 * @typedef {{
 *   loading?: boolean,
 *   slow?: boolean,
 *   notSlow?: boolean,
 *   h1?: string,
 *   buttons?: string[],
 *   backHref?: string,
 *   brandBar?: boolean,
 *   settles?: boolean,
 * }} Expect
 */

/**
 * AC-5 and AC-6: no sideways page scroll, and no visible element past the screen edge or past the
 * box that clips it (that would cut it off). The runner sends the clip limits it measured.
 */
export function findOverflow(/** @type {Facts} */ facts) {
  const problems = [];
  if (facts.scrollWidth > facts.viewport + 1) {
    problems.push(`page scrolls sideways (${facts.scrollWidth} > ${facts.viewport})`);
  }
  for (const o of facts.offenders) {
    const lo = o.limitLeft ?? 0;
    const hi = o.limitRight ?? facts.viewport;
    if (o.right > hi + 1 || o.left < lo - 1) {
      problems.push(
        `${o.sel} spans ${Math.round(o.left)} to ${Math.round(o.right)} (room ${Math.round(lo)} to ${Math.round(hi)})`,
      );
    }
  }
  return problems;
}

/** AC-7: controls on touch widths are at least 44 by 44, with named exceptions. */
export function findSmallTargets(/** @type {Facts} */ facts) {
  if (!facts.touch) return [];
  const problems = [];
  for (const t of facts.targets) {
    if (t.decorative || t.inSentence) continue;
    const minW = t.dayCell ? DAY_CELL_MIN_WIDTH : MIN_TARGET;
    if (Math.round(t.w) < minW || Math.round(t.h) < MIN_TARGET) {
      problems.push(`${t.sel} is ${Math.round(t.w)}x${Math.round(t.h)}`);
    }
  }
  return problems;
}

/** AC-8: text a student reads is at least 12 pixels on touch widths. */
export function findSmallText(/** @type {Facts} */ facts) {
  if (!facts.touch) return [];
  const problems = [];
  for (const t of facts.texts) {
    if (t.decorative) continue;
    if (t.size < MIN_TEXT) problems.push(`${t.sel} is ${t.size}px "${t.text.slice(0, 24)}"`);
  }
  return problems;
}

/**
 * AC-13: parts a room marks data-first-screen (the DHI desk composer) end inside the first screen
 * on touch widths, so the student never scrolls the page to reach them. Measured with the page at
 * the top and the keyboard closed.
 */
export function findOffScreen(/** @type {Facts} */ facts) {
  if (!facts.touch || !facts.height) return [];
  const problems = [];
  for (const item of facts.firstScreen ?? []) {
    if (item.bottom > facts.height + 1) {
      problems.push(`${item.sel} ends at ${Math.round(item.bottom)} of ${facts.height}`);
    }
  }
  return problems;
}

/**
 * AC-4 to AC-7: a loading, error or not found screen shows what it should, and nothing it should not. `leaked` holds any student name, class
 * or raw error text the runner found on the page.
 */
export function findScreenProblems(/** @type {Facts} */ facts, /** @type {Expect} */ expect = {}) {
  const problems = [];
  const page = facts.page;
  if (!page) return expect && Object.keys(expect).length ? ["no page facts were collected"] : [];
  if (expect.loading !== undefined && page.loading !== expect.loading) {
    problems.push(expect.loading ? 'no "Loading" status for a screen reader' : 'a "Loading" status is still showing');
  }
  if (expect.slow === true && !(page.slowLine && page.tryAgain)) problems.push("the slow line and Try again are missing after 8 seconds");
  if (expect.notSlow === true && (page.slowLine || page.tryAgain)) problems.push("the slow line shows before 8 seconds");
  if (expect.h1 !== undefined && page.h1 !== expect.h1) problems.push(`title is "${page.h1}", expected "${expect.h1}"`);
  if (expect.buttons) {
    for (const label of expect.buttons) if (!page.buttons.includes(label)) problems.push(`no "${label}" button`);
    if (page.buttons.length !== expect.buttons.length) problems.push(`buttons are ${JSON.stringify(page.buttons)}, expected ${JSON.stringify(expect.buttons)}`);
  }
  if (expect.backHref !== undefined && page.backHref !== expect.backHref) problems.push(`Back to the house goes to ${page.backHref}, expected ${expect.backHref}`);
  if (expect.brandBar !== undefined && page.brandBar !== expect.brandBar) {
    problems.push(expect.brandBar ? "the brand top bar is missing" : "a brand top bar shows where there should be none");
  }
  for (const leak of page.leaked) problems.push(`shows "${leak}"`);
  return problems;
}

/** AC-5: the screen that replaces a skeleton does not move the frame. */
export function findLayoutShift(/** @type {Facts} */ facts) {
  if (facts.cls === undefined || facts.cls <= MAX_LAYOUT_SHIFT) return [];
  return [`layout shift ${facts.cls.toFixed(3)} is over ${MAX_LAYOUT_SHIFT}`];
}

/** One verdict row for a room, or a screen, at a width. */
export function judge(room, width, /** @type {Facts} */ facts, /** @type {Expect | undefined} */ expect = undefined) {
  const overflow = findOverflow(facts);
  const targets = findSmallTargets(facts);
  const text = findSmallText(facts);
  const screen = findOffScreen(facts);
  const shown = [...findScreenProblems(facts, expect), ...findLayoutShift(facts)];
  return {
    room,
    width,
    overflow,
    targets,
    text,
    screen,
    shown,
    ok: !overflow.length && !targets.length && !text.length && !screen.length && !shown.length,
  };
}

export function exitCodeFor(rows) {
  return rows.every((r) => r.ok) ? 0 : 1;
}

function cell(row) {
  if (!row) return "-";
  if (row.error) return "ERR";
  if (row.ok) return "ok";
  const parts = [];
  if (row.overflow.length) parts.push(`ov${row.overflow.length}`);
  if (row.targets.length) parts.push(`t${row.targets.length}`);
  if (row.text.length) parts.push(`x${row.text.length}`);
  if (row.screen?.length) parts.push(`s${row.screen.length}`);
  if (row.shown?.length) parts.push(`p${row.shown.length}`);
  return parts.join(" ");
}

/** A plain table: one line per room, one column per width. ov = overflow, t = targets, x = text. */
export function formatTable(rows, widths = WIDTHS) {
  const rooms = [...new Set(rows.map((r) => r.room))];
  const col = 14;
  const name = Math.max(10, ...rooms.map((r) => r.length + 2));
  const head = ["room".padEnd(name), ...widths.map((w) => String(w).padEnd(col))].join("");
  const lines = [head];
  for (const room of rooms) {
    const line = widths.map((w) => cell(rows.find((r) => r.room === room && r.width === w)));
    lines.push([room.padEnd(name), ...line.map((c) => c.padEnd(col))].join(""));
  }
  lines.push(
    "",
    "ov = sideways overflow, t = small target, x = small text, s = off the first screen, p = wrong or shifting screen",
  );
  return lines.join("\n");
}

export function formatFailures(rows, perKind = 6) {
  const out = [];
  for (const r of rows) {
    if (r.ok) continue;
    if (r.error) {
      out.push(`${r.room} @ ${r.width}: ERROR ${r.error}`);
      continue;
    }
    for (const [kind, list] of [
      ["overflow", r.overflow],
      ["target", r.targets],
      ["text", r.text],
      ["first screen", r.screen ?? []],
      ["screen", r.shown ?? []],
    ]) {
      if (!list.length) continue;
      out.push(`${r.room} @ ${r.width} ${kind} (${list.length})`);
      for (const p of list.slice(0, perKind)) out.push(`    ${p}`);
      if (list.length > perKind) out.push(`    ... ${list.length - perKind} more`);
    }
  }
  return out.join("\n");
}
