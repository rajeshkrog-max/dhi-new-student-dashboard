// The words of the Brain report, in English and Hinglish (spec house/0020, scope rows 18 to 22). Every sentence is a fixed template over the ids and
// counts the server sends (packages/backend/convex/brain.ts), so the same days always give the same words and each one can be tested. They are DRAFTS:
// BRAIN_WORDS_APPROVED is false, and the screen says so, until the owner and the DHI team approve them (the copy test in brain-words.test.ts holds the
// rules in the meantime). The rules, from the Master Spec's copy lint: no ranking word, no clinical word, no judging of food, "tend to" and never "cause",
// no digit that is not a count, a date or the helpline number, and nothing that compares a student with another. A pattern is about the student's own
// days and says so; it never says why, and it never tells a student what to do.

import type { ConnectionId, EvidenceItem, LampId, Movement, PatternId } from "@dhi/backend/brainCodes";

export const BRAIN_WORDS_APPROVED = false;

export type Lang = "en" | "hi";
export const LANGS: readonly Lang[] = ["en", "hi"];
export const LANG_NAME: Record<Lang, string> = { en: "English", hi: "Hinglish" };
export const isLang = (text: unknown): text is Lang => text === "en" || text === "hi";

type Params = Record<string, number | string>;

// "Mon, 12 Oct": a house day as a short date, the same in both languages.
export function dayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00+05:30`);
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}
const num = (p: Params, key: string): number => Number(p[key]);
const when = (p: Params, key: string): string => dayLabel(String(p[key]));
const daysEn = (n: number): string => (n === 1 ? "1 day" : `${n} days`);
const daysHi = (n: number): string => `${n} din`;

type PatternCopy = { title: string; text: (p: Params) => string; note: string };

export const PATTERN_COPY: Record<PatternId, Record<Lang, PatternCopy>> = {
  mood_habits_quiet: {
    en: {
      title: "Heavy days and quieter days after",
      text: (p) =>
        `Between ${when(p, "from")} and ${when(p, "to")}, ${num(p, "lowDays")} of your days were marked sad or heavy. On ${
          num(p, "chainDays") === num(p, "lowDays") ? "each of them" : `${num(p, "chainDays")} of them`
        } a habit was open and not ticked, and the day after had no study hour time, or a paper that closed without answers. In your own days, these tend to come together.`,
      note: "This is only about your own days. It does not say why, and it is not a judgement.",
    },
    hi: {
      title: "Bhaari din aur uske baad shant din",
      text: (p) =>
        `${when(p, "from")} se ${when(p, "to")} ke beech aapke ${num(p, "lowDays")} din sad ya heavy mark hue. ${
          num(p, "chainDays") === num(p, "lowDays") ? "Sabhi dinon mein" : `Inme se ${num(p, "chainDays")} din`
        } koi habit khuli thi par tick nahi hui, aur agle din study hour mein baithna nahi hua ya koi paper bina jawab ke band hua. Aapke apne dinon mein ye cheezein ek saath aati hain.`,
      note: "Ye sirf aapke apne dinon ki baat hai. Isse ye nahi pata chalta ki aisa kyun hua, aur ye koi faisla nahi hai.",
    },
  },
  steady_rhythm: {
    en: {
      title: "A steady rhythm and papers sat",
      text: (p) =>
        `In the last ${daysEn(num(p, "window"))} you sat the study hour on ${num(p, "hourDays")} of the ${num(p, "hourOpen")} days it was open, and ticked a habit on ${num(p, "habitDays")} of ${num(
          p,
          "habitOpen",
        )} days. You also sat all ${num(p, "papers")} papers that closed. In your own days, a steady rhythm and papers sat tend to come together.`,
      note: "This is only about your own days. It is not a score and it is not compared with anyone.",
    },
    hi: {
      title: "Steady lay aur diye hue paper",
      text: (p) =>
        `Pichhle ${daysHi(num(p, "window"))} mein ${num(p, "hourOpen")} mein se ${num(p, "hourDays")} din aap study hour mein baithe, aur ${num(p, "habitOpen")} mein se ${num(
          p,
          "habitDays",
        )} din aapne habit tick ki. Band hue ${num(p, "papers")} ke ${num(p, "papers")} paper bhi aapne diye. Aapke apne dinon mein steady lay aur paper dena ek saath dikhte hain.`,
      note: "Ye sirf aapke apne dinon ki baat hai. Ye koi score nahi hai aur kisi se tulna nahi hai.",
    },
  },
  packaged_quiet: {
    en: {
      title: "Packaged or fried days and quieter days after",
      text: (p) =>
        `${num(p, "heavyDays")} of the last ${daysEn(num(p, "window"))} had half or more of the tagged items logged as packaged or fried. On ${
          num(p, "chainDays") === num(p, "heavyDays") ? "each of them" : `${num(p, "chainDays")} of them`
        } the day after had no study hour time, or a paper that closed without answers. In your own days, these tend to come together.`,
      note: "This says nothing about the food itself. It is only about your own days.",
    },
    hi: {
      title: "Packaged ya fried din aur uske baad shant din",
      text: (p) =>
        `Pichhle ${daysHi(num(p, "window"))} mein ${num(p, "heavyDays")} din logged items mein se aadhe ya zyada packaged ya fried the. ${
          num(p, "chainDays") === num(p, "heavyDays") ? "Sabhi dinon ke" : `Inme se ${num(p, "chainDays")} din ke`
        } agle din study hour mein baithna nahi hua ya koi paper bina jawab ke band hua. Aapke apne dinon mein ye ek saath dikhte hain.`,
      note: "Isme khane ke baare mein koi raay nahi hai. Ye sirf aapke apne dinon ki baat hai.",
    },
  },
};

export const EXPRESSION_COPY: Record<Lang, { title: string; text: (runDays: number, postDay: string) => string; note: string }> = {
  en: {
    title: "You put it into words",
    text: (n, postDay) =>
      `After ${daysEn(n)} in a row marked sad or heavy, a post of yours was shared on ${dayLabel(postDay)}. Some people find that putting a feeling into words helps. Nothing more is asked of you.`,
    note: "This is only about your own days.",
  },
  hi: {
    title: "Aapne ise shabdon mein likha",
    text: (n, postDay) =>
      `Lagatar ${daysHi(n)} sad ya heavy mark karne ke baad aapki ek post ${dayLabel(postDay)} ko share hui. Kuch log maante hain ki feelings ko shabdon mein likhna madad karta hai. Isse zyada kuch nahi poocha ja raha.`,
    note: "Ye sirf aapke apne dinon ki baat hai.",
  },
};

// The helpline is the government's Tele-MANAS (14416), free, open all day and night, in many languages (checked on the government's pages on 2026-10-22).
export const HELPLINE_NUMBER = "14416";
export const SUPPORT_COPY: Record<Lang, { title: string; text: (lowDays: number) => string; note: string }> = {
  en: {
    title: "Support is there for you",
    text: (lowDays) =>
      `This week ${lowDays} of your days were marked sad or heavy, and your habit and meal logs have been quieter than last week. You are not alone in this. Talking to a parent, a teacher or someone you trust can help. You can also call Tele-MANAS on ${HELPLINE_NUMBER}. It is free, open all day and night, and answers in many languages.`,
    note: "Only you can see this in the house. It is not sent to your school.",
  },
  hi: {
    title: "Madad aapke saath hai",
    text: (lowDays) =>
      `Is hafte aapke ${lowDays} din sad ya heavy mark hue, aur aapki habit aur meal logs pichhle hafte se kam rahi hain. Aap ismein akele nahi hain. Kisi parent, teacher ya apne bharose ke vyakti se baat karna madad kar sakta hai. Aap Tele-MANAS ko ${HELPLINE_NUMBER} par bhi call kar sakte hain. Ye muft hai, din-raat khula rehta hai, aur kai bhashaon mein baat hoti hai.`,
    note: "Ise ghar mein sirf aap dekh sakte hain. Ye aapke school ko nahi bheja jata.",
  },
};

// What happened on a day, for the list of days behind a pattern.
export const ITEM_COPY: Record<EvidenceItem, Record<Lang, string>> = {
  low_mood: { en: "marked sad or heavy", hi: "sad ya heavy mark kiya" },
  habit_not_ticked: { en: "a habit was open, not ticked", hi: "habit khuli thi, tick nahi hui" },
  habit_ticked: { en: "a habit ticked", hi: "habit tick hui" },
  hour_not_sat: { en: "the study hour was open, not sat", hi: "study hour khuli thi, baithe nahi" },
  hour_sat: { en: "sat the study hour", hi: "study hour mein baithe" },
  paper_missed: { en: "a paper closed without answers", hi: "paper bina jawab ke band hua" },
  paper_sat: { en: "a paper sat", hi: "paper diya" },
  packaged_heavy: { en: "half or more packaged or fried", hi: "aadhe ya zyada packaged ya fried" },
  post_published: { en: "a post was shared", hi: "post share hui" },
};
export const isEvidenceItem = (text: string): text is EvidenceItem => text in ITEM_COPY;

export const ROOM_COPY: Record<string, Record<Lang, string>> = {
  mood: { en: "Mood", hi: "Mood" },
  habits: { en: "Habits", hi: "Habits" },
  hour: { en: "Study hour", hi: "Study hour" },
  papers: { en: "Exams", hi: "Exams" },
  day: { en: "Meals", hi: "Meals" },
  sleep: { en: "Sleep", hi: "Sleep" },
  modules: { en: "Modules", hi: "Modules" },
  blog: { en: "Blog", hi: "Blog" },
};
export const roomName = (room: string, lang: Lang): string => ROOM_COPY[room]?.[lang] ?? room;

export const LAMP_COPY: Record<LampId, Record<Lang, { name: string; meaning: string }>> = {
  sadhana: {
    en: { name: "Sadhana", meaning: "Effort and practice: papers sat, and days in the study hour" },
    hi: { name: "Sadhana", meaning: "Mehnat aur abhyaas: diye hue paper, aur study hour ke din" },
  },
  niyam: {
    en: { name: "Niyam", meaning: "Rhythm and routine: days with a habit tick" },
    hi: { name: "Niyam", meaning: "Lay aur routine: habit tick wale din" },
  },
  viveka: {
    en: { name: "Viveka", meaning: "Reflection: films kept" },
    hi: { name: "Viveka", meaning: "Soch aur samajh: poori dekhi gayi films" },
  },
};

export const INPUT_COPY: Record<string, Record<Lang, string>> = {
  A01: { en: "Papers sat before the window closed", hi: "Window band hone se pehle diye gaye paper" },
  H12: { en: "Days sat in the study hour, of the days one was open", hi: "Study hour ke din jab aap baithe, un dinon mein jab wo khuli thi" },
  H08: { en: "Days with a habit tick, of the days one was open", hi: "Habit tick wale din, un dinon mein jab habit khuli thi" },
  A15: { en: "Films kept, out of four in four weeks", hi: "Poori dekhi gayi films, chaar hafton mein chaar mein se" },
};

export const MOVE_COPY: Record<Movement | "none", Record<Lang, string>> = {
  rising: { en: "Rising compared with the 2 weeks before", hi: "Pichhle 2 hafton se badh raha hai" },
  steady: { en: "Steady compared with the 2 weeks before", hi: "Pichhle 2 hafton jaisa hi" },
  dipping: { en: "Dipping a little compared with the 2 weeks before. It is only a comparison with your own earlier weeks.", hi: "Pichhle 2 hafton se thoda neeche. Ye sirf aapke apne pichhle hafton se tulna hai." },
  none: { en: "Not enough days yet to compare", hi: "Tulna ke liye abhi kaafi din nahi" },
};

// Everything else the page says.
export type Ui = {
  title: string;
  intro: string;
  language: string;
  loading: string;
  empty: (need: number, have: number) => string;
  noPattern: string;
  seeDays: string;
  hide: string;
  show: string;
  hidden: (n: number) => string;
  kind: Record<"dragging" | "supporting", string>;
  lampsTitle: string;
  lampsIntro: string;
  score: string;
  notYet: string;
  logTitle: string;
  logDays: (n: number) => string;
  open: (room: string) => string;
  draftWords: string;
  draftSources: string;
  failed: string;
  connectionsTitle: string;
  connectionsIntro: string;
};
export const UI: Record<Lang, Ui> = {
  en: {
    title: "What DHI noticed",
    intro: "DHI looks only at your own days, and only for a few things that tend to come together. It never compares you with anyone.",
    language: "Language",
    loading: "Reading your days…",
    empty: (need, have) => `DHI needs at least ${daysEn(need)} with something logged in the last 14 days before it can notice anything. You have ${have}. A little each day is enough.`,
    noPattern: "Nothing stands out right now. That is fine. A pattern appears only when the same things come together on several days.",
    seeDays: "See the days",
    hide: "This does not feel true",
    show: "Show again",
    hidden: (n) => `${n} hidden for 30 days`,
    kind: { dragging: "Things that came together", supporting: "A steady stretch" },
    lampsTitle: "Your growth lamps",
    lampsIntro: "Each lamp is a growth mark from your own last four weeks. It is never a rank, and it is never compared with another student.",
    score: "DHI score",
    notYet: "Not yet",
    logTitle: "What you logged in the last 14 days",
    logDays: daysEn,
    open: (room) => `Open ${room}`,
    draftWords: "Draft words: the DHI team has not approved this wording yet.",
    draftSources: "Draft: the research these patterns rest on has not been confirmed by the DHI team yet.",
    failed: "We could not do that just now. Please try again.",
    connectionsTitle: "What DHI connected",
    connectionsIntro: "DHI compares a short fixed list of things across all your days. It shows one only when each side has at least 14 days and the gap is too big to be by chance.",
  },
  hi: {
    title: "DHI ne kya notice kiya",
    intro: "DHI sirf aapke apne dinon ko dekhta hai, aur sirf kuch aisi cheezein jo saath aati hain. Ye aapko kisi se compare nahi karta.",
    language: "Bhasha",
    loading: "Aapke din padhe ja rahe hain…",
    empty: (need, have) => `DHI ko kuch notice karne ke liye pichhle 14 dinon mein kam se kam ${daysHi(need)} kuch logged hona chahiye. Aapke ${daysHi(have)} hain. Roz thoda sa kaafi hai.`,
    noPattern: "Abhi kuch khaas nazar nahi aa raha. Ye theek hai. Pattern tab dikhta hai jab kai dinon par wahi cheezein saath aati hain.",
    seeDays: "Din dekhein",
    hide: "Ye sach nahi lagta",
    show: "Phir dikhayein",
    hidden: (n) => `${n} 30 din ke liye chhupa hai`,
    kind: { dragging: "Jo cheezein saath aayin", supporting: "Ek steady daur" },
    lampsTitle: "Aapke growth lamps",
    lampsIntro: "Har lamp aapke apne pichhle chaar hafton ka growth mark hai. Ye kabhi rank nahi hai, aur kisi doosre student se tulna nahi hoti.",
    score: "DHI score",
    notYet: "Abhi nahi",
    logTitle: "Pichhle 14 dinon mein aapne kya log kiya",
    logDays: daysHi,
    open: (room) => `${room} kholein`,
    draftWords: "Draft shabd: DHI team ne abhi ye shabd approve nahi kiye hain.",
    draftSources: "Draft: ye patterns jis research par tike hain, use DHI team ne abhi confirm nahi kiya hai.",
    failed: "Abhi ye nahi ho paya. Kripya phir koshish karein.",
    connectionsTitle: "DHI ne kya jodha",
    connectionsIntro: "DHI aapke saare dinon mein kuch tay cheezon ki tulna karta hai. Ek tabhi dikhata hai jab dono taraf kam se kam 14 din hon aur fark itna bada ho ki sanyog na lage.",
  },
};

// The connections (house spec 0023): the same days compared two ways, with the means and the days behind them. `a` and `b` are whole percents (and the
// focus out of five, with one decimal, for breakfast), `n` the days in both groups. The cut points are in words so no stray digit appears.
type ConnectionCopy = { title: string; text: (p: Params) => string; note: string };
export const CONNECTION_COPY: Record<ConnectionId, Record<Lang, ConnectionCopy>> = {
  sleep_papers: {
    en: {
      title: "Bedtime and paper days",
      text: (p) =>
        `On paper days after you went to bed before half past eleven at night, ${num(p, "a")}% of your answers were right. After later nights it was ${num(p, "b")}%. Based on ${num(p, "n")} days. In your own days, these tend to go together.`,
      note: "This is only about your own days. It does not say why, and it is not a judgement.",
    },
    hi: {
      title: "Sone ka samay aur paper ke din",
      text: (p) =>
        `Jin paper dinon se pehle aap raat saade gyarah baje se pehle soye, un par aapke ${num(p, "a")}% jawab sahi the. Der se sone ke baad ye ${num(p, "b")}% tha. ${num(p, "n")} dinon par aadharit. Aapke apne dinon mein ye ek saath dikhte hain.`,
      note: "Ye sirf aapke apne dinon ki baat hai. Isse ye nahi pata chalta ki aisa kyun hua, aur ye koi faisla nahi hai.",
    },
  },
  breakfast_focus: {
    en: {
      title: "Breakfast and focus",
      text: (p) =>
        `On days you had breakfast before eleven in the morning, the focus you rated after studying averaged ${num(p, "a")} out of five. On days with a meal but no breakfast it averaged ${num(p, "b")}. Based on ${num(p, "n")} days. In your own days, these tend to go together.`,
      note: "This says nothing about the food itself and is not advice. It is only about your own days.",
    },
    hi: {
      title: "Nashta aur dhyan",
      text: (p) =>
        `Jin dinon aapne subah gyarah baje se pehle nashta kiya, padhai ke baad aapka dhyan ka rating ausat ${num(p, "a")} (paanch mein se) raha. Jin dinon khana to hua par nashta nahi, ye ausat ${num(p, "b")} raha. ${num(p, "n")} dinon par aadharit. Aapke apne dinon mein ye ek saath dikhte hain.`,
      note: "Isme khane ke baare mein koi raay ya salah nahi hai. Ye sirf aapke apne dinon ki baat hai.",
    },
  },
  bedtime_mood: {
    en: {
      title: "Bedtime and mood",
      text: (p) =>
        `On days after you went to bed before half past eleven at night, you marked a light mood on ${num(p, "a")}% of days. After later nights it was ${num(p, "b")}% of days. Based on ${num(p, "n")} days. In your own days, these tend to go together.`,
      note: "This is only about your own days. It does not say why, and it is not a judgement.",
    },
    hi: {
      title: "Sone ka samay aur mood",
      text: (p) =>
        `Raat saade gyarah baje se pehle sone ke baad ke ${num(p, "a")}% dinon mein aapne halka mood mark kiya. Der se sone ke baad ye ${num(p, "b")}% dinon mein tha. ${num(p, "n")} dinon par aadharit. Aapke apne dinon mein ye ek saath dikhte hain.`,
      note: "Ye sirf aapke apne dinon ki baat hai. Isse ye nahi pata chalta ki aisa kyun hua, aur ye koi faisla nahi hai.",
    },
  },
  late_room_feeling: {
    en: {
      title: "Late study room and the next day",
      text: (p) =>
        `On days you stayed in the study room half an hour or more after eleven at night, you felt okay or better after ${num(p, "a")}% of the next day's sessions. On other study room days it was ${num(p, "b")}%. Based on ${num(p, "n")} days. In your own days, these tend to go together.`,
      note: "This is only about your own days. It does not say why, and it is not a judgement.",
    },
    hi: {
      title: "Der raat study room aur agla din",
      text: (p) =>
        `Jin dinon aap raat gyarah baje ke baad aadha ghanta ya zyada study room mein rahe, agle din ke ${num(p, "a")}% sessions ke baad aapne theek ya usse achha mehsoos kiya. Baaki study room ke dinon mein ye ${num(p, "b")}% tha. ${num(p, "n")} dinon par aadharit. Aapke apne dinon mein ye ek saath dikhte hain.`,
      note: "Ye sirf aapke apne dinon ki baat hai. Isse ye nahi pata chalta ki aisa kyun hua, aur ye koi faisla nahi hai.",
    },
  },
};
export function connectionText(id: string, lang: Lang, params: Params): { title: string; text: string; note: string } | null {
  const copy = (CONNECTION_COPY as Record<string, Record<Lang, ConnectionCopy> | undefined>)[id]?.[lang];
  return copy ? { title: copy.title, text: copy.text(params), note: copy.note } : null;
}

// A pattern's sentence, or null for an id the page does not know (a newer server than the page).
export function patternText(id: string, lang: Lang, params: Params): { title: string; text: string; note: string } | null {
  const copy = (PATTERN_COPY as Record<string, Record<Lang, PatternCopy> | undefined>)[id]?.[lang];
  return copy ? { title: copy.title, text: copy.text(params), note: copy.note } : null;
}
