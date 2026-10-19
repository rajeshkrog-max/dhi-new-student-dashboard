import assert from "node:assert/strict";
import test from "node:test";
import {
  WIDTHS,
  exitCodeFor,
  findOffScreen,
  findLayoutShift,
  findOverflow,
  findScreenProblems,
  findSmallTargets,
  findSmallText,
  formatTable,
  isTouchWidth,
  judge,
} from "./responsive-verdict.mjs";

const base = {
  viewport: 360,
  scrollWidth: 360,
  touch: true,
  offenders: [],
  targets: [],
  texts: [],
};

test("touch starts below 1024", () => {
  assert.equal(isTouchWidth(360), true);
  assert.equal(isTouchWidth(1023), true);
  assert.equal(isTouchWidth(1024), false);
  assert.deepEqual(WIDTHS, [360, 768, 1024, 1280]);
});

test("a page that scrolls sideways fails", () => {
  assert.equal(findOverflow({ ...base, scrollWidth: 361 }).length, 0);
  assert.equal(findOverflow({ ...base, scrollWidth: 420 }).length, 1);
});

test("an element past the edge fails, one inside passes", () => {
  const offenders = [
    { sel: "div.a", left: 10, right: 359 },
    { sel: "div.b", left: 10, right: 400 },
    { sel: "div.c", left: -30, right: 100 },
  ];
  const found = findOverflow({ ...base, offenders });
  assert.equal(found.length, 2);
  assert.match(found[0], /div\.b/);
});

test("an element cut off by the box around it fails", () => {
  const offenders = [
    { sel: "div.tile", left: 20, right: 340, limitLeft: 12, limitRight: 300 },
    { sel: "div.fits", left: 20, right: 290, limitLeft: 12, limitRight: 300 },
  ];
  const found = findOverflow({ ...base, offenders });
  assert.equal(found.length, 1);
  assert.match(found[0], /div\.tile/);
});

test("a part that must be on the first screen but ends below it fails", () => {
  const firstScreen = [
    { sel: "div.composer", bottom: 766 },
    { sel: "div.fits", bottom: 691 },
  ];
  const found = findOffScreen({ ...base, height: 740, firstScreen });
  assert.equal(found.length, 1);
  assert.match(found[0], /div\.composer/);
  assert.equal(findOffScreen({ ...base, touch: false, height: 740, firstScreen }).length, 0);
  assert.equal(findOffScreen({ ...base, firstScreen }).length, 0);
});

test("targets under 44 fail on touch widths only", () => {
  const targets = [
    { sel: "button.big", w: 44, h: 44 },
    { sel: "button.short", w: 60, h: 40 },
    { sel: "button.thin", w: 30, h: 48 },
  ];
  assert.equal(findSmallTargets({ ...base, targets }).length, 2);
  assert.equal(findSmallTargets({ ...base, touch: false, targets }).length, 0);
});

test("named target exceptions pass", () => {
  const targets = [
    { sel: "a.inline", w: 40, h: 16, inSentence: true },
    { sel: "span.badge", w: 10, h: 10, decorative: true },
    { sel: "button.day", w: 42, h: 44, dayCell: true },
  ];
  assert.deepEqual(findSmallTargets({ ...base, targets }), []);
  const tooNarrow = [{ sel: "button.day", w: 40, h: 44, dayCell: true }];
  assert.equal(findSmallTargets({ ...base, targets: tooNarrow }).length, 1);
  const tooShort = [{ sel: "button.day", w: 43, h: 40, dayCell: true }];
  assert.equal(findSmallTargets({ ...base, targets: tooShort }).length, 1);
});

test("text under 12 fails unless decorative, and only on touch widths", () => {
  const texts = [
    { sel: "p.a", size: 12, text: "fine" },
    { sel: "p.b", size: 11, text: "too small" },
    { sel: "span.c", size: 9, text: "3", decorative: true },
  ];
  const found = findSmallText({ ...base, texts });
  assert.equal(found.length, 1);
  assert.match(found[0], /p\.b/);
  assert.equal(findSmallText({ ...base, touch: false, texts }).length, 0);
});

test("judge and exit code agree", () => {
  const good = judge("home", 360, base);
  const bad = judge("papers", 360, { ...base, scrollWidth: 500 });
  assert.equal(good.ok, true);
  assert.equal(bad.ok, false);
  assert.equal(exitCodeFor([good]), 0);
  assert.equal(exitCodeFor([good, bad]), 1);
});

test("the table has a line per room and a column per width", () => {
  const rows = [
    judge("home", 360, base),
    judge("home", 768, { ...base, viewport: 768, scrollWidth: 800 }),
    { room: "mood", width: 360, error: "boom", ok: false },
  ];
  const table = formatTable(rows);
  assert.match(table, /home\s+ok\s+ov1/);
  assert.match(table, /mood\s+ERR/);
});

const screenFacts = (page, cls) => ({ ...base, page: { loading: false, slowLine: false, tryAgain: false, brandBar: true, h1: "", buttons: [], backHref: null, leaked: [], ...page }, cls });

test("a loading screen must announce Loading, and only show the slow line after 8 seconds", () => {
  assert.deepEqual(findScreenProblems(screenFacts({ loading: true }), { loading: true, notSlow: true }), []);
  assert.equal(findScreenProblems(screenFacts({ loading: false }), { loading: true }).length, 1);
  assert.equal(findScreenProblems(screenFacts({ loading: true, slowLine: true, tryAgain: true }), { notSlow: true }).length, 1);
  assert.deepEqual(findScreenProblems(screenFacts({ loading: true, slowLine: true, tryAgain: true }), { loading: true, slow: true }), []);
  assert.equal(findScreenProblems(screenFacts({ loading: true, slowLine: true }), { slow: true }).length, 1);
});

test("an error screen has its title, exactly its buttons, the brand bar, and leaks nothing", () => {
  const expect = { h1: "Something went wrong", buttons: ["Try again", "Back to the house"], brandBar: true, backHref: "/dashboard" };
  const good = screenFacts({ h1: "Something went wrong", buttons: ["Try again", "Back to the house"], backHref: "/dashboard" });
  assert.deepEqual(findScreenProblems(good, expect), []);
  assert.equal(findScreenProblems(screenFacts({ ...good.page, buttons: ["Try again"] }), expect).length > 0, true);
  assert.equal(findScreenProblems(screenFacts({ ...good.page, brandBar: false }), expect).length, 1);
  assert.equal(findScreenProblems(screenFacts({ brandBar: true }), { brandBar: false }).length, 1);
  assert.deepEqual(findScreenProblems(screenFacts({ brandBar: false }), { brandBar: false }), []);
  assert.equal(findScreenProblems(screenFacts({ ...good.page, backHref: "/" }), expect).length, 1);
  assert.equal(findScreenProblems(screenFacts({ ...good.page, leaked: ["Sweep Student"] }), expect).length, 1);
});

test("layout shift over 0.05 fails", () => {
  assert.deepEqual(findLayoutShift({ ...base, cls: 0.05 }), []);
  assert.deepEqual(findLayoutShift({ ...base }), []);
  assert.equal(findLayoutShift({ ...base, cls: 0.2 }).length, 1);
  assert.equal(judge("settle", 360, { ...base, cls: 0.2 }).ok, false);
});
