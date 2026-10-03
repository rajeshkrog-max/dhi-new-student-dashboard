/** Demo payload shaped like GET /me/home. Swap for API later. */
export type PaperRow = {
  id: string;
  subject: string;
  kind: "MCQ" | "Written";
  teacher: string;
  marks: string | null;
  status: "accept" | "marked" | "open";
  date: string;
};

export type HouseNotice = {
  id: string;
  title: string;
  body: string;
  when: string;
  kind: "hour" | "module" | "remark";
};

export type DayMark = { day: number; kind?: "paper" | "hour" | "today" };

export const HOME = {
  student: {
    name: "Suzzy Glass",
    initials: "SG",
    house: "Invited house",
  },
  greeting: {
    line: "Good morning",
    sub: "Stay with the sitting. Physics still waits for your accept.",
  },
  kpis: [
    { id: "lamps", label: "DHI lamps", value: "72", note: "this week", tone: "gold" as const, tab: "progress" },
    { id: "papers", label: "Papers waiting", value: "2", note: "1 remark to accept", tone: "peach" as const, tab: "papers" },
    { id: "tokens", label: "Tokens today", value: "14", note: "bowl resets at dawn", tone: "lilac" as const, tab: "dhi" },
    { id: "recalls", label: "Recalls due", value: "2", note: "from yesterday", tone: "mint" as const, tab: "dhi" },
    { id: "niyam", label: "Plates kept", value: "5/7", note: "this week", tone: "grove" as const, tab: "day" },
  ],
  papers: [
    { id: "p1", subject: "Physics — torque", kind: "Written" as const, teacher: "Ms Iyer", marks: "16/20", status: "accept" as const, date: "16 Sep" },
    { id: "p2", subject: "Maths — sequences", kind: "MCQ" as const, teacher: "Mr Rao", marks: "18/20", status: "marked" as const, date: "14 Sep" },
    { id: "p3", subject: "English — letter", kind: "Written" as const, teacher: "Ms Iyer", marks: null, status: "open" as const, date: "today" },
    { id: "p4", subject: "Chemistry — moles", kind: "MCQ" as const, teacher: "Dr Sen", marks: "15/20", status: "marked" as const, date: "10 Sep" },
  ] satisfies PaperRow[],
  notices: [
    { id: "n1", title: "Study hour · Saturday 5", body: "Voice room opens only when the clock hits. Auto-leave when time ends.", when: "20 Sep", kind: "hour" as const },
    { id: "n2", title: "Remark waiting", body: "Ms Iyer left a justified note on torque. The lamp moves after you read it.", when: "16 Sep", kind: "remark" as const },
    { id: "n3", title: "Recall cycle", body: "Two DHI recalls from yesterday’s sitting. One token each.", when: "today", kind: "module" as const },
  ] satisfies HouseNotice[],
  calendar: {
    label: "September 2026",
    startWeekday: 1,
    daysInMonth: 30,
    marks: [
      { day: 17, kind: "today" as const },
      { day: 16, kind: "paper" as const },
      { day: 20, kind: "hour" as const },
      { day: 21, kind: "paper" as const },
    ] satisfies DayMark[],
  },
  lamps: {
    composite: 72,
    slices: [
      { key: "Sadhana", value: 38, fill: "#c9b6f2" },
      { key: "Niyam", value: 22, fill: "#b7e4d4" },
      { key: "Viveka", value: 12, fill: "#e8c36a" },
      { key: "rest", value: 28, fill: "#efeaf6" },
    ],
  },
  week: [
    { d: "Mon", v: 1 },
    { d: "Tue", v: 2 },
    { d: "Wed", v: 2 },
    { d: "Thu", v: 3 },
    { d: "Fri", v: 2 },
    { d: "Sat", v: 1 },
    { d: "Sun", v: 0 },
  ],
};
