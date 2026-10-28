// The blog room (spec house/0014), drawn as the house mockup: the class's posts as cards on a soft panel, a reading view with the lines left on a
// piece, and a writing sheet with bold, italic, a numbered list and one photo. A post and a comment wait for a teacher before classmates see them;
// the server cleans the body to bold, italic and a numbered list, so the editor's markup is only a starting point. The post's author can say a
// classmate's comment helped (house spec 0030); it counts only on the commenter's own Progress page.
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import type { GenericId } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Bold, ImagePlus, Italic, ListOrdered } from "lucide-react";
import { api } from "@dhi/backend/api";
import { POST_TAGS, MAX_BODY, MAX_TITLE } from "@dhi/backend/blogRules";
import { Sheet } from "@/components/dhi/sheet";
import { Button } from "@/components/dhi/ui/button";
import { Notice } from "@/components/dhi/ui/notice";
import { initialsOf } from "@/lib/dhi/initials";
import { PHOTO_ACCEPT, shrinkPhoto } from "@/lib/dhi/photo";
import { useStudent } from "@/lib/dhi/student";
import { cn } from "@/lib/utils";

const WORDS: Record<string, string> = {
  bad_title: "Please write a title, up to 80 characters.",
  bad_tag: "Please pick one of the tags.",
  bad_body: "Please write something in the body. Keep it under 4000 characters.",
  bad_text: "Please write a comment, up to 300 characters.",
  not_found: "We could not find that post. It may have been hidden.",
  consent_required: "Please agree to the house notice first.",
  consent_withdrawn: "Your consent is withdrawn, so the house is paused for you.",
  rate_limited: "That was too many tries for now. Please wait a little.",
  slow_down: "That was a lot in a short time. Please wait a little and try again.",
  bad_photo: "That picture could not be used. Please pick a JPEG, PNG or WebP picture.",
  photo_failed: "The picture did not go up. Please try again, or post without it.",
};
const wordFor = (error: unknown): string => {
  const data = (error as { data?: { code?: string } } | null)?.data;
  return (data?.code && WORDS[data.code]) || "Something went wrong. Please try again.";
};
const STATUS: Record<string, string> = {
  pending: "Waiting for a teacher",
  approved: "Shared with your class",
  hidden: "Hidden by a teacher",
  removed: "Removed",
};
const TAG_WORDS: Record<string, string> = {
  study: "Study",
  reflection: "Reflection",
  question: "Question",
  idea: "Idea",
};

type Post = {
  postId: GenericId<"blogPosts">;
  title: string;
  tag: string;
  body: string;
  status: string;
  mine: boolean;
  authorName: string;
  photoUrl: string | null;
  comments: { commentId: string; text: string; status: string; mine: boolean; helpful: boolean }[];
};

export function BlogReal() {
  const posts = useQuery(api.blog.list, {});
  const student = useStudent();
  const [writing, setWriting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [done, setDone] = useState("");
  const open = posts?.find((p) => p.postId === openId);

  if (open) return <Reader post={open} onBack={() => setOpenId(null)} />;

  return (
    <div className="flex flex-col gap-4" data-testid="blog-room">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mute">
          From the house. Yours and theirs. A teacher reads each piece before your class sees it.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone("");
            setWriting(true);
          }}
          className="h-11 rounded-full bg-home px-5 text-sm text-paper"
          data-testid="blog-write"
        >
          Write
        </button>
      </div>
      {done && (
        <Notice role="status" className="px-4 py-3 text-sm">
          {done}
        </Notice>
      )}
      <div className="rounded-panel bg-gradient-to-br from-mint/50 via-lilac/30 to-wash-lilac p-4">
        {posts === undefined ? (
          <p className="text-sm text-mute">Loading posts…</p>
        ) : posts.length === 0 ? (
          <p className="py-10 text-center text-sm text-mute">No pieces yet. Write the first one.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <button
                key={post.postId}
                type="button"
                onClick={() => setOpenId(post.postId)}
                className="overflow-hidden rounded-card bg-white text-left shadow-sm"
                data-testid="blog-post"
              >
                {post.photoUrl && (
                  <img
                    src={post.photoUrl}
                    alt={`The picture on the post "${post.title}"`}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover"
                    data-testid="blog-post-photo"
                  />
                )}
                <span className="block px-4 pb-4 pt-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="inline-block rounded-full bg-lilac/40 px-2 py-0.5 text-[11px] touch:text-xs">
                      {TAG_WORDS[post.tag] ?? post.tag}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] touch:text-xs",
                        post.status === "approved" ? "text-grove" : "text-mute",
                      )}
                    >
                      {STATUS[post.status] ?? post.status}
                    </span>
                  </span>
                  <span className="mt-2 block text-lg font-semibold leading-snug">
                    {post.title}
                  </span>
                  {/* The body is already cleaned on the server to bold, italic and a numbered list, so it is shown as that markup. */}
                  <span
                    className="blog-body mt-2 line-clamp-3 block whitespace-pre-line text-sm text-mute"
                    dangerouslySetInnerHTML={{ __html: post.body }}
                  />
                  <span className="mt-4 flex items-center gap-2 text-xs">
                    <span
                      className="grid size-7 place-items-center rounded-full bg-peach/50 text-[10px]"
                      aria-hidden
                    >
                      {post.mine ? student.initials : initialsOf(post.authorName)}
                    </span>
                    <span>
                      <span className="block font-medium text-home">
                        {post.mine ? "Your post" : post.authorName}
                      </span>
                      <span className="text-mute">
                        {post.comments.length} {post.comments.length === 1 ? "line" : "lines"}
                      </span>
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <Sheet open={writing} onOpenChange={setWriting} side="bottom" title="Write">
        <Composer
          onPosted={() => {
            setWriting(false);
            setDone("Your post is in. A teacher will look at it before your classmates see it.");
          }}
        />
      </Sheet>
    </div>
  );
}

