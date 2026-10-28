// The words of the weekly parent page and of the student's link controls, in English and Hinglish (house spec 0022). Fixed templates over the counts and
// lamp values the server sends (packages/backend/convex/parentReport.ts), so each can be tested. They are DRAFTS: PARENT_WORDS_APPROVED is false, and the
// page says so, until the owner approves them. They follow the Brain's copy rules (brain-words.test.ts): no ranking word, no clinical word, nothing that
// compares a child with another, nothing that tells a parent what to do, and no digit that is not a count, a date or a lamp value.
import type { LampId } from "@dhi/backend/brainCodes";
import type { Lang } from "@/lib/dhi/brain-words";

// Approved by the owner on 2026-10-28 ("approve all the words gates"). A change of the words after this is the owner's to approve again.
export const PARENT_WORDS_APPROVED = true;

type Words = {
  title: (name: string) => string;
  intro: (name: string) => string;
  range: (from: string, to: string) => string;
  roomsTitle: string;
  roomDays: (days: number) => string;
  lampsTitle: string;
  lampsNote: (name: string) => string;
  lampValue: (value: number) => string;
  lampEmpty: string;
  notEnough: (name: string) => string;
  neverShown: (name: string) => string;
  until: (date: string) => string;
  draft: string;
  loading: string;
  goneTitle: string;
  gone: string;
  slowTitle: string;
  slow: string;
  retry: string;
};

export const PARENT_COPY: Record<Lang, Words> = {
  en: {
    title: (name) => `${name}'s week`,
    intro: (name) => `A short summary that ${name} chose to share with you. It is about their own days only. It is never a rank and never a comparison with anyone.`,
    range: (from, to) => `The last seven days: ${from} to ${to}`,
    roomsTitle: "Days with something logged",
    roomDays: (days) => (days === 1 ? "1 day of 7" : `${days} days of 7`),
    lampsTitle: "Growth marks",
    lampsNote: (name) => `Each mark is from 0 to 100 over ${name}'s own last four weeks. It moves as their own practice grows. It is not a grade.`,
    lampValue: (value) => `${value} of 100`,
    lampEmpty: "Nothing to measure yet",
    notEnough: (name) => `${name} has not logged enough days yet to show growth marks. They appear once about five of the last fourteen days have something logged.`,
    neverShown: (name) => `This page never shows a mood, a note, sleep, meals or anything ${name} wrote. ${name} can turn it off at any time.`,
    until: (date) => `This link works until ${date}.`,
    draft: "Draft words, not yet approved by DHI.",
    loading: "Opening the page…",
    goneTitle: "This link is not working",
    gone: "The link may have been turned off or replaced, or it has run out. Your child can make a new one from Your data in the DHI house.",
    slowTitle: "A lot of tries",
    slow: "Please wait a minute and try again.",
    retry: "Try again",
  },
  hi: {
    title: (name) => `${name} ka hafta`,
    intro: (name) => `Yeh ek chhota sa saar hai jo ${name} ne aapke saath share kiya hai. Yeh sirf unke apne dinon ke baare mein hai. Yeh kabhi rank nahi hai aur kisi se tulna nahi.`,
    range: (from, to) => `Pichhle saat din: ${from} se ${to}`,
    roomsTitle: "Kitne din kuch log kiya",
    roomDays: (days) => `7 mein se ${days} din`,
    lampsTitle: "Growth marks",
    lampsNote: (name) => `Har mark 0 se 100 tak hai, ${name} ke apne pichhle chaar hafton par. Yeh unke apne abhyaas ke saath badhta hai. Yeh grade nahi hai.`,
    lampValue: (value) => `100 mein se ${value}`,
    lampEmpty: "Abhi naapne ke liye kuch nahi",
    notEnough: (name) => `${name} ne abhi itne din log nahi kiye ki growth marks dikhein. Pichhle chaudah dinon mein se lagbhag paanch din kuch log hone par woh dikhte hain.`,
    neverShown: (name) => `Is page par kabhi mood, note, neend, khana ya ${name} ka likha kuch nahi dikhta. ${name} ise kabhi bhi band kar sakte hain.`,
    until: (date) => `Yeh link ${date} tak chalta hai.`,
    draft: "Yeh shabd abhi draft hain, DHI ne approve nahi kiye.",
    loading: "Page khul raha hai…",
    goneTitle: "Yeh link kaam nahi kar raha",
    gone: "Ho sakta hai link band kar diya gaya ho ya badal diya gaya ho, ya uski samay seema khatam ho gayi ho. Aapka bachcha DHI house ke Your data se naya link bana sakta hai.",
    slowTitle: "Bahut koshishein",
    slow: "Kripya ek minute ruk kar phir koshish karein.",
    retry: "Phir koshish karein",
  },
};

// The two words a parent sees for each lamp: its name and what it measures. The lamp names and meanings are the Brain's own (brain-words.ts).
export const PARENT_LAMP_ORDER: readonly LampId[] = ["sadhana", "niyam", "viveka"];

// The student's side, in Your data (English only, like the rest of that page).
export const LINK_COPY = {
  sharingOn: "On: your parent can open a weekly page through a link only you can make.",
  sharingText:
    "Off until you turn it on. When it is on, you can make one private link and give it to your parent yourself. They see how many days you logged in each room this week and your three growth marks. They never see a mood, a note, sleep, meals, a pattern or anything you wrote. Turning sharing off ends the link at once.",
  make: "Make a link for my parent",
  renew: "Make a new link",
  remove: "End the link",
  copy: "Copy link",
  copied: "Link copied.",
  shownOnce: "This is the only time the link is shown. Copy it and send it to your parent. Making a new link ends this one.",
  live: (date: string) => `A link is live until ${date}. Making a new one ends it.`,
  none: "No link yet.",
};
