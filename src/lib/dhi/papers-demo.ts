/** Shaped like GET /papers and GET /papers/:id. Attempts keyed by studentId + paperId. */

export type McqItem = {
  id: string;
  n: number;
  prompt: string;
  options: [string, string, string, string];
  hint: string;
};

export type WriteItem = {
  id: string;
  n: number;
  prompt: string;
  marks: number;
  hint: string;
};

export type PaperDef = {
  id: string;
  institute: string;
  teacher: string;
  subject: string;
  title: string;
  totalMarks: number;
  durationMin: number;
  date: string;
  studentId: string;
  assignedAt: number;
  dueAt: number;
  mcq: McqItem[];
  writing: WriteItem[];
};

export const STUDENT_ID = "stu_suzzy_glass";

/** Demo windows stay open relative to today, so the preview does not go quiet after a calendar date. */
function dayStamp(offset: number, end = false) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  d.setHours(end ? 23 : 8, end ? 59 : 0, 0, 0);
  return d.getTime();
}

function stampLabel(ts: number) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const BIOLOGY: PaperDef = {
  id: "paper_bio_shubham_20260917",
  institute: "Dhirise Gurukul",
  teacher: "Shubham Raj",
  subject: "Biology",
  title: "Life in the sitting",
  totalMarks: 100,
  durationMin: 45,
  date: stampLabel(dayStamp(2, true)),
  studentId: STUDENT_ID,
  assignedAt: dayStamp(-1),
  dueAt: dayStamp(2, true),
  mcq: [
    {
      id: "m1",
      n: 1,
      prompt: "A leaf is a kitchen. Where does the actual cooking of sugar from sunlight happen?",
      options: ["Stomata pore", "Chloroplast", "Xylem vessel", "Root hair"],
      hint: "Think of a green grain inside the leaf cell — a small room that holds the pigment which drinks light. The pore only lets gases in; the kitchen is deeper.",
    },
    {
      id: "m2",
      n: 2,
      prompt: "Why do we call mitochondria the ‘power house’ of the cell?",
      options: ["They store DNA", "They make glucose", "They release usable energy (ATP)", "They digest the cell wall"],
      hint: "Food is the wood. This organelle is the hearth that turns wood into a coin the cell can spend. What coin is that?",
    },
    {
      id: "m3",
      n: 3,
      prompt: "Stomata on a leaf are mostly for —",
      options: ["Absorbing minerals", "Exchange of gases and water vapour", "Making proteins", "Carrying food to the root"],
      hint: "A leaf must breathe and also let extra water leave. Look at the tiny mouths on the underside.",
    },
    {
      id: "m4",
      n: 4,
      prompt: "Which molecule carries the lasting script of a living being from parent to child?",
      options: ["ATP", "Glucose", "DNA", "Chlorophyll"],
      hint: "One is a letter that can be copied. One is fuel. One is a pigment. Which one is the family book?",
    },
    {
      id: "m5",
      n: 5,
      prompt: "A human heart has how many chambers?",
      options: ["Two", "Three", "Four", "Five"],
      hint: "Two rooms receive, two rooms send. Count the rooms, not the valves.",
    },
    {
      id: "m6",
      n: 6,
      prompt: "The working unit of the kidney is the —",
      options: ["Neuron", "Nephron", "Alveolus", "Villus"],
      hint: "Each of these little filters lives in the kidney and cleans a drop of blood. The name sounds like ‘kidney’ itself.",
    },
    {
      id: "m7",
      n: 7,
      prompt: "Enzymes in our body are mostly —",
      options: ["Fats", "Proteins", "Simple sugars", "Minerals"],
      hint: "They are tools made of folded chains. Heat can spoil their shape. What class of food-molecule folds like that?",
    },
    {
      id: "m8",
      n: 8,
      prompt: "Xylem in a plant mainly carries —",
      options: ["Food from leaf to rest", "Water and minerals upward", "Oxygen to the flower", "Pollen to the stigma"],
      hint: "One pipe drinks from the soil and climbs. The other pipe shares the kitchen’s sugar. Which pipe is the well?",
    },
    {
      id: "m9",
      n: 9,
      prompt: "Insulin is released by the —",
      options: ["Thyroid", "Pancreas", "Adrenal gland", "Pituitary"],
      hint: "This gland sits near the stomach and also sends digestive juices. One of its messengers tells sugar to enter the cells.",
    },
    {
      id: "m10",
      n: 10,
      prompt: "Plant cells differ from animal cells mainly because they have a —",
      options: ["Nucleus", "Mitochondrion", "Cell wall", "Cell membrane"],
      hint: "Both have a soft skin. Only the plant wears an extra coat of cellulose — a wall around the skin.",
    },
    {
      id: "m11",
      n: 11,
      prompt: "Meiosis is special because it —",
      options: ["Makes two identical body cells", "Halves the chromosome number for gametes", "Builds the cell wall", "Stores starch"],
      hint: "Body growth copies the full set. For a child to receive half from each parent, the set must be cut in two first.",
    },
    {
      id: "m12",
      n: 12,
      prompt: "A food chain always begins with a —",
      options: ["Carnivore", "Decomposer", "Producer", "Parasite"],
      hint: "Someone must catch sunlight and make food before anyone else can eat. Who stands at the first lamp?",
    },
    {
      id: "m13",
      n: 13,
      prompt: "Alveoli in the lungs are shaped as they are so that —",
      options: ["Blood can be stored", "Surface for gas exchange is large", "Food can be digested", "Sound can be made"],
      hint: "Tiny bags, many of them. Nature loves a large surface when two gases must swap in a hurry.",
    },
    {
      id: "m14",
      n: 14,
      prompt: "A synapse is the —",
      options: ["Gap where one neuron speaks to the next", "Bone around the brain", "Valve of the heart", "Opening of the stomata"],
      hint: "A thought is a relay. Between two messengers there is a small pause, a meeting place, not a wire fused forever.",
    },
    {
      id: "m15",
      n: 15,
      prompt: "Biodiversity is richest in which of these?",
      options: ["A wheat field of one crop", "A tropical forest", "A parking lot", "A salt pan"],
      hint: "Count kinds of life, not tonnes of one crop. Warm, wet, layered canopies hold many families of beings.",
    },
  ],
  writing: [
    {
      id: "w1",
      n: 1,
      marks: 6,
      prompt: "In your own words, walk a younger student through photosynthesis — from light arriving to sugar being made. Use a kitchen or a courtyard as your image.",
      hint: "Name the guests (light, water, air), the room (leaf), and the meal that leaves. You need not write equations first — the story is enough.",
    },
    {
      id: "w2",
      n: 2,
      marks: 6,
      prompt: "Why does a cell keep so many mitochondria if it is already ‘alive’? Write as if you are explaining to a friend who is tired after a long walk.",
      hint: "Alive is not the same as having coins to spend. Think of rest, work, and the hearth.",
    },
    {
      id: "w3",
      n: 3,
      marks: 6,
      prompt: "Xylem and phloem travel in the same stem. How do their jobs differ? Give one image from a village well and a kitchen.",
      hint: "One climbs with the drink. One shares the cooked food. Direction and cargo are your two lamps.",
    },
    {
      id: "w4",
      n: 4,
      marks: 5,
      prompt: "Enzymes are not ‘eaten up’ when they work. What does that tell you about a good teacher in a gurukul?",
      hint: "A catalyst returns to teach the next student. Shape, fit, and reuse — not sacrifice.",
    },
    {
      id: "w5",
      n: 5,
      marks: 6,
      prompt: "Describe the journey of a drop of blood through a nephron until it is cleaner. Stay kind and clear — no scare.",
      hint: "Filter, keep what the body still needs, let the rest become urine. You may name glomerulus if it sits in you; the story matters more.",
    },
    {
      id: "w6",
      n: 6,
      marks: 5,
      prompt: "If all stomata on a plant stayed shut for three hot days, what would you expect to see, and why?",
      hint: "Breathing and thirst are twins in a leaf. Close the mouths — gases and cooling both change.",
    },
    {
      id: "w7",
      n: 7,
      marks: 6,
      prompt: "Write a food chain of four living things you could actually meet near your house. Name each role (producer, herbivore, …).",
      hint: "Start with a green being. End with whoever eats last, or with the soil that receives the fall.",
    },
    {
      id: "w8",
      n: 8,
      marks: 6,
      prompt: "Why is a forest with many kinds of trees a stronger ‘lamp’ than a field of only one crop? Speak of disease, rain, and homes for birds.",
      hint: "Many families, many jobs. One crop is a single note; a forest is a raga.",
    },
    {
      id: "w9",
      n: 9,
      marks: 6,
      prompt: "How does a vaccine prepare the body without making you live through the full illness? Explain to a worried younger sibling.",
      hint: "A rehearsal, not the war. Memory cells remember the face of the guest.",
    },
    {
      id: "w10",
      n: 10,
      marks: 6,
      prompt: "DNA is a script. In one page, tell how that script is copied when a cell divides, without copying a textbook paragraph.",
      hint: "Unzip, pair, two books from one. Accuracy is the vow.",
    },
    {
      id: "w11",
      n: 11,
      marks: 6,
      prompt: "Follow one glucose molecule from a grain of rice to a working muscle. Where can it go, and what does the muscle gain?",
      hint: "Mouth, gut, blood, cell, mitochondrion — or storage. Energy is the gift, water and air are the leftovers.",
    },
    {
      id: "w12",
      n: 12,
      marks: 6,
      prompt: "Sit with one living thing you noticed this week (a crow, a tulsi, a stray dog, a seed). What did it teach you about biology that a paper cannot?",
      hint: "Observation is a gurukul. Write what you saw, not what you were told to feel.",
    },
  ],
};

