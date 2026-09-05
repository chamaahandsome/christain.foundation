"use client";

// The Maltivas per-book workspace, CF-skinned: chapters list with
// draft/free-preview control and inline editing, whole-book import,
// pricing, cover, publish — one book, one page.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUploadDialog } from "@/components/ImageUploadDialog";
import { RichEditor } from "@/components/RichEditor";

interface Chapter {
  id: string;
  sortOrder: number;
  title: string;
  htmlContent: string;
  freePreview: boolean;
}
export interface StudioBook {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  coverImageUrl: string | null;
  priceCents: number;
  published: boolean;
  purchases: number;
  chapters: Chapter[];
}

export function BookStudio({
  channelId,
  book,
  payoutsReady,
}: {
  channelId: string;
  book: StudioBook;
  payoutsReady: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [dialog, setDialog] = useState<"delete" | null>(null);
  const [price, setPrice] = useState(String(book.priceCents / 100));
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Add-chapter form
  const [adding, setAdding] = useState(book.chapters.length === 0);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterHtml, setChapterHtml] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editHtml, setEditHtml] = useState("");

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return null;
      }
      router.refresh();
      return data as Record<string, unknown>;
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    setImporting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("ebookId", book.id);
      form.append("file", file);
      const res = await fetch("/api/studio/ebooks/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? `Import failed (${res.status})`);
      else router.refresh();
    } finally {
      setImporting(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/studio/channel/${channelId}/books`}
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ←
          </Link>
          <h1 className="truncate text-xl font-semibold">{book.title}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase ${
              book.published
                ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
            }`}
          >
            {book.published ? "published" : "draft"}
          </span>
        </div>
        <div className="flex gap-2">
          {book.published && (
            <Link
              href={`/book/${book.id}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
            >
              View public page ↗
            </Link>
          )}
          <button
            disabled={busy || (!book.published && book.priceCents > 0 && !payoutsReady)}
            title={
              !book.published && book.priceCents > 0 && !payoutsReady
                ? "Paid books need Stripe payouts (§9.4)"
                : undefined
            }
            onClick={() =>
              void call("/api/studio/ebooks", "PATCH", {
                ebookId: book.id,
                published: !book.published,
              })
            }
            className={
              book.published
                ? "rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-red-400 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-300"
                : "rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
            }
          >
            {book.published ? "Unpublish" : "🚀 Publish"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Chapters */}
        <div className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Chapters ({book.chapters.length})
            </h2>
            <div className="flex gap-2">
              <button
                disabled={importing}
                onClick={() => fileInput.current?.click()}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
              >
                {importing ? "Importing…" : "Import EPUB/PDF"}
              </button>
              <button
                onClick={() => setAdding((v) => !v)}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
              >
                {adding ? "Close" : "Add chapter"}
              </button>
            </div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".epub,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importFile(f);
            }}
          />

          {adding && (
            <div className="space-y-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800">
              <input
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Chapter title"
                className={input}
              />
              <RichEditor
                value={chapterHtml}
                onChange={setChapterHtml}
                minHeight={200}
                channelId={channelId}
                placeholder="Chapter content"
              />
              <button
                disabled={busy || !chapterTitle.trim()}
                onClick={() => {
                  void call("/api/studio/ebooks/chapters", "POST", {
                    ebookId: book.id,
                    title: chapterTitle,
                    htmlContent: chapterHtml || undefined,
                  }).then((ok) => {
                    if (ok) {
                      setAdding(false);
                      setChapterTitle("");
                      setChapterHtml("");
                    }
                  });
                }}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
              >
                Add chapter
              </button>
            </div>
          )}

          {book.chapters.length === 0 && !adding && (
            <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
              No chapters yet — write one, or import an EPUB/PDF (parsed into
              chapters, never stored as a file).
            </p>
          )}

          {book.chapters.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 flex-1 truncate text-sm font-medium">
                  <span className="mr-2 text-xs text-neutral-400">{c.sortOrder}.</span>
                  {c.title}
                </p>
                <div className="flex shrink-0 gap-2 text-xs">
                  <button
                    disabled={busy}
                    onClick={() =>
                      void call("/api/studio/ebooks/chapters", "PATCH", {
                        chapterId: c.id,
                        freePreview: !c.freePreview,
                      })
                    }
                    title="Free-preview chapters are readable before purchase"
                    className={
                      c.freePreview
                        ? "text-amber-700 dark:text-amber-400"
                        : "text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
                    }
                  >
                    {c.freePreview ? "Free preview ✓" : "Locked"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => {
                      if (editing === c.id) {
                        setEditing(null);
                      } else {
                        setEditing(c.id);
                        setEditTitle(c.title);
                        setEditHtml(c.htmlContent);
                      }
                    }}
                    className="text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
                  >
                    {editing === c.id ? "Close" : "Edit"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      void call("/api/studio/ebooks/chapters", "DELETE", {
                        chapterId: c.id,
                      })
                    }
                    className="text-red-600 hover:underline dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {editing === c.id && (
                <div className="mt-3 space-y-3">
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className={input}
                  />
                  <RichEditor
                    value={editHtml}
                    onChange={setEditHtml}
                    minHeight={200}
                    channelId={channelId}
                  />
                  <button
                    disabled={busy || !editTitle.trim()}
                    onClick={() => {
                      void call("/api/studio/ebooks/chapters", "PATCH", {
                        chapterId: c.id,
                        title: editTitle,
                        htmlContent: editHtml,
                      }).then((ok) => ok && setEditing(null));
                    }}
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
                  >
                    Save chapter
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Sidebar: cover, pricing, stats, danger */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Cover</h3>
            <button
              onClick={() => setCoverOpen(true)}
              className="mt-3 block w-32 overflow-hidden rounded-lg border border-dashed border-neutral-300 hover:border-amber-500 dark:border-neutral-700"
            >
              {book.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.coverImageUrl} alt="" className="aspect-[5/7] w-full object-cover" />
              ) : (
                <span className="flex aspect-[5/7] items-center justify-center text-xs text-neutral-500">
                  Add cover
                </span>
              )}
            </button>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Pricing</h3>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                <span className="text-sm text-neutral-500">$</span>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  type="number"
                  min={0}
                  step="0.01"
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  void call("/api/studio/ebooks", "PATCH", {
                    ebookId: book.id,
                    priceCents: Math.round(Number(price) * 100),
                  })
                }
                className="rounded-lg border border-neutral-300 px-3 py-2 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
              >
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              $0 makes the book free. Paid books carry CF&apos;s 5% on each sale.
            </p>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-5 text-sm dark:border-neutral-800">
            <h3 className="text-sm font-semibold">Stats</h3>
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">
              {book.purchases} {book.purchases === 1 ? "copy" : "copies"} in
              readers&apos; libraries
            </p>
          </div>

          <button
            disabled={busy}
            onClick={() => setDialog("delete")}
            className="text-xs text-red-600 underline-offset-2 hover:underline dark:text-red-400"
          >
            Delete this book
          </button>
        </aside>
      </div>

      <ImageUploadDialog
        open={coverOpen}
        title="Cover image"
        channelId={channelId}
        aspect={5 / 7}
        onCancel={() => setCoverOpen(false)}
        onDone={(url) => {
          setCoverOpen(false);
          void call("/api/studio/ebooks", "PATCH", {
            ebookId: book.id,
            coverImageUrl: url,
          });
        }}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Delete this book?"
        body="The book and all its chapters are removed permanently. Readers who purchased keep nothing — only delete books nobody owns."
        confirmLabel="Delete book"
        destructive
        onConfirm={() => {
          setDialog(null);
          void fetch("/api/studio/ebooks", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ebookId: book.id }),
          }).then(() => router.push(`/studio/channel/${channelId}/books`));
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
