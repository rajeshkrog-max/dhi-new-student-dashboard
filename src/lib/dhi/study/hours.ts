/**
 * Two hours. One is live so the room can be seen.
 * One is locked until the admin clock hits.
 */

import type { StudyHour } from "./schema";

const FACES = ["/study/suzzy.jpg", "/study/shubham.jpg", "/study/meera.jpg", "/study/arjun.jpg"];
const NAMES = [
  "Asha Nair", "Dev Kulkarni", "Ira Bose", "Kabir Shah", "Leela Iyer", "Mira Das", "Nalin Rao", "Om Kapoor",
  "Pari Jain", "Rhea Paul", "Sana Qureshi", "Tara Menon", "Ved Joshi", "Yash Gill", "Zoya Khan", "Anil Deshmukh",
  "Bina Patil", "Charu Reddy", "Farhan Ali", "Gita More", "Harish Naik", "Ina Dutta", "Jai Pawar", "Kavya Nene",
  "Lalit Sen", "Maya Kaur", "Neel Verma", "Oviya Raman", "Pranav Dixit", "Ruhi Bhatt", "Sahil Khan", "Tanya Roy",
  "Uma Shetty", "Vikram Lal", "Wafa Noor", "Xavier D'Souza",
];

function houseSeats() {
  const cycle = ["live", "live", "away", "offline", "dnd"] as const;
  return NAMES.map((name, i) => {
    const presence = cycle[i % cycle.length];
    const show = presence === "live";
    return {
      id: `seat-${i}`,
      name,
      role: "House",
      image: show ? FACES[i % FACES.length] : null,
      camera: show,
      presence,
    };
  });
}

export const HOUSE_COUNT = 5 + NAMES.length;

const now = Date.now();

export const LIVE: StudyHour = {
  id: "hour_bio_live",
  subject: "Biology",
  title: "Leaf kitchen revision",
  teacher: "Shubham Raj",
  opensAt: now - 12 * 60 * 1000,
  closesAt: now + (17 * 60 + 34) * 1000,
  voice: true,
  video: true,
  seats: [
    { id: "suzzy", name: "Suzzy Glass", role: "You", image: "/study/suzzy.jpg", you: true, camera: true, presence: "live" },
    { id: "shubham", name: "Shubham Raj", role: "Teacher", image: "/study/shubham.jpg", camera: true, presence: "live" },
    { id: "meera", name: "Meera Sen", role: "House", image: "/study/meera.jpg", camera: true, presence: "live" },
    { id: "anika", name: "Anika Rao", role: "House", image: null, camera: false, presence: "dnd" },
    { id: "arjun", name: "Arjun Vale", role: "Listening", image: "/study/arjun.jpg", camera: true, presence: "live" },
    ...houseSeats(),
  ],
  lines: [
    {
      id: "l1",
      author: "Shubham Raj",
      body: "Sit with the leaf. The pore only breathes. The kitchen is deeper.",
      at: "12:02",
    },
    {
      id: "l2",
      author: "Meera Sen",
      body: "So stomata is the door, not the hearth. I had that backwards on the paper.",
      at: "12:05",
      forwarded: "Shubham Raj",
    },
    {
      id: "l3",
      author: "Suzzy Glass",
      body: "Chloroplast cooks the sugar. ATP is the coin the cell spends.",
      at: "12:06",
    },
  ],
  transcript: [
    "Shubham — The cooking of sugar is not at the pore.",
    "Anika — The green grain inside the cell holds the pigment.",
    "Suzzy — That grain is the chloroplast.",
  ],
};

export const LOCKED: StudyHour = {
  id: "hour_math_locked",
  subject: "Mathematics",
  title: "Sequences, quietly",
  teacher: "Shubham Raj",
  opensAt: now + 3 * 60 * 60 * 1000,
  closesAt: now + 4 * 60 * 60 * 1000,
  voice: true,
  video: false,
  seats: [],
  lines: [],
  transcript: [],
};

export function phase(hour: StudyHour, at = Date.now()) {
  if (at < hour.opensAt) return "locked" as const;
  if (at >= hour.closesAt) return "closed" as const;
  return "live" as const;
}

export function remaining(hour: StudyHour, at = Date.now()) {
  const ms = Math.max(0, hour.closesAt - at);
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function opensLabel(hour: StudyHour) {
  return new Date(hour.opensAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}
