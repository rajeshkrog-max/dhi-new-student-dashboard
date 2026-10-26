// The blog room's event type (spec house/0014; the Brain reads it, scope row 17). `blog.published`: a teacher approved a student's post and it
// became visible to the class. The payload is the tag (a fixed code), the number of words and whether the post uses a numbered list: never a word
// of the writing. A post a teacher hides or removes later keeps its event, because the post was shown to the class when it was published.
import { defineEvent } from "../eventShapes";
import { POST_TAGS } from "../blogRules";

export const BLOG_EVENT_TYPES = [
  defineEvent({
    room: "blog",
    type: "blog.published",
    version: 2,
    // Version 2 adds whether the post has paragraphs and its range of words (the moving type-token ratio in thousandths, only for 50 words or more).
    payload: {
      tag: { kind: "code", values: POST_TAGS },
      words: { kind: "int", min: 0, max: 2000 },
      list: { kind: "boolean" },
      paragraphs: { kind: "boolean", optional: true },
      ttr: { kind: "int", min: 0, max: 1000, optional: true },
    },
  }),
  // `blog.commented`: a comment of the student was approved (written to the commenter). `blog.replied`: a comment on the student's post was approved (written
  // to the post's author, who did not do it, so it is not a log). Both carry nothing: the count is the whole of it.
  defineEvent({ room: "blog", type: "blog.commented", version: 1, payload: {} }),
  defineEvent({ room: "blog", type: "blog.replied", version: 1, payload: {} }),
];
