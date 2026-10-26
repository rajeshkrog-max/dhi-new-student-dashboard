import assert from "node:assert/strict";
import { test } from "node:test";
import { LAMP_IDS, ROOM_IDS } from "@dhi/backend/brainCodes";
import { LAMP_COPY, LANGS, ROOM_COPY } from "./brain-words.ts";
import { LINK_COPY, PARENT_COPY, PARENT_LAMP_ORDER, PARENT_WORDS_APPROVED } from "./parent-words.ts";

// The Brain's copy rules (brain-words.test.ts) hold the parent page's words too: no ranking word, no clinical word, no judging of food, no order, no
// cause, and no digit that is not a count, a date or a lamp value. A denial of a ranking ("never a rank") is allowed.
const RANKING = /\b(best|worst|top|bottom|rank\w*|behind|ahead|topper|average|bright|dull|weak|smart|lazy|fail\w*|poor|better than|worse than|winner|loser|behtar|kamzor|aalsi|haar|jeet)\b/i;
const CLINICAL = /\b(depress\w*|anxiety|anxious|disorder\w*|diagnos\w*|symptom\w*|illness|patient\w*|therap\w*|clinical|suicid\w*|self-harm|mental health|medicat\w*|psychiatr\w*|syndrome)\b/i;
const FOOD = /\b(junk|unhealthy|healthy|clean eating|diet\w*|calorie\w*|weight|fat|skip\w*|fewer|eat less|cheat\w*|guilt\w*|good food|bad food|overeat\w*|binge\w*|starv\w*)\b/i;
const CAUSE = /\b(because|causes?|caused|due to|makes? you|made you|leads? to|results? in|reason|kyunki|isliye|wajah|karan|kaaran)\b/i;
const ORDERS = /\b(should|must|need to|have to|try to|make sure|do not forget|keep it up|keep going|zaroor|karna hoga)\b/i;
// A parent is not told what to do about a child's days, and a child is not compared with another.
const COMPARE = /\b(other (students|children|kids)|classmates|class average|than most|compared)\b/i;
const strip = (s: string) => s.replace(/never a rank/gi, "").replace(/kabhi rank nahi hai/gi, "").replace(/not a grade/gi, "").replace(/grade nahi hai/gi, "");

test("covers AC-9: the words are drafts until the owner approves them", () => {
  assert.equal(PARENT_WORDS_APPROVED, false);
});

test("covers AC-9: both languages have every line, and every lamp and room the server can send has a name", () => {
  assert.deepEqual(Object.keys(PARENT_COPY.en).sort(), Object.keys(PARENT_COPY.hi).sort());
  assert.deepEqual([...PARENT_LAMP_ORDER].sort(), [...LAMP_IDS].sort());
  for (const lamp of LAMP_IDS) for (const lang of LANGS) assert.ok(LAMP_COPY[lamp][lang].name, `${lamp} ${lang}`);
  for (const room of ROOM_IDS) for (const lang of LANGS) assert.ok(ROOM_COPY[room]?.[lang], `${room} ${lang}`);
});

test("covers AC-9: every sentence passes the Brain's copy rules in both languages", () => {
  const lines: string[] = [];
  for (const lang of LANGS) {
    const c = PARENT_COPY[lang];
    for (const name of ["Suzzy", "Asha"]) {
      lines.push(c.title(name), c.intro(name), c.lampsNote(name), c.notEnough(name), c.neverShown(name));
    }
    lines.push(c.range("Mon, 13 Oct", "Sun, 19 Oct"), c.roomsTitle, c.lampsTitle, c.lampEmpty, c.until("19 Jan 2027"), c.draft, c.loading, c.goneTitle, c.gone, c.slowTitle, c.slow, c.retry);
    for (const d of [0, 1, 7]) lines.push(c.roomDays(d));
    for (const v of [0, 55, 100]) lines.push(c.lampValue(v));
  }
  lines.push(...Object.values(LINK_COPY).filter((x): x is string => typeof x === "string"), LINK_COPY.live("19 Jan 2027"));
  for (const raw of lines) {
    const line = strip(raw);
    assert.doesNotMatch(line, RANKING, raw);
    assert.doesNotMatch(line, CLINICAL, raw);
    assert.doesNotMatch(line, FOOD, raw);
    assert.doesNotMatch(line, CAUSE, raw);
    assert.doesNotMatch(line, ORDERS, raw);
    assert.doesNotMatch(line, COMPARE, raw);
  }
});

test("covers AC-3: the page never promises or names a mood value, a pattern, the support flag or a note as something shown", () => {
  for (const lang of LANGS) {
    const c = PARENT_COPY[lang];
    // It says what is never shown; it must not describe a sentence about the child's feelings.
    assert.match(c.neverShown("Asha"), /mood/i);
    assert.doesNotMatch(c.intro("Asha") + c.lampsNote("Asha"), /mood|sad|low|support|pattern/i);
  }
});
