"use client";

// Studio library: rename items, set visibility, group into series. Edits go
// item by item — no bulk footguns; the ingest pipeline owns bulk import.

import Link from "next/link";
import { useState } from "react";

interface Item {
  id: string;
  title: string;
  visibility: string;
  seriesId: string | null;
  youtubeVideoId: string | null;
  publishedAt: string | null;
  durationSec: number | null;
}

interface SeriesRow {
  id: string;
  title: string;
  itemCount: number;
}

const VISIBILITIES = ["PUBLIC", "MEMBERS", "PAID"] as const;

export function LibraryManager({
  channelId,
  canEdit,
  initialItems,
  initialSeries,
}: {
  channelId: string;
  canEdit: boolean;
  initialItems: Item[];
  initialSeries: SeriesRow[];
}) {
  const [items, setItems] = useState(initialItems);
  const [series, setSeries] = useState(initialSeries);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSeries, setNewSeries] = useState("");

  async function patchItem(
    itemId: string,
    patch: Partial<Pick<Item, "title" | "visibility" | "seriesId">>,
  ) {
    setBusyId(itemId);
    setError(null);
    try {
      const res = await fetch("/api/studio/content", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentItemId: itemId, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      setItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, ...data.item } : item)),
      );
    } finally {
      setBusyId(null);
    }
  }

  async function createSeries() {
    if (newSeries.trim().length < 2) return;
    setError(null);
    const res = await fetch("/api/studio/series", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channelId, title: newSeries.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? `Failed (${res.status})`);
      return;
    }
    setSeries((prev) => [...prev, { id: data.series.id, title: data.series.title, itemCount: 0 }]);
    setNewSeries("");
  }

  function rename(item: Item) {
    const title = window.prompt("New title:", item.title);
    if (!title || title.trim().length === 0 || title === item.title) return;
    void patchItem(item.id, { title: title.trim() });
  }

  return (
    <div className="mt-6 space-y-8">
      {canEdit && (
        <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-sm font-medium">Series</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {series.map((s) => (
              <span
                key={s.id}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {s.title} · {s.itemCount}
              </span>
            ))}
            <input
              value={newSeries}
              onChange={(e) => setNewSeries(e.target.value)}
              placeholder="New series title"
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
            />
            <button
              onClick={() => void createSeries()}
              disabled={newSeries.trim().length < 2}
              className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs disabled:opacity-50 dark:border-neutral-700"
            >
              Add series
            </button>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
            {item.youtubeVideoId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://i.ytimg.com/vi/${item.youtubeVideoId}/default.jpg`}
                alt=""
                className="h-12 w-20 shrink-0 rounded object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <Link
                href={`/watch/${item.id}`}
                className="line-clamp-1 text-sm font-medium hover:underline"
              >
                {item.title}
              </Link>
              <p className="text-xs text-neutral-500">
                {item.publishedAt
                  ? new Date(item.publishedAt).toLocaleDateString()
                  : "unpublished"}
              </p>
            </div>
            {canEdit && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => rename(item)}
                  disabled={busyId === item.id}
                  className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs disabled:opacity-50 dark:border-neutral-700"
                >
                  Rename
                </button>
                <select
                  value={item.seriesId ?? ""}
                  onChange={(e) =>
                    void patchItem(item.id, { seriesId: e.target.value || null })
                  }
                  disabled={busyId === item.id}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                >
                  <option value="">No series</option>
                  {series.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
                <select
                  value={item.visibility}
                  onChange={(e) => void patchItem(item.id, { visibility: e.target.value })}
                  disabled={busyId === item.id}
                  className="rounded-lg border border-neutral-300 px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                >
                  {VISIBILITIES.map((v) => (
                    <option key={v} value={v}>
                      {v.toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </li>
        ))}
      </ul>
      {items.length === 0 && (
        <p className="text-sm text-neutral-500">
          No items yet — link a YouTube channel in settings and import your
          library from the studio.
        </p>
      )}
    </div>
  );
}