function Reader({ post, onBack }: { post: Post; onBack: () => void }) {
  const comment = useMutation(api.blog.comment);
  const markHelpful = useMutation(api.blog.markHelpful);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const approved = post.status === "approved";

  async function send(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await comment({ postId: post.postId, text });
      setText("");
    } catch (err) {
      setError(wordFor(err));
    }
  }

  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-4" data-testid="blog-reader">
      <button
        type="button"
        onClick={onBack}
        className="flex h-11 w-fit items-center gap-2 rounded-full bg-white/80 px-4 text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to the house
      </button>
      <div className="overflow-hidden rounded-panel bg-white/85">
        {post.photoUrl && (
          <img
            src={post.photoUrl}
            alt={`The picture on the post "${post.title}"`}
            className="max-h-[360px] w-full object-cover"
          />
        )}
        <div className="px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-grove touch:text-xs">
            {TAG_WORDS[post.tag] ?? post.tag} · {STATUS[post.status] ?? post.status}
          </p>
          <h2 className="font-display mt-2 text-4xl leading-tight">{post.title}</h2>
          <p className="mt-2 text-sm text-mute">{post.mine ? "Your post" : post.authorName}</p>
          <div
            className="blog-body mt-6 whitespace-pre-line text-[17px] leading-8 text-home"
            dangerouslySetInnerHTML={{ __html: post.body }}
          />
        </div>
      </div>
      <section className="rounded-panel bg-white/75 p-5">
        <h3 className="text-sm font-semibold">Lines on this piece · {post.comments.length}</h3>
        <ul className="mt-3 space-y-3">
          {post.comments.map((c) => (
            <li key={c.commentId} className="rounded-control bg-page px-4 py-3">
              <p className="text-xs text-mute">
                {c.mine ? "You" : "A classmate"} · {STATUS[c.status] ?? c.status}
              </p>
              <p
                className="mt-1 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: c.text }}
              />
              {c.helpful ? (
                <span
                  className="mt-1 inline-block text-xs text-grove"
                  data-testid="blog-helpful-done"
                >
                  Helped
                </span>
              ) : (
                post.mine &&
                !c.mine &&
                c.status === "approved" && (
                  <Button
                    variant="link"
                    className="mt-1"
                    onClick={() =>
                      void markHelpful({
                        commentId: c.commentId as GenericId<"blogComments">,
                      }).catch(() => {})
                    }
                    data-testid="blog-helpful"
                  >
                    This helped me
                  </Button>
                )
              )}
            </li>
          ))}
          {post.comments.length === 0 && (
            <li className="text-sm text-mute">No lines yet. Leave the first.</li>
          )}
        </ul>
        {approved ? (
          <form className="mt-4 flex gap-2" onSubmit={send}>
            <input
              value={text}
              maxLength={300}
              onChange={(e) => setText(e.target.value)}
              placeholder="A quiet line…"
              aria-label="Write a comment"
              className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-sm outline-none focus-visible:focus-ring"
            />
            <button
              type="submit"
              disabled={text.trim().length === 0}
              className="h-11 rounded-full bg-home px-4 text-sm text-paper disabled:opacity-50"
            >
              Leave it
            </button>
          </form>
        ) : (
          <p className="mt-4 text-xs text-mute">
            Lines open once a teacher has shared the piece with your class.
          </p>
        )}
        {error && (
          <Notice tone="danger" role="alert" className="mt-3 px-4 py-3 text-sm">
            {error}
          </Notice>
        )}
      </section>
    </article>
  );
}

