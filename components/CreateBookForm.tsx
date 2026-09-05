"use client";

// The Maltivas new-book flow: metadata + cover, then choose how the
// content arrives — import a whole EPUB/PDF (parsed to chapters, the file
// discarded) or start empty and write chapter by chapter.

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImageUploadDialog } from "@/components/ImageUploadDialog";

export function CreateBookForm({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [mode, setMode] = useState<"import" | "write">("import");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600";

  async function create() {
    setBusy("Creating the book…");
    setError(null);
    try {
      const res = await fetch("/api/studio/ebooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channelId,
          title,
          ...(author.trim() ? { author } : {}),
          ...(description.trim() ? { description } : {}),
          ...(coverUrl ? { coverImageUrl: coverUrl } : {}),
          priceCents: price ? Math.round(Number(price) * 100) : 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      const book = data.ebook as { id: string };

      if (mode === "import" && file) {
        setBusy("Parsing your book into chapters…");
        const form = new FormData();
        form.append("ebookId", book.id);
        form.append("file", file);
        const imp = await fetch("/api/studio/ebooks/import", {
          method: "POST",
          body: form,
        });
        if (!imp.ok) {
          const impData = await imp.json().catch(() => ({}));
          setError(
            `${impData.error ?? "Import failed"} — the book was created; import again from its page.`,
          );
        }
      }
      router.push(`/studio/channel/${channelId}/books/${book.id}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        New book
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Publish a book</h1>
      <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        Chapters live in the reader, never as a downloadable file — imported
        books are parsed and the file discarded.
      </p>

      <div className="mt-6 space-y-3">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setCoverOpen(true)}
            className="block w-28 shrink-0 overflow-hidden rounded-lg border border-dashed border-neutral-300 hover:border-amber-500 dark:border-neutral-700"
          >
            {coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverUrl} alt="" className="aspect-[5/7] w-full object-cover" />
            ) : (
              <span className="flex aspect-[5/7] items-center justify-center px-2 text-center text-xs text-neutral-500">
                Add cover
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
              className={input}
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author (defaults to your channel name)"
              className={input}
            />
            <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
              <span className="text-sm text-neutral-500">$</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                min={0}
                step="0.01"
                placeholder="0 = free"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
            </div>
          </div>
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={6000}
          placeholder="What the book is about — shown on its public page"
          className={input}
        />

        {/* Content mode — the Maltivas entire-book vs chapters choice */}
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("import")}
            className={`rounded-xl border px-4 py-3 text-left ${
              mode === "import"
                ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                : "border-neutral-200 hover:border-amber-300 dark:border-neutral-700"
            }`}
          >
            <p className="text-sm font-medium">📥 Import the whole book</p>
            <p className="text-xs text-neutral-500">
              EPUB or PDF — split into chapters automatically
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("write")}
            className={`rounded-xl border px-4 py-3 text-left ${
              mode === "write"
                ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                : "border-neutral-200 hover:border-amber-300 dark:border-neutral-700"
            }`}
          >
            <p className="text-sm font-medium">✍️ Write chapter by chapter</p>
            <p className="text-xs text-neutral-500">
              Start empty; add chapters in the editor
            </p>
          </button>
        </div>
        {mode === "import" && (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="w-full rounded-xl border border-dashed border-neutral-300 px-4 py-6 text-center text-sm text-neutral-500 hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
          >
            {file ? `📖 ${file.name}` : "Choose an .epub or .pdf file"}
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept=".epub,.pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={busy !== null}
          className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:border-neutral-400 dark:border-neutral-700"
        >
          Cancel
        </button>
        <button
          onClick={() => void create()}
          disabled={busy !== null || title.trim().length < 1 || (mode === "import" && !file)}
          className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
        >
          {busy ?? "Create book"}
        </button>
      </div>

      <ImageUploadDialog
        open={coverOpen}
        title="Cover image"
        channelId={channelId}
        aspect={5 / 7}
        allowRemove={false}
        onCancel={() => setCoverOpen(false)}
        onDone={(url) => {
          setCoverOpen(false);
          if (url) setCoverUrl(url);
        }}
      />
    </div>
  );
}
