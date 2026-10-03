/** House blog. Students write. Photos stay on the post. HTML is a small set of marks. */

export type BlogComment = { id: string; author: string; body: string; at: string };
export type BlogPost = {
  id: string;
  title: string;
  tag: string;
  html: string;
  photo: string | null;
  author: string;
  at: string;
  comments: BlogComment[];
};

export const BLOG_KEY = "dhi-blog-v1";

export const SEED: BlogPost[] = [
  {
    id: "b-leaf",
    title: "The leaf was not the kitchen",
    tag: "Academic",
    html: "<p>I kept naming the pore as the place where sugar is cooked. It is only the door.</p><ol><li>The pore breathes.</li><li>The green grain holds the pigment.</li><li>The coin the cell spends is ATP.</li></ol><p>I am writing it down so I do not mix them again.</p>",
    photo: "/desk/leaf-kitchen.jpg",
    author: "Meera Sen",
    at: "Yesterday",
    comments: [{ id: "c1", author: "Arjun Vale", body: "The third line settled it for me.", at: "Yesterday" }],
  },
  {
    id: "b-plate",
    title: "A plate I did not rush",
    tag: "Self help",
    html: "<p>Lunch was two rotis, dal, and a small bowl of curd. I sat until the plate was quiet.</p><p><i>Nothing heroic. Just not standing over the sink.</i></p>",
    photo: "/meals/thali.jpg",
    author: "Arjun Vale",
    at: "2d ago",
    comments: [],
  },
  {
    id: "b-heavy",
    title: "When the day sat heavy",
    tag: "Mental health",
    html: "<p>I did not need a fix. I needed a sentence that did not ask me to be brighter.</p><p><b>The house can hold a grey hour.</b></p>",
    photo: "/mood/thought.jpg",
    author: "Anika Rao",
    at: "3d ago",
    comments: [{ id: "c2", author: "Meera Sen", body: "I sat with this one twice.", at: "2d ago" }],
  },
];

export function loadPosts(): BlogPost[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(BLOG_KEY);
    if (!raw) return SEED;
    const saved = JSON.parse(raw) as BlogPost[];
    return saved.length ? saved : SEED;
  } catch {
    return SEED;
  }
}

export function saveMine(posts: BlogPost[]) {
  try {
    localStorage.setItem(BLOG_KEY, JSON.stringify(posts));
  } catch {
    /* photo may be large */
  }
}
