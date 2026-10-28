// The line under the student's name on Home (the house mockup's "Stay with the sitting. Physics still waits for your accept."). It is picked by a fixed
// order from the student's own rows, never written by a model: a paper open now comes first, then a mark waiting to be read, then the study hour,
// then recalls due on the desk. With nothing waiting it says the house is the student's own.

export type HomeLineInput = {
  now: number;
  openPapers: { title: string; dueAt: number }[];
  unreadMarks: string[];
  hour: { opensAt: number; closesAt: number } | null;
  recallsDue: number;
};

export const QUIET_LINE = "Your own days, in one place. Everything here is yours alone.";

const clock = (ms: number) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  }).format(ms);
const dayKey = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(ms);

export function homeLine({
  now,
  openPapers,
  unreadMarks,
  hour,
  recallsDue,
}: HomeLineInput): string {
  const open = openPapers.filter((p) => p.dueAt > now).sort((a, b) => a.dueAt - b.dueAt)[0];
  if (open) return `${open.title} is open until ${clock(open.dueAt)}. Sit when you can be quiet.`;
  if (unreadMarks.length > 0)
    return `Your mark for ${unreadMarks[0]} is ready. Read the remarks when you can.`;
  if (hour && hour.opensAt <= now && now < hour.closesAt)
    return "The study hour is open now. Your seat is waiting.";
  if (recallsDue > 0)
    return recallsDue === 1
      ? "One recall waits on the DHI desk."
      : `${recallsDue} recalls wait on the DHI desk.`;
  if (hour && hour.opensAt > now && dayKey(hour.opensAt) === dayKey(now))
    return `The study hour opens at ${clock(hour.opensAt)} today.`;
  return QUIET_LINE;
}
