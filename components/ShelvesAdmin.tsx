"use client";

// Editorial shelves: create, publish, order, and fill the hand-curated rows
// that appear on explore. Items are added by searching the library.

import { useCallback, useEffect, useState } from "react";

interface ShelfRow {
  id: string;
  slug: string;
  title: string;
  sortOrder: number;
  published: boolean;
  items: {
    id: string;
    contentItem: { id: string; title: string; channel: { handle: string } } | null;
  }[];
}

export function ShelvesAdmin() {
  const [shelves, setShelves] = useState<ShelfRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/shelves");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setShelves((await res.json()).shelves);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(method: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/shelves", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `Failed (${res.status})`);
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(false);
    }
  }

  if (error && !shelves) return <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!shelves) return <p className="mt-6 text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="mt-6 space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (newTitle.trim().length >= 2) {
            void call("POST", { action: "create_shelf", title: newTitle.trim() }).then(
              (ok) => ok && setNewTitle(""),
            );
          }
        }}
        className="flex flex-wrap gap-2"
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New shelf title (e.g. Start with the Gospel)"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={busy || newTitle.trim().length < 2}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          Create shelf
        </button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {shelves.length === 0 ? (
        <p className="text-sm text-neutral-500">No shelves yet.</p>
      ) : (
        shelves.map((shelf) => (
          <section
            key={shelf.id}
            className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">
                {shelf.title}{" "}
                <span
                  className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium uppercase ${
                    shelf.published
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                      : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                  }`}
                >
                  {shelf.published ? "published" : "draft"}
                </span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    void call("PATCH", { shelfId: shelf.id, published: !shelf.published })
                  }
                  disabled={busy}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-neutral-700"
                >
                  {shelf.published ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete shelf “${shelf.title}”?`)) {
                      void call("DELETE", { shelfId: shelf.id });
                    }
                  }}
                  disabled={busy}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>

            <ul className="mt-3 space-y-1">
              {shelf.items.map(
                (item) =>
                  item.contentItem && (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {item.contentItem.title}{" "}
                        <span className="text-neutral-500">
                          @{item.contentItem.channel.handle}
                        </span>
                      </span>
                      <button
                        onClick={() => void call("DELETE", { shelfItemId: item.id })}
                        disabled={busy}
                        aria-label="Remove from shelf"
                        className="shrink-0 text-neutral-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </li>
                  ),
              )}
            </ul>

            <AddItemForm
              disabled={busy}
              onAdd={(contentItemId) =>
                void call("POST", { action: "add_item", shelfId: shelf.id, contentItemId })
              }
            />
          </section>
        ))
      )}
    </div>
  );
}

function AddItemForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (contentItemId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; title: string }[]>([]);

  async function search() {
    if (q.trim().length < 2) return;
    const res = await fetch(`/api/admin/curation?q=${encodeURIComponent(q.trim())}`);
    if (res.ok) {
      const data = await res.json();
      setResults(
        (data.items as { id: string; title: string }[]).slice(0, 8).map((i) => ({
          id: i.id,
          title: i.title,
        })),
      );
    }
  }

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Find teaching to add…"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          onClick={() => void search()}
          disabled={disabled || q.trim().length < 2}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-neutral-700"
        >
          Search
        </button>
      </div>
      {results.length > 0 && (
        <ul className="mt-2 space-y-1">
          {results.map((result) => (
            <li key={result.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate">{result.title}</span>
              <button
                onClick={() => {
                  onAdd(result.id);
                  setResults([]);
                  setQ("");
                }}
                disabled={disabled}
                className="shrink-0 rounded-lg border border-neutral-300 px-2 py-1 disabled:opacity-50 dark:border-neutral-700"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
