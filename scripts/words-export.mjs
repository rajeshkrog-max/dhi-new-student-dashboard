// Writes every drafted word of the house into two files the owner can read in one sitting (production run, Phase 3):
//   node scripts/words-export.mjs
// docs/launch/words/english.md and docs/launch/words/hinglish.md, grouped by room, read straight from the words files the screens use, so the lists
// never drift from the code. A wording that is a function (a line with a name, a date or a count in it) is shown with sample values in braces, such as
// {name}. The Hinglish lines are the `hi` halves of the Brain and parent words; everything else is English. Run it again after any wording change.
import { writeFileSync, mkdirSync } from "node:fs";

const ROOMS = [
  { title: "The house notice and the parent consent (consent screen)", file: "./packages/backend/convex/consentText.ts", pick: ["HOUSE_NOTICE_LINES", "HOUSE_PARENT_LINES"], gate: "HOUSE_WORDS_APPROVED" },
  { title: "People, invites and refusals (house words)", file: "./src/lib/dhi/house-words.ts", gate: "HOUSE_WORDS_APPROVED" },
  { title: "Mood room", file: "./src/lib/dhi/mood-words.ts", gate: "MOOD_WORDS_APPROVED" },
  { title: "Mood room: the DHI lines", file: "./src/lib/dhi/mood-lines.ts", gate: "MOOD_WORDS_APPROVED" },
  { title: "Habits room", file: "./src/lib/dhi/habits/words.ts", gate: "HABIT_WORDS_APPROVED" },
  { title: "Sleep room", file: "./src/lib/dhi/sleep-words.ts", gate: "SLEEP_WORDS_APPROVED" },
  { title: "DHI desk: the screen", file: "./src/lib/dhi/desk-words.ts", gate: "DESK_WORDS_APPROVED" },
  { title: "DHI desk: the instructions given to the model", file: "./packages/backend/convex/deskRules.ts", pick: ["DESK_SYSTEM_PROMPT", "WRITE_SYSTEM_PROMPT", "PAPER_SYSTEM_PROMPT", "MOCK_SYSTEM_PROMPT", "STORY_SYSTEM_PROMPT", "DRAW_SYSTEM_PROMPT"], gate: "DESK_WORDS_APPROVED" },
  { title: "Progress (the Brain report)", file: "./src/lib/dhi/brain-words.ts", gate: "BRAIN_WORDS_APPROVED" },
  { title: "The weekly parent page and the link on Your data", file: "./src/lib/dhi/parent-words.ts", gate: "PARENT_WORDS_APPROVED" },
];
// Not words: switches, lists of codes, helpers that return a boolean.
const SKIP = /^(.*_APPROVED|LANGS|isLang|isEvidenceItem|PARENT_LAMP_ORDER|NEW_LINES|HELPLINE_NUMBER|gunaOf|roomName|codeOf|refusalWords|badRowWords|moodRefusal|deskRefusal)$/;
// A sample value for a wording function: it reads as {value} in words and as 7 in sums, and any field of it is another sample (so {a}, {n} work).
const sample = (label) =>
  new Proxy(function () {}, {
    get: (_, key) => (key === Symbol.toPrimitive ? (hint) => (hint === "number" ? 7 : `{${label}}`) : typeof key === "string" ? sample(key) : undefined),
    apply: () => `{${label}}`,
  });
const SAMPLE = [sample("name"), sample("value"), sample("n"), sample("m")];

function linesOf(value, path, out, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return;
  if (typeof value === "string") {
    if (value.trim()) out.push({ path, text: value });
  } else if (typeof value === "number" || typeof value === "boolean") {
    return;
  } else if (typeof value === "function") {
    try {
      const r = value(...SAMPLE.slice(0, Math.max(value.length, 1)));
      linesOf(r, `${path}(…)`, out, depth + 1);
    } catch {
      /* a helper that needs real input is not a wording */
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => linesOf(v, `${path}[${i + 1}]`, out, depth + 1));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) linesOf(v, path ? `${path}.${k}` : k, out, depth + 1);
  }
}
// A line is Hinglish when its path has a `hi` part (the Brain and parent words keep `en` and `hi` side by side).
const isHinglish = (path) => /(^|\.)hi(\.|\(|\[|$)/.test(path);

const english = [];
const hinglish = [];
for (const room of ROOMS) {
  const mod = await import(new URL(`../${room.file.slice(2)}`, import.meta.url));
  const lines = [];
  for (const [name, value] of Object.entries(mod)) {
    if (SKIP.test(name) || (room.pick && !room.pick.includes(name))) continue;
    linesOf(value, name, lines);
  }
  const en = lines.filter((l) => !isHinglish(l.path));
  const hi = lines.filter((l) => isHinglish(l.path));
  const approved = mod[room.gate] === true ? "approved" : "a draft";
  const section = (list) => [`## ${room.title}`, "", `Switch: \`${room.gate}\` (${approved}). File: \`${room.file.slice(2)}\`.`, "", ...list.map((l) => `- \`${l.path}\`: ${l.text.replace(/\s*\n\s*/g, " ")}`), ""];
  if (en.length) english.push(...section(en));
  if (hi.length) hinglish.push(...section(hi));
}

const head = (lang, other) => [
  `# Drafted words: ${lang}`,
  "",
  `Every word the house shows a student, a parent or the model, in ${lang}, read from the code by \`scripts/words-export.mjs\` on ${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}. All of them are drafts until the owner approves them; approving a room is flipping its switch (\`docs/launch/OWNER-GATES.md\`). Values in braces such as {name} are filled in on the screen, and a number worked out on the screen shows here as 7. The ${other} lines are in the other file. Mark a line to change in the margin, or say which path (the code name before each line) and the new words.`,
  "",
];
mkdirSync("docs/launch/words", { recursive: true });
writeFileSync("docs/launch/words/english.md", [...head("English", "Hinglish"), ...english].join("\r\n"));
writeFileSync("docs/launch/words/hinglish.md", [...head("Hinglish", "English"), ...hinglish].join("\r\n"));
console.log(`english.md: ${english.filter((l) => l.startsWith("- ")).length} lines; hinglish.md: ${hinglish.filter((l) => l.startsWith("- ")).length} lines`);
