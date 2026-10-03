/**
 * Blog. A student reads the house, writes with a small set of marks, and may add one photo.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bold, ImagePlus, Italic, ListOrdered, X } from "lucide-react";
import { loadPosts, saveMine, type BlogPost } from "@/lib/dhi/blog/posts";
import { cn } from "@/lib/utils";

const TAGS = ["Academic", "Self help", "Mental health", "House"];

export function BlogRoom() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [open, setOpen] = useState<BlogPost | null>(null);
  const [writing, setWriting] = useState(false);

  useEffect(() => setPosts(loadPosts()), []);

  function commit(next: BlogPost[]) {
    setPosts(next);
    saveMine(next);
    setOpen(next.find((p) => p.id === open?.id) ?? null);
  }

  if (open && !writing) {
    return <Reader post={open} onBack={() => setOpen(null)} onComment={(body) => {
      const next = posts.map((p) => p.id === open.id ? { ...p, comments: [...p.comments, { id: `c-${Date.now()}`, author: "Suzzy Glass", body, at: "Just now" }] } : p);
      commit(next);
    }} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <style>{`.blog-body ol{list-style:decimal;margin:.4rem 0 .4rem 1.25rem} .blog-body p{margin:.45rem 0}`}</style>
      <div className="flex items-center justify-between">
        <p className="text-sm text-mute">From the house. Yours and theirs.</p>
        <button type="button" onClick={() => setWriting(true)} className="h-10 rounded-full bg-home px-4 text-sm text-paper">Write</button>
      </div>

      <div className="rounded-[28px] bg-gradient-to-br from-[#d7f3ea] via-[#e7e4ff] to-[#f3e7ff] p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {posts.map((post) => (
            <button key={post.id} type="button" onClick={() => setOpen(post)} className="overflow-hidden rounded-[22px] bg-white text-left shadow-sm">
              {post.photo && <img src={post.photo} alt="" className="aspect-[16/10] w-full object-cover" />}
              <span className="block px-4 pb-4 pt-3">
                <span className="inline-block rounded-full bg-lilac/40 px-2 py-0.5 text-[11px]">{post.tag}</span>
                <span className="mt-2 block text-lg font-semibold leading-snug">{post.title}</span>
                <span className="mt-2 line-clamp-3 block text-sm text-mute">{plain(post.html)}</span>
                <span className="mt-4 flex items-center gap-2 text-xs">
                  <span className="grid size-7 place-items-center rounded-full bg-peach/50 text-[10px]">{post.author.slice(0, 1)}</span>
                  <span>
                    <span className="block font-medium text-home">{post.author}</span>
                    <span className="text-mute">{post.at}</span>
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {writing && (
        <Composer
          onClose={() => setWriting(false)}
          onPublish={(post) => {
            const next = [post, ...posts];
            setPosts(next);
            saveMine(next);
            setWriting(false);
            setOpen(post);
          }}
        />
      )}
    </div>
  );
}

function Reader({ post, onBack, onComment }: { post: BlogPost; onBack: () => void; onComment: (body: string) => void }) {
  const [text, setText] = useState("");
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <style>{`.blog-body ol{list-style:decimal;margin:.4rem 0 .4rem 1.25rem} .blog-body p{margin:.45rem 0}`}</style>
      <button type="button" onClick={onBack} className="h-9 w-fit rounded-full bg-white/80 px-3 text-sm">Back to the house</button>
      <div className="overflow-hidden rounded-[28px] bg-white/85">
        {post.photo && <img src={post.photo} alt="" className="max-h-[360px] w-full object-cover" />}
        <div className="px-6 py-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-grove">{post.tag}</p>
          <h2 className="font-display mt-2 text-4xl leading-tight">{post.title}</h2>
          <p className="mt-2 text-sm text-mute">{post.author} · {post.at}</p>
          <div className="blog-body mt-6 text-[17px] leading-8 text-home" dangerouslySetInnerHTML={{ __html: safeHtml(post.html) }} />
        </div>
      </div>
      <section className="rounded-[28px] bg-white/75 p-5">
        <h3 className="text-sm font-semibold">Lines on this piece · {post.comments.length}</h3>
        <ul className="mt-3 space-y-3">
          {post.comments.map((c) => (
            <li key={c.id} className="rounded-2xl bg-home-bg px-4 py-3">
              <p className="text-xs text-mute">{c.author} · {c.at}</p>
              <p className="mt-1 text-sm leading-relaxed">{c.body}</p>
            </li>
          ))}
          {post.comments.length === 0 && <li className="text-sm text-mute">No lines yet. Leave the first.</li>}
        </ul>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; onComment(text.trim()); setText(""); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="A quiet line…" className="h-11 min-w-0 flex-1 rounded-full bg-white px-4 text-sm outline-none" />
          <button type="submit" className="h-11 rounded-full bg-home px-4 text-sm text-paper">Leave it</button>
        </form>
      </section>
    </article>
  );
}

function Composer({ onClose, onPublish }: { onClose: () => void; onPublish: (post: BlogPost) => void }) {
  const body = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState(TAGS[0]);
  const [photo, setPhoto] = useState<string | null>(null);

  function mark(cmd: "bold" | "italic" | "insertOrderedList") {
    body.current?.focus();
    document.execCommand(cmd);
  }

  async function onFile(file: File) {
    const data = await shrink(file);
    setPhoto(data);
  }

  function publish() {
    const html = safeHtml(body.current?.innerHTML || "");
    if (!title.trim() || plain(html).length < 2) return;
    onPublish({
      id: `b-${Date.now()}`,
      title: title.trim(),
      tag,
      html,
      photo,
      author: "Suzzy Glass",
      at: "Just now",
      comments: [],
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-home/30 p-4" onClick={onClose}>
      <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-[28px] bg-white p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl">Write</p>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-home-bg" aria-label="Close"><X className="size-4" /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A title, plainly" className="mt-4 h-12 w-full rounded-2xl bg-home-bg px-4 text-lg outline-none" />
        <div className="mt-3 flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button key={t} type="button" onClick={() => setTag(t)} className={cn("h-8 rounded-full px-3 text-xs", tag === t ? "bg-home text-paper" : "bg-home-bg")}>{t}</button>
          ))}
        </div>
        <div className="mt-3 flex gap-1">
          <Tool label="Bold" onClick={() => mark("bold")}><Bold className="size-4" /></Tool>
          <Tool label="Italic" onClick={() => mark("italic")}><Italic className="size-4" /></Tool>
          <Tool label="Numbered list" onClick={() => mark("insertOrderedList")}><ListOrdered className="size-4" /></Tool>
          <label className="grid size-9 cursor-pointer place-items-center rounded-xl bg-home-bg" title="Photo">
            <ImagePlus className="size-4" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
          </label>
        </div>
        {photo && <img src={photo} alt="" className="mt-3 max-h-40 w-full rounded-2xl object-cover" />}
        <div
          ref={body}
          contentEditable
          role="textbox"
          aria-label="Piece"
          data-placeholder="Write as if no one is timing you."
          className="blog-body mt-3 min-h-40 rounded-2xl bg-home-bg px-4 py-3 text-[16px] leading-7 outline-none empty:before:text-mute empty:before:content-[attr(data-placeholder)]"
        />
        <button type="button" onClick={publish} className="mt-4 h-11 w-full rounded-full bg-gold text-sm font-medium text-gold-ink">Put it in the house</button>
      </div>
    </div>
  );
}

function Tool({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="grid size-9 place-items-center rounded-xl bg-home-bg">
      {children}
    </button>
  );
}

function plain(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function safeHtml(html: string) {
  if (typeof DOMParser === "undefined") return plain(html);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const allow = new Set(["B", "STRONG", "I", "EM", "OL", "LI", "P", "BR", "DIV"]);
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent || "").replace(/[&<>]/g, (c) => ({ "&": "&", "<": "<", ">": ">" })[c]!);
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const inner = [...el.childNodes].map(walk).join("");
    if (el.tagName === "BR") return "<br/>";
    if (!allow.has(el.tagName)) return inner;
    const tag = el.tagName.toLowerCase();
    return `<${tag}>${inner}</${tag}>`;
  };
  return [...doc.body.childNodes].map(walk).join("");
}

function shrink(file: File) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 960 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => reject(new Error("photo"));
    img.src = url;
  });
}
