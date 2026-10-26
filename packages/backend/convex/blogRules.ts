// The pure rules of the blog room (spec house/0014): the allowed markup, the cleaning of a body on the server, and the limits. No database and
// no clock, and no imports, so the screen and the tests can read the same rules.

// The only markup a post body may keep: bold, italic and a numbered list. Everything else is removed, and text is kept as text.
export const ALLOWED_TAGS = ["b", "i", "ol", "li"] as const;
export const MAX_TITLE = 80;
export const MAX_BODY = 4000;
export const MAX_COMMENT = 300;
// One photo for a post (spec house/0014). The screen shrinks it to at most 1280 pixels on its long side and re-saves it as a JPEG, which also drops any
// place or camera details; the server still refuses anything over 1.5 MB, a type that is not JPEG, PNG or WebP, and a file that is not fresh (uploaded in
// the last hour) or is already held by another post.
export const MAX_PHOTO_BYTES = 1_500_000;
export const PHOTO_FRESH_MS = 60 * 60 * 1000;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

// What the file store says about an uploaded file (the system record), and whether it may be a post's photo: it exists, is not empty, is small enough,
// was uploaded in the last hour, and if it declared a type, that type is a JPEG, PNG or WebP. A file that declared no type is allowed: it is served with
// no picture type, so a page disguised as a picture is never run by a browser. Whether another post or a profile picture holds the file is the server's.
export type StoredFile = { size: number; contentType?: string | undefined; _creationTime: number };
export function photoFileProblem(file: StoredFile | null, now: number): "bad_photo" | null {
  if (file === null) return "bad_photo";
  if (!(file.size > 0) || file.size > MAX_PHOTO_BYTES) return "bad_photo";
  if (now - file._creationTime > PHOTO_FRESH_MS) return "bad_photo";
  if (file.contentType !== undefined && !(PHOTO_TYPES as readonly string[]).includes(file.contentType)) return "bad_photo";
  return null;
}

// The tags a post can carry. The owner has not named the full list yet, so this is the first set and is a follow up in spec 0014.
export const POST_TAGS = ["study", "reflection", "question", "idea"] as const;
export type PostTag = (typeof POST_TAGS)[number];
export const isPostTag = (text: unknown): text is PostTag => typeof text === "string" && (POST_TAGS as readonly string[]).includes(text);

// The words of a cleaned body: the text between the tags, split on spaces. A post's length for the Brain is this count.
export const wordsOf = (body: string): number => body.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;
export const hasList = (body: string): boolean => body.includes("<ol>");
// A post has paragraphs when its text holds a blank line between two parts (the Master Spec's structure measure, E14).
export const hasParagraphs = (body: string): boolean => /\S[ \t]*\n[ \t]*\n\s*\S/.test(body.replace(/<[^>]*>/g, ""));
// The range of words (E13): the moving type-token ratio over windows of 50 words (unique words over 50, lower cased), averaged over the windows, in
// thousandths. A post under 50 words has none.
export const TTR_WINDOW = 50;
export function movingTtr(body: string): number | null {
  const words = body.replace(/<[^>]*>/g, " ").toLowerCase().split(/[^\p{L}\p{N}']+/u).filter(Boolean);
  if (words.length < TTR_WINDOW) return null;
  let total = 0;
  let windows = 0;
  for (let i = 0; i + TTR_WINDOW <= words.length; i += 1) {
    total += new Set(words.slice(i, i + TTR_WINDOW)).size / TTR_WINDOW;
    windows += 1;
  }
  return Math.round((total / windows) * 1000);
}

const escapeText = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Cleans a body to the allowed markup. Each tag is checked by name only: an allowed tag is kept with no attributes, any other tag is dropped,
// and the text between tags is escaped. Returns the cleaned body and the number of characters after trimming.
export function cleanBody(raw: string): string {
  const parts = raw.split(/(<[^>]*>)/g);
  let out = "";
  for (const part of parts) {
    if (part.startsWith("<") && part.endsWith(">")) {
      const match = /^<\s*(\/?)\s*([a-zA-Z]+)[^>]*>$/.exec(part);
      if (match) {
        const name = match[2].toLowerCase();
        if ((ALLOWED_TAGS as readonly string[]).includes(name)) out += `<${match[1]}${name}>`;
      }
      // Anything else that looks like a tag, including a script tag, is dropped with its text markers.
      continue;
    }
    out += escapeText(part);
  }
  return out.trim();
}

// The body is at most 4000 characters after cleaning, and must not be empty.
export function bodyProblem(body: string): "bad_body" | null {
  const cleaned = cleanBody(body);
  if (cleaned.length === 0 || [...cleaned].length > MAX_BODY) return "bad_body";
  return null;
}

export function titleProblem(title: string): "bad_title" | null {
  const text = title.trim();
  if (text.length === 0 || [...text].length > MAX_TITLE) return "bad_title";
  return null;
}