// What the editor holds, as the markup the server keeps: bold, italic and a numbered list, with a new line for each block or line break. Anything
// else becomes its text. The server cleans it again, so this only keeps what the student meant.
function bodyFrom(root: HTMLElement): string {
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const inner = [...el.childNodes].map(walk).join("");
    switch (el.tagName) {
      case "B":
      case "STRONG":
        return inner ? `<b>${inner}</b>` : "";
      case "I":
      case "EM":
        return inner ? `<i>${inner}</i>` : "";
      case "OL":
        return `<ol>${inner}</ol>`;
      case "LI":
        return `<li>${inner}</li>`;
      case "BR":
        return "\n";
      case "DIV":
      case "P":
        return `\n${inner}`;
      default:
        return inner;
    }
  };
  return [...root.childNodes].map(walk).join("").replace(/^\n+/, "").trim();
}

function Composer({ onPosted }: { onPosted: () => void }) {
  const write = useMutation(api.blog.write);
  const uploadUrl = useMutation(api.blog.photoUploadUrl);
  const body = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<string>(POST_TAGS[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function mark(cmd: "bold" | "italic" | "insertOrderedList") {
    body.current?.focus();
    // execCommand is old, but it is the one way every browser formats inside a contenteditable, and the result is cleaned before it is sent.
    document.execCommand(cmd);
  }

  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    try {
      const small = await shrinkPhoto(file);
      setPhoto(small);
      setPreview(URL.createObjectURL(small));
    } catch {
      setPhoto(null);
      setPreview(null);
      setError(WORDS.bad_photo);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = body.current ? bodyFrom(body.current) : "";
    if ([...text].length > MAX_BODY) return setError(WORDS.bad_body);
    setBusy(true);
    setError("");
    try {
      let photoId: GenericId<"_storage"> | undefined;
      if (photo) {
        const sent = await fetch(await uploadUrl({}), {
          method: "POST",
          headers: { "Content-Type": photo.type },
          body: photo,
        });
        if (!sent.ok) throw Object.assign(new Error("photo"), { data: { code: "photo_failed" } });
        photoId = ((await sent.json()) as { storageId: GenericId<"_storage"> }).storageId;
      }
      await write({ title, tag, body: text, ...(photoId ? { photoId } : {}) });
      onPosted();
    } catch (err) {
      setError(wordFor(err));
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" data-testid="blog-form">
      <label className="block">
        <span className="sr-only">Title</span>
        <input
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="A title, plainly"
          aria-label="Title"
          className="h-12 w-full rounded-control bg-white px-4 text-lg outline-none focus-visible:focus-ring"
        />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Tag">
        {POST_TAGS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tag === t}
            onClick={() => setTag(t)}
            className={cn(
              "h-8 rounded-full px-3 text-xs touch:h-11",
              tag === t ? "bg-home text-paper" : "bg-white",
            )}
          >
            {TAG_WORDS[t] ?? t}
          </button>
        ))}
      </div>
      <div className="flex gap-1" role="toolbar" aria-label="Formatting">
        <Tool label="Bold" onClick={() => mark("bold")}>
          <Bold className="size-4" aria-hidden />
        </Tool>
        <Tool label="Italic" onClick={() => mark("italic")}>
          <Italic className="size-4" aria-hidden />
        </Tool>
        <Tool label="Numbered list" onClick={() => mark("insertOrderedList")}>
          <ListOrdered className="size-4" aria-hidden />
        </Tool>
        <label
          className="grid size-9 cursor-pointer place-items-center rounded-chip bg-white has-[:focus-visible]:focus-ring touch:size-11"
          title="Photo"
        >
          <ImagePlus className="size-4" aria-hidden />
          <span className="sr-only">Photo (optional, one picture)</span>
          <input
            type="file"
            accept={PHOTO_ACCEPT}
            onChange={pickPhoto}
            data-testid="blog-photo"
            className="sr-only"
          />
        </label>
      </div>
      {preview && (
        <div className="flex items-start gap-3">
          <img
            src={preview}
            alt="The picture you chose"
            className="max-h-40 rounded-control object-cover"
            data-testid="blog-photo-preview"
          />
          <Button
            variant="quiet"
            onClick={() => {
              setPhoto(null);
              setPreview(null);
            }}
            data-testid="blog-photo-remove"
          >
            Remove the picture
          </Button>
        </div>
      )}
      <div
        ref={body}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Body"
        data-placeholder="Write as if no one is timing you."
        className="blog-body min-h-40 rounded-control bg-white px-4 py-3 text-base leading-7 outline-none empty:before:text-mute empty:before:content-[attr(data-placeholder)] focus-visible:focus-ring"
      />
      <p className="text-xs text-mute">
        A teacher sees the piece and the picture before your classmates do. The picture is made
        smaller and the place it was taken is not kept.
      </p>
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
      <button
        type="submit"
        disabled={busy}
        className="h-11 w-full rounded-full bg-gold text-sm font-medium text-gold-ink disabled:opacity-50"
      >
        {busy ? "Putting it in…" : "Put it in the house"}
      </button>
    </form>
  );
}

function Tool({
  children,
  onClick,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="grid size-9 place-items-center rounded-chip bg-white touch:size-11"
    >
      {children}
    </button>
  );
}
