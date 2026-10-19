// The ten moods and the DHI lines of the mood room (spec house/0006). Pure data with no imports, so the screen, the words file and the node tests
// all read the same lists. The codes must equal MOOD_CODES in packages/backend/convex/moodRules.ts (a test checks it). The lines are the ones
// the room already had, two for each mood.
export type MoodKey =
  | "best"
  | "happy"
  | "motivated"
  | "determined"
  | "content"
  | "tired"
  | "stressed"
  | "anxious"
  | "sad"
  | "heavy";

export const THOUGHTS: Record<MoodKey, string[]> = {
  best: [
    "A lamp that burns this bright still needs oil tomorrow. Keep one quiet hour.",
    "Joy is a guest. Offer it a seat, then write one line so it can visit again.",
  ],
  happy: [
    "Happiness that can name itself is already wisdom. What fed it today?",
    "The house is light. Share one small kindness so the lamp does not stay only yours.",
  ],
  motivated: [
    "Fire is useful when it has a hearth. Pick one sitting, not ten.",
    "Motivation is a morning. Guard it from the first scroll.",
  ],
  determined: [
    "Determination is a spine, not a shout. One honest page is enough.",
    "The mountain does not hurry. Keep the hour you named.",
  ],
  content: [
    "Content is a quiet table. Do not add a feast just because the day was kind.",
    "Enough is a rare colour. Sit with it.",
  ],
  tired: [
    "Tired is a request, not a failure. Sleep is also a sitting.",
    "Put the bag down. The house will still be here at dawn.",
  ],
  stressed: [
    "Stress is a crowd in the chest. Name one thing you can put outside the door.",
    "Breathe once as if the paper is not watching.",
  ],
  anxious: [
    "Anxiety writes tomorrow too early. Come back to this hour.",
    "You do not have to solve the night. You only have to stay.",
  ],
  sad: [
    "Sadness is weather, not a verdict. Let it pass through the house without being locked in.",
    "A low lamp still lights the path. You do not have to shine to be here.",
  ],
  heavy: [
    "Heavy days are for a human sitting, not for carrying alone. Ask. The house has a counselor’s door.",
    "You do not have to explain the whole night. One sentence is enough to open the door.",
  ],
};
