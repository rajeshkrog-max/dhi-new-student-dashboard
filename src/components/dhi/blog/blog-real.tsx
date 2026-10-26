// The blog room, the student's side (spec house/0014). A student writes a post with a title, a tag and a body (bold, italic and a numbered list
// only). The author sees the post at once, marked as waiting for a teacher. Classmates see it once a teacher approves it. Comments are plain
// text and wait for review the same way. Nothing on this screen counts posts, streaks or reminds a student to write.
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import type { GenericId } from "convex/values";
import { useMutation, useQuery } from "convex/react";
import { api } from "@dhi/backend/api";
import { POST_TAGS, MAX_BODY, MAX_TITLE } from "@dhi/backend/blogRules";
import { Button } from "@/components/dhi/ui/button";
import { Card } from "@/components/dhi/ui/card";
import { Notice } from "@/components/dhi/ui/notice";
import { PHOTO_ACCEPT, shrinkPhoto } from "@/lib/dhi/photo";

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
const STATUS: Record<string, string> = { pending: "Waiting for a teacher", approved: "Shared with your class", hidden: "Hidden by a teacher", removed: "Removed" };

export function BlogReal() {
  const posts = useQuery(api.blog.list, {});
  const write = useMutation(api.blog.write);
  const uploadUrl = useMutation(api.blog.photoUploadUrl);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState<string>(POST_TAGS[0]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  // The preview address is given back when the picture changes or the screen closes.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

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
  function dropPhoto() {
    setPhoto(null);
    setPreview(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone("");
    try {
      let photoId: GenericId<"_storage"> | undefined;
      if (photo) {
        const sent = await fetch(await uploadUrl({}), { method: "POST", headers: { "Content-Type": photo.type }, body: photo });
        if (!sent.ok) throw Object.assign(new Error("photo"), { data: { code: "photo_failed" } });
        photoId = ((await sent.json()) as { storageId: GenericId<"_storage"> }).storageId;
      }
      await write({ title, tag, body, ...(photoId ? { photoId } : {}) });
      setTitle("");
      setBody("");
      dropPhoto();
      setDone("Your post is in. A teacher will look at it before your classmates see it.");
    } catch (err) {
      setError(wordFor(err));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4" data-testid="blog-room">
      <Card>
        <form onSubmit={submit} className="space-y-3" data-testid="blog-form">
          <label className="block text-sm">
            Title
            <input
              className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2"
              value={title}
              maxLength={MAX_TITLE}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Tag
            <select className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2" value={tag} onChange={(e) => setTag(e.target.value)}>
              {POST_TAGS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Body (bold, italic and a numbered list only)
            <textarea
              className="mt-1 w-full rounded-control border border-home/15 bg-white/80 px-3 py-2"
              rows={6}
              maxLength={MAX_BODY}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </label>
          <div className="space-y-2 text-sm">
            <label className="block">
              Photo (optional, one picture)
              <input type="file" accept={PHOTO_ACCEPT} onChange={pickPhoto} data-testid="blog-photo" className="mt-1 block w-full text-sm" />
            </label>
            {preview && (
              <div className="flex items-start gap-3">
                <img src={preview} alt="The picture you chose" className="max-h-40 rounded-control" data-testid="blog-photo-preview" />
                <Button variant="quiet" onClick={dropPhoto} data-testid="blog-photo-remove">
                  Remove the picture
                </Button>
              </div>
            )}
            <p className="text-xs text-mute">A teacher sees the picture before your classmates do. It is made smaller and the place it was taken is not kept.</p>
          </div>
          {error && (
            <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
              {error}
            </Notice>
          )}
          {done && (
            <Notice role="status" className="px-4 py-3 text-sm">
              {done}
            </Notice>
          )}
          <Button type="submit" disabled={busy}>
            Post
          </Button>
        </form>
      </Card>

      {posts === undefined && <p className="text-sm text-mute">Loading posts…</p>}
      {posts?.map((p) => (
        <PostCard key={p.postId} post={p} />
      ))}
    </div>
  );
}

type Post = {
  postId: GenericId<"blogPosts">;
  title: string;
  tag: string;
  body: string;
  status: string;
  mine: boolean;
  authorName: string;
  photoUrl: string | null;
  comments: { commentId: string; text: string; status: string; mine: boolean }[];
};

function PostCard({ post }: { post: Post }) {
  const comment = useMutation(api.blog.comment);
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
    <Card className="space-y-2" data-testid="blog-post">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{post.title}</h2>
        <span className="text-xs text-mute">
          {post.tag} · {post.mine ? "Your post" : post.authorName} · {STATUS[post.status] ?? post.status}
        </span>
      </div>
      {/* The body is already cleaned on the server to bold, italic and a numbered list, so it is shown as that markup. The student types line
          breaks in a plain box, so they are kept as written (pre-line). */}
      <div className="whitespace-pre-line text-sm" dangerouslySetInnerHTML={{ __html: post.body }} />
      {post.photoUrl && <img src={post.photoUrl} alt={`The picture on the post "${post.title}"`} loading="lazy" className="max-h-72 w-full rounded-control object-cover" data-testid="blog-post-photo" />}
      <ul className="space-y-1 border-t border-home/10 pt-2 text-sm">
        {post.comments.map((c) => (
          <li key={c.commentId} className="text-mute">
            {c.mine ? "You" : "Comment"} ({STATUS[c.status] ?? c.status}): <span dangerouslySetInnerHTML={{ __html: c.text }} />
          </li>
        ))}
      </ul>
      {approved && (
        <form onSubmit={send} className="flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-1 rounded-control border border-home/15 bg-white/80 px-3 py-2 text-sm"
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            aria-label="Write a comment"
          />
          <Button type="submit" variant="quiet" disabled={text.trim().length === 0}>
            Comment
          </Button>
        </form>
      )}
      {error && (
        <Notice tone="danger" role="alert" className="px-4 py-3 text-sm">
          {error}
        </Notice>
      )}
    </Card>
  );
}
