import assert from "node:assert/strict";
import { test } from "node:test";
import { CONNECTION_IDS, EVIDENCE_ITEMS, HIDE_DAYS, LAMP_IDS, MOVEMENTS, PATTERN_IDS, ROOM_IDS } from "@dhi/backend/brainCodes";
import {
  BRAIN_WORDS_APPROVED,
  CONNECTION_COPY,
  EXPRESSION_COPY,
  HELPLINE_NUMBER,
  INPUT_COPY,
  ITEM_COPY,
  LAMP_COPY,
  LANGS,
  MOVE_COPY,
  PATTERN_COPY,
  ROOM_COPY,
  SUPPORT_COPY,
  UI,
  connectionText,
  dayLabel,
  patternText,
  type Lang,
} from "./brain-words.ts";

// The Master Spec's copy lint for the Brain (spec house/0020): no ranking word, no clinical word, no judging of food, "tend to" and never "cause", no word that
// tells a student what to do, and no digit that is not a count, a date, the helpline or one of the fixed windows. English and Hinglish are held to the same rules.
const RANKING = /\b(best|worst|top|bottom|rank\w*|behind|ahead|topper|average|bright|dull|weak|smart|lazy|fail\w*|poor|better than|worse than|winner|loser|behtar|kamzor|aalsi|haar|jeet)\b/i;
const CLINICAL = /\b(depress\w*|anxiety|anxious|disorder\w*|diagnos\w*|symptom\w*|illness|patient\w*|therap\w*|clinical|suicid\w*|self-harm|mental health|medicat\w*|psychiatr\w*|syndrome)\b/i;
const FOOD = /\b(junk|unhealthy|healthy|clean eating|diet\w*|calorie\w*|weight|fat|skip\w*|fewer|eat less|eating less|less food|cheat\w*|guilt\w*|good food|bad food|overeat\w*|binge\w*|starv\w*|bhookha|vajan|motapa|kam khana|kam khao)\b/i;
const CAUSE = /\b(because|causes?|caused|due to|makes? you|made you|leads? to|results? in|reason|kyunki|isliye|wajah|karan|kaaran)\b/i;
const ORDERS = /\b(should|must|need to|have to|try to|make sure|do not forget|keep it up|keep going|zaroor|karna hoga)\b/i;
// A denial of a ranking ("never a rank") is allowed; the words are removed before the lint.
const strip = (s: string) => s.replace(/never a rank/gi, "").replace(/kabhi rank nahi hai/gi, "");

const SAMPLES = {
  mood_habits_quiet: [
    { from: "2026-10-11", to: "2026-10-18", lowDays: 5, chainDays: 3, window: 14 },
    { from: "2026-10-11", to: "2026-10-18", lowDays: 4, chainDays: 4, window: 14 },
  ],
  steady_rhythm: [{ window: 14, hourDays: 11, hourOpen: 13, habitDays: 12, habitOpen: 9, papers: 7 }],
  packaged_quiet: [
    { heavyDays: 4, chainDays: 2, window: 14 },
    { heavyDays: 6, chainDays: 6, window: 14 },
  ],
} as const;

// The connections (house spec 0023): the two means and the days behind them; the breakfast pair has the focus out of five with a decimal.
const CONNECTION_SAMPLES = [
  { a: 80, b: 30, n: 30 },
  { a: 100, b: 0, n: 32 },
  { a: 4.5, b: 2.5, n: 32 },
] as const;