export type ExamTile = {
  id: string;
  institute: string;
  teacher: string;
  subject: string;
  title: string;
  blurb: string;
  totalMarks: number;
  durationMin: number;
  date: string;
  assignedAt: number;
  dueAt: number;
  paper: PaperDef | null;
};

export const EXAM_TILES: ExamTile[] = [
  {
    id: BIOLOGY.id,
    institute: BIOLOGY.institute,
    teacher: BIOLOGY.teacher,
    subject: BIOLOGY.subject,
    title: BIOLOGY.title,
    blurb: "Sit with life. Marks go to the teacher with remarks — never a rank on you.",
    totalMarks: BIOLOGY.totalMarks,
    durationMin: BIOLOGY.durationMin,
    date: BIOLOGY.date,
    assignedAt: BIOLOGY.assignedAt,
    dueAt: BIOLOGY.dueAt,
    paper: BIOLOGY,
  },
  {
    id: "paper_math_shubham_20260920",
    institute: "Dhirise Gurukul",
    teacher: "Shubham Raj",
    subject: "Mathematics",
    title: "Number as a lamp",
    blurb: "Due in three days. A quiet sitting on sequences.",
    totalMarks: 80,
    durationMin: 40,
    date: stampLabel(dayStamp(5, true)),
    assignedAt: dayStamp(0),
    dueAt: dayStamp(5, true),
    paper: null,
  },
  {
    id: "paper_phy_missed_20260916",
    institute: "Dhirise Gurukul",
    teacher: "Ms Iyer",
    subject: "Physics",
    title: "Torque sitting",
    blurb: "Window closed.",
    totalMarks: 40,
    durationMin: 30,
    date: stampLabel(dayStamp(-2, true)),
    assignedAt: dayStamp(-8),
    dueAt: dayStamp(-2, true),
    paper: null,
  },
];
