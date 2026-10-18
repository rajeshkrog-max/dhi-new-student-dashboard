// Up to two capital letters from the first and last word of a name, for the round badge next to it. A name with no letters gives one dot.
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = [words[0], words.length > 1 ? words[words.length - 1] : ""].map((w) => (w ? Array.from(w)[0].toUpperCase() : ""));
  return letters.join("") || "·";
}