function everySentence(lang: Lang): string[] {
  const out: string[] = [];
  for (const id of CONNECTION_IDS) {
    for (const params of CONNECTION_SAMPLES) {
      const t = connectionText(id, lang, params)!;
      out.push(t.title, t.text, t.note);
    }
  }
  for (const id of PATTERN_IDS) {
    for (const params of SAMPLES[id]) {
      const t = patternText(id, lang, params)!;
      out.push(t.title, t.text, t.note);
    }
  }
  const e = EXPRESSION_COPY[lang];
  out.push(e.title, e.text(3, "2026-10-18"), e.note);
  const s = SUPPORT_COPY[lang];
  out.push(s.title, s.text(4), s.note);
  for (const item of EVIDENCE_ITEMS) out.push(ITEM_COPY[item][lang]);
  for (const id of LAMP_IDS) out.push(LAMP_COPY[id][lang].name, LAMP_COPY[id][lang].meaning);
  for (const copy of Object.values(INPUT_COPY)) out.push(copy[lang]);
  for (const m of [...MOVEMENTS, "none"] as const) out.push(MOVE_COPY[m][lang]);
  const ui = UI[lang];
  out.push(ui.title, ui.intro, ui.language, ui.loading, ui.empty(5, 2), ui.noPattern, ui.seeDays, ui.hide, ui.show, ui.hidden(2), ui.kind.dragging, ui.kind.supporting);
  out.push(ui.lampsTitle, ui.lampsIntro, ui.score, ui.notYet, ui.logTitle, ui.logDays(6), ui.draftWords, ui.draftSources, ui.failed, ui.connectionsTitle, ui.connectionsIntro);
  for (const room of ROOM_IDS) out.push(ui.open(ROOM_COPY[room][lang]));
  return out;
}

test("spec house/0020: the words are drafts until the owner approves them", () => {
  assert.equal(BRAIN_WORDS_APPROVED, false);
});

test("spec house/0020: every code the server names has a line in both languages, and the screen says the same number of days the server hides for", () => {
  for (const lang of LANGS) {
    for (const id of PATTERN_IDS) assert.ok(PATTERN_COPY[id][lang].title.length > 5, `${id} ${lang}`);
    for (const item of EVIDENCE_ITEMS) assert.ok(ITEM_COPY[item][lang].length > 3, `${item} ${lang}`);
    for (const room of ROOM_IDS) assert.ok(ROOM_COPY[room][lang].length > 2, `${room} ${lang}`);
    for (const lamp of LAMP_IDS) assert.ok(LAMP_COPY[lamp][lang].meaning.length > 10, `${lamp} ${lang}`);
    for (const m of MOVEMENTS) assert.ok(MOVE_COPY[m][lang].length > 5, `${m} ${lang}`);
  }
  assert.deepEqual(Object.keys(ITEM_COPY).sort(), [...EVIDENCE_ITEMS].sort());
  assert.deepEqual(Object.keys(PATTERN_COPY).sort(), [...PATTERN_IDS].sort());
  assert.deepEqual(Object.keys(CONNECTION_COPY).sort(), [...CONNECTION_IDS].sort());
  assert.equal(connectionText("a_connection_from_a_newer_server", "en", {}), null);
  assert.deepEqual(Object.keys(LAMP_COPY).sort(), [...LAMP_IDS].sort());
  assert.deepEqual(Object.keys(UI.en).sort(), Object.keys(UI.hi).sort());
  assert.equal(HIDE_DAYS, 30);
  assert.ok(UI.en.hidden(1).includes(String(HIDE_DAYS)) && UI.hi.hidden(1).includes(String(HIDE_DAYS)));
  assert.equal(patternText("a_pattern_from_a_newer_server", "en", {}), null);
});

test("spec house/0020: the same days always give the same words", () => {
  for (const lang of LANGS) assert.deepEqual(everySentence(lang), everySentence(lang));
  const params = SAMPLES.mood_habits_quiet[0];
  assert.equal(patternText("mood_habits_quiet", "en", params)!.text, patternText("mood_habits_quiet", "en", { ...params })!.text);
  assert.notEqual(patternText("mood_habits_quiet", "en", params)!.text, patternText("mood_habits_quiet", "hi", params)!.text);
});

