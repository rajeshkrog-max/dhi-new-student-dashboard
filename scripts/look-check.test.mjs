import assert from "node:assert/strict";
import test from "node:test";
import { compare, scanText } from "./look-check.mjs";

test("a stray hex colour is a hit, and a look-ok marker exempts it", () => {
  assert.equal(scanText('const a = "#c45c4a";').hex, 1);
  assert.equal(scanText('const a = "#c45c4a"; // look-ok: a picture colour').hex, 0);
  assert.equal(scanText('<div className="bg-[#2a2438]" />').hex, 1);
});

test("a page link or a word that only starts like a hex is not a colour", () => {
  assert.equal(scanText('<a href="#main-content">Skip</a>').hex, 0);
  assert.equal(scanText("// the colour #c45c4a is danger").hex, 0);
  assert.equal(scanText("/* #c45c4a */ const a = 1;").hex, 0);
});

test("rgb, rgba and hsl values are hits", () => {
  const hits = scanText("a { color: rgba(0, 0, 0, 0.5); background: hsl(10 20% 30%); }");
  assert.equal(hits["color-function"], 2);
});

test("an SVG fill or stroke hex counts once, as svg-paint", () => {
  const hits = scanText('<path fill="#e8c36a" stroke="#122018" />');
  assert.equal(hits["svg-paint"], 2);
  assert.equal(hits.hex, 0);
});

test("a colour in an inline style is a hit, a CSS variable is not", () => {
  assert.equal(scanText('<i style={{ color: "red" }} />')["inline-style"], 1);
  assert.equal(scanText('<i style={{\n  background: "white",\n}} />')["inline-style"], 1);
  assert.equal(scanText('<i style={{ color: "var(--color-home)" }} />')["inline-style"], 0);
  assert.equal(scanText('<i style={{ width: "40px" }} />')["inline-style"], 0);
});

test("free and big corner sizes are hits, token corners are not", () => {
  assert.equal(scanText('className="rounded-[24px] rounded-2xl rounded-t-xl md:rounded-3xl"').rounded, 4);
  assert.equal(scanText('className="rounded-card rounded-panel rounded-control rounded-chip rounded-full rounded-lg"').rounded, 0);
});

test("styles.css exempts the @theme block and the keyframes", () => {
  const css = [
    "@theme {",
    "  --color-page: #f4f0ea;",
    "}",
    "@keyframes glow {",
    "  50% { box-shadow: 0 0 0 rgba(0, 0, 0, 0.2); }",
    "}",
    "body { background: #07070c; }",
  ].join("\n");
  assert.equal(scanText(css, { isStyles: true }).hex, 1);
  assert.equal(scanText(css, { isStyles: true })["color-function"], 0);
  // The same text outside styles.css has no exemption.
  assert.equal(scanText(css).hex, 2);
  assert.equal(scanText(css)["color-function"], 1);
});

test("compare fails only when a count goes up", () => {
  const baseline = { "src/a.tsx": { hex: 2, rounded: 3 } };
  assert.deepEqual(compare({ "src/a.tsx": { hex: 2, rounded: 3 } }, baseline).worse, []);
  assert.equal(compare({ "src/a.tsx": { hex: 3, rounded: 3 } }, baseline).worse.length, 1);
  assert.equal(compare({ "src/b.tsx": { hex: 1 } }, baseline).worse.length, 1);
  const lower = compare({ "src/a.tsx": { hex: 1, rounded: 3 } }, baseline);
  assert.equal(lower.worse.length, 0);
  assert.equal(lower.better.length, 1);
});
