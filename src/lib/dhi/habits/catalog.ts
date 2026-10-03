/**
 * Suggested habits + DHI news tips.
 * Students can also write a custom title and pick a colour.
 */

export type CatalogHabit = {
  id: string;
  title: string;
  hint: string;
  glyph: string;
  color: string;
};

export const CATALOG: CatalogHabit[] = [
  { id: "water", title: "Eight glasses of water", hint: "Calm. The body asks first.", glyph: "💧", color: "#3d6ea8" },
  { id: "sleep", title: "Sleep before eleven", hint: "Focus. Night writes the next paper.", glyph: "🌙", color: "#6b5b95" },
  { id: "page", title: "One honest page", hint: "Progress. One page that is actually read.", glyph: "📖", color: "#e8c36a" },
  { id: "walk", title: "Walk twenty minutes", hint: "Growth. Feet first.", glyph: "🌿", color: "#2f6b3a" },
  { id: "phone", title: "No phone first hour", hint: "Energy. Guard the morning.", glyph: "📵", color: "#e08a3d" },
  { id: "sit", title: "Ten minutes of quiet", hint: "Balance. Breath, not a show.", glyph: "🧘", color: "#3d8a7a" },
];

export const HABIT_TIPS = [
  {
    id: "t1",
    title: "Tiny is the size that stays",
    body: "A habit that takes two minutes will still be yours in three weeks. Grand vows go dark on Tuesday.",
    image: "/meals/dahi.jpg",
  },
  {
    id: "t2",
    title: "Same hour, same chair",
    body: "The brain loves a place. Water at the desk. Sleep at eleven. The streak is a rhythm, not a score.",
    image: "/meals/thali.jpg",
  },
  {
    id: "t3",
    title: "A miss is an empty day",
    body: "Do not pay yesterday with shame. Light today. That is the only payment the streak accepts.",
    image: "/meals/plate.jpg",
  },
];
