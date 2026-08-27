"use client";

// Ebook authoring: create books, write chapters (HTML/plain text), mark
// free previews, set price, publish. Editing is library:manager; viewers
// see the list read-only.

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Chapter {
  id: string;
  sortOrder: number;
  title: string;
  freePreview: boolean;
}

interface Book {
  id: string;
  title: string;
  author: string | null;
  priceCents: number;
  published: boolean;
  purchases: number;
  chapters: Chapter[];
}

export function BooksManager({
  channelId,
  canEdit,
  payoutsReady,
  initialBooks,
}: {
  channelId: string;
  canEdit: boolean;
  payoutsReady: boolean;
  initialBooks: Book[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [price, setPrice] = useState("0");

  async function call(
    path: string,
    method: string,
    body: unknown,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.details?.join(" ") ?? data.error ?? `Failed (${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function createBook() {
    const priceCents = Math.round(Number(price) * 100);
    if (
      await call("/api/studio/ebooks", "POST", {
        channelId,
        title,
        author: author || undefined,
        priceCents: Number.isFinite(priceCents) ? priceCents : 0,
      })
    ) {
      setTitle("");
      setAuthor("");
      setPrice("0");
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {canEdit && (
        <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-lg font-medium">New book</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm sm:col-span-2 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min={0}
              step="0.01"
              placeholder="Price (USD, 0 = free)"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            />
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author (optional)"
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm sm:col-span-2 dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              onClick={() => void createBook()}
              disabled={busy || title.trim().length < 2}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
            >
              Create book
            </button>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {initialBooks.length === 0 ? (
        <p className="text-sm text-neutral-500">No books yet.</p>
      ) : (
        initialBooks.map((book) => (
          <BookEditor
            key={book.id}
            book={book}
            canEdit={canEdit}
            payoutsReady={payoutsReady}
            busy={busy}
            call={call}
          />
        ))
      )}
    </div>
  );
}

function BookEditor({
  book,
  canEdit,
  payoutsReady,
  busy,
  call,
}: {
  book: Book;
  canEdit: boolean;
  payoutsReady: boolean;
  busy: boolean;
  call: (path: string, method: string, body: unknown) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterHtml, setChapterHtml] = useState("");
  const [preview, setPreview] = useState(false);

  const paid = book.priceCents > 0;

  async function addChapter() {
    if (
      await call("/api/studio/ebooks/chapters", "POST", {
        ebookId: book.id,
        title: chapterTitle,
        htmlContent: chapterHtml || undefined,
        freePreview: preview,
      })
    ) {
      setChapterTitle("");
      setChapterHtml("");
      setPreview(false);
    }
  }

  function changePrice() {
    const input = window.prompt(
      "New price in USD (0 = free):",
      (book.priceCents / 100).toFixed(2),
    );
    if (input === null) return;
    const priceCents = Math.round(Number(input) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) return;
    void call("/api/studio/ebooks", "PATCH", { ebookId: book.id, priceCents });
  }

  return (
    <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium">
            {book.title}{" "}
            <span
              className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
                book.published
                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              }`}
            >
              {book.published ? "published" : "draft"}
            </span>
          </p>
          <p className="text-sm text-neutral-500">
            {book.author && <>{book.author} · </>}
            {paid ? `$${(book.priceCents / 100).toFixed(2)}` : "Free"} ·{" "}
            {book.chapters.length} chapters · {book.purchases} readers
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/book/${book.id}`}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
            >
              View
            </Link>
            <button
              onClick={changePrice}
              disabled={busy}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
            >
              Price
            </button>
            <button
              onClick={() =>
                void call("/api/studio/ebooks", "PATCH", {
                  ebookId: book.id,
                  published: !book.published,
                })
              }
              disabled={busy || (!book.published && paid && !payoutsReady)}
              className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
            >
              {book.published ? "Unpublish" : "Publish"}
            </button>
            {book.purchases === 0 && (
              <button
                onClick={() => {
                  if (window.confirm(`Delete “${book.title}”?`)) {
                    void call("/api/studio/ebooks", "DELETE", { ebookId: book.id });
                  }
                }}
                disabled={busy}
                className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      {!book.published && paid && !payoutsReady && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          Paid books need Stripe payouts ready (Payments tab) before publishing.
        </p>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="mt-3 text-sm text-neutral-500 underline-offset-2 hover:text-amber-600 hover:underline"
      >
        {open ? "Hide chapters" : `Chapters (${book.chapters.length})`}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <ul className="space-y-1">
            {book.chapters.map((chapter) => (
              <li
                key={chapter.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="min-w-0 truncate">
                  {chapter.sortOrder}. {chapter.title}
                  {chapter.freePreview && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium uppercase text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      free preview
                    </span>
                  )}
                </span>
                {canEdit && (
                  <span className="flex shrink-0 gap-2">
                    <button
                      onClick={() =>
                        void call("/api/studio/ebooks/chapters", "PATCH", {
                          chapterId: chapter.id,
                          freePreview: !chapter.freePreview,
                        })
                      }
                      disabled={busy}
                      className="text-xs text-neutral-400 underline-offset-2 hover:text-amber-600 hover:underline"
                    >
                      {chapter.freePreview ? "Lock" : "Make preview"}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete chapter “${chapter.title}”?`)) {
                          void call("/api/studio/ebooks/chapters", "DELETE", {
                            chapterId: chapter.id,
                          });
                        }
                      }}
                      disabled={busy}
                      className="text-xs text-neutral-400 hover:text-red-600"
                    >
                      Delete
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ul>

          {canEdit && (
            <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <p className="text-sm font-medium">Add chapter</p>
              <input
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Chapter title"
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
              <textarea
                value={chapterHtml}
                onChange={(e) => setChapterHtml(e.target.value)}
                rows={8}
                placeholder="Chapter content — plain text or HTML (<h2>, <p>, <blockquote>, <img>…)"
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs dark:border-neutral-700 dark:bg-neutral-900"
              />
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                <input
                  type="checkbox"
                  checked={preview}
                  onChange={(e) => setPreview(e.target.checked)}
                />
                Free preview (readable before purchase)
              </label>
              <button
                onClick={() => void addChapter()}
                disabled={busy || chapterTitle.trim().length === 0}
                className="mt-3 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
              >
                Add chapter
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
