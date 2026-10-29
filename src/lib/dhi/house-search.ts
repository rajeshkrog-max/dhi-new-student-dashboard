// The house search (the search box in the header and the phone drawer). It finds rooms, not anyone's content: a student types a word and gets
// the rooms that hold it, in a fixed order of how well each matches. No model is involved and nothing is sent anywhere.

export type SearchRoom = { id: string; label: string };

// Words a student may type for each room, in English and the Hinglish the house already uses. A room's own label always counts.
const WORDS: Record<string, string[]> = {
  home: ["home", "start", "today", "calendar", "lamps"],
  blog: ["blog", "post", "write", "story", "read", "comment", "likh"],
  papers: ["exam", "exams", "paper", "papers", "test", "pariksha", "marks", "result", "sit"],
  day: ["meal", "meals", "food", "eat", "ate", "plate", "breakfast", "lunch", "dinner", "snack", "khana", "roti", "dal", "thali"],
  mood: ["mood", "feel", "feeling", "colour", "color", "sad", "happy", "stress", "anxious", "mann"],
  habits: ["habit", "habits", "streak", "tick", "routine", "water", "aadat"],
  sleep: ["sleep", "bed", "bedtime", "wake", "night", "nap", "neend"],
  modules: ["film", "films", "video", "videos", "module", "modules", "watch", "lesson"],
  dhi: ["desk", "ask", "doubt", "question", "coins", "learn", "practice", "topic", "diagram", "draw", "story", "mock", "sawal"],
  hour: ["study hour", "hour", "study", "seat", "call", "focus", "chat", "padhai"],
  counsel: ["counsel", "counseling", "counselling", "counselor", "talk", "help", "booking", "book", "baat"],
  progress: ["progress", "brain", "report", "growth", "lamp", "score", "pattern", "noticed", "parent"],
  data: ["data", "consent", "download", "erase", "delete", "privacy", "who looked", "withdraw"],
};

const fold = (text: string) => text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();

// How well one room matches: 3 its label starts with the text, 2 a word starts with it, 1 the text sits inside a word or label, 0 no match.
function rank(room: SearchRoom, text: string): number {
  const label = fold(room.label);
  if (label.startsWith(text)) return 3;
  const words = [label, ...label.split(" "), ...(WORDS[room.id] ?? []).map(fold)];
  if (words.some((w) => w.startsWith(text))) return 2;
  if (words.some((w) => w.includes(text))) return 1;
  return 0;
}

// The rooms for a typed text, best first; rooms that match equally keep their menu order. Empty text finds nothing.
export function searchRooms(rooms: SearchRoom[], typed: string, limit = 6): SearchRoom[] {
  const text = fold(typed);
  if (!text) return [];
  return rooms
    .map((room, order) => ({ room, order, score: rank(room, text) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((r) => r.room);
}