test("spec house/0020: no ranking word, no clinical word, no judging of food, no cause word and no order, in either language", () => {
  for (const lang of LANGS) {
    for (const raw of everySentence(lang)) {
      const sentence = strip(raw);
      assert.ok(!RANKING.test(sentence), `ranking word in ${lang}: ${raw}`);
      assert.ok(!CLINICAL.test(sentence), `clinical word in ${lang}: ${raw}`);
      assert.ok(!FOOD.test(sentence), `food judgement in ${lang}: ${raw}`);
      assert.ok(!CAUSE.test(sentence), `cause word in ${lang}: ${raw}`);
      // The empty state says what DHI needs, not what the student must do.
      if (raw !== UI[lang].empty(5, 2)) assert.ok(!ORDERS.test(sentence), `order in ${lang}: ${raw}`);
    }
  }
});

test("spec house/0020: a pattern says 'tend to' and speaks only of the student's own days", () => {
  for (const id of PATTERN_IDS) {
    for (const params of SAMPLES[id]) {
      const en = patternText(id, "en", params)!;
      assert.match(en.text, /tend to come together/, id);
      assert.match(en.text + en.note, /own days/, id);
      assert.match(patternText(id, "hi", params)!.text + patternText(id, "hi", params)!.note, /apne dinon/, id);
    }
  }
});

test("spec house/0023: a connection says 'tend to', speaks only of the student's own days and gives the days behind it", () => {
  for (const id of CONNECTION_IDS) {
    for (const params of CONNECTION_SAMPLES) {
      const en = connectionText(id, "en", params)!;
      assert.match(en.text, /tend to go together/, id);
      assert.match(en.text + en.note, /own days/, id);
      assert.match(en.text, /Based on \d+ days/, id);
      const hi = connectionText(id, "hi", params)!;
      assert.match(hi.text + hi.note, /apne dinon/, id);
      assert.match(hi.text, /dinon par aadharit/, id);
    }
  }
});

test("spec house/0020: no digit that is not a count, a date, the helpline or a fixed window", () => {
  const allowed = new Set(["14", "2", "30", HELPLINE_NUMBER]);
  for (const lang of LANGS) {
    for (const raw of everySentence(lang)) {
      const withoutDates = raw.replace(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{1,2} [A-Z][a-z]{2}\b/g, "");
      for (const token of withoutDates.match(/\d+/g) ?? []) {
        const isSample = Object.values(SAMPLES).some((list) => list.some((p) => Object.values(p).some((v) => typeof v === "number" && String(v) === token))) || ["3", "4", "5", "6"].includes(token) || CONNECTION_SAMPLES.some((p) => Object.values(p).some((v) => String(v).split(".").includes(token)));
        assert.ok(allowed.has(token) || isSample, `digit ${token} in ${lang}: ${raw}`);
      }
    }
  }
  assert.match(dayLabel("2026-10-12"), /^Mon, 12 Oct$/);
});

test("spec house/0020: the support message names the government helpline, says it is free and open all day and night, and goes only to the student", () => {
  assert.equal(HELPLINE_NUMBER, "14416");
  assert.match(SUPPORT_COPY.en.text(3), /Tele-MANAS on 14416/);
  assert.match(SUPPORT_COPY.en.text(3), /free, open all day and night/);
  assert.match(SUPPORT_COPY.hi.text(3), /Tele-MANAS ko 14416 par/);
  assert.match(SUPPORT_COPY.en.note, /Only you can see this/);
  // It makes no promise of a booking or a call back: counseling is not part of the house yet.
  for (const lang of LANGS) assert.ok(!/book|appointment|call you|counsel/i.test(SUPPORT_COPY[lang].text(3)), lang);
});

test("spec house/0020: the meals chain's words never judge the food or tell anyone to eat differently", () => {
  for (const lang of LANGS) {
    for (const params of SAMPLES.packaged_quiet) {
      const t = patternText("packaged_quiet", lang, params)!;
      const all = `${t.title} ${t.text} ${t.note}`;
      assert.ok(!/\b(more|less|stop|avoid|cut|reduce|instead|switch)\b/i.test(all.replace(/half or more/gi, "").replace(/aadhe ya zyada/gi, "")), `advice in ${lang}: ${all}`);
    }
  }
});
