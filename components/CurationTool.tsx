"use client";

// The founding-cohort indexing tool: search the library, place items onto
// the map (topic / question / position), see and remove existing placements.

import { useCallback, useEffect, useState } from "react";

interface Placement {
  id: string;
  note: string | null;
  topic: { name: string } | null;
  question: { title: string } | null;
  position: { name: string; question: { title: string } } | null;
}

interface Item {
  id: string;
  title: string;
  youtubeVideoId: string | null;
  channel: { handle: string };
  placements: Placement[];
}

interface QuestionOption {
  id: string;
  title: string;
  tier: string;
  positions: { id: string; name: string }[];
}

function placementLabel(p: Placement): string {
  if (p.topic) return `Topic: ${p.topic.name}`;
  if (p.question) return `Question: ${p.question.title}`;
  if (p.position) return `${p.position.question.title} → ${p.position.name}`;
  return "?";
}

export function CurationTool() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [questions, setQuestions] = useState<QuestionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (query: string) => {
    try {
      const res = await fetch(`/api/admin/curation?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items);
      setTopics(data.topics);
      setQuestions(data.questions);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void load("");
  }, [load]);

  async function place(
    contentItemId: string,
    targetType: string,
    targetId: string,
  ) {
    if (!targetId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/curation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentItemId, targetType, targetId }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `Failed (${res.status})`);
        return;
      }
      await load(q);
    } finally {
      setBusy(false);
    }
  }

  async function unplace(placementId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/curation", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placementId }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? `Failed (${res.status})`);
        return;
      }
      await load(q);
    } finally {
      setBusy(false);
    }
  }

  if (error && !items) return <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>;
  if (!items) return <p className="mt-6 text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="mt-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load(q);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the library by title…"
          className="w-full rounded-xl border border-neutral-300 px-4 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600"
        />
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <ul className="mt-6 space-y-5">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
          >
            <div className="flex gap-4">
              {item.youtubeVideoId && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://i.ytimg.com/vi/${item.youtubeVideoId}/default.jpg`}
                  alt=""
                  className="h-14 w-24 shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium">{item.title}</p>
                <p className="text-xs text-neutral-500">@{item.channel.handle}</p>
              </div>
            </div>

            {item.placements.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {item.placements.map((placement) => (
                  <span
                    key={placement.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  >
                    {placementLabel(placement)}
                    <button
                      onClick={() => void unplace(placement.id)}
                      disabled={busy}
                      aria-label="Remove placement"
                      className="font-semibold hover:text-red-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <PlacementPicker
              topics={topics}
              questions={questions}
              disabled={busy}
              onPlace={(type, id) => void place(item.id, type, id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlacementPicker({
  topics,
  questions,
  disabled,
  onPlace,
}: {
  topics: { id: string; name: string }[];
  questions: QuestionOption[];
  disabled: boolean;
  onPlace: (targetType: string, targetId: string) => void;
}) {
  const [value, setValue] = useState("");

  // One flat select: topics, then each question, then its positions —
  // "type:id" values. Grouped with optgroups for scanning speed.
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="max-w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-xs dark:border-neutral-700 dark:bg-neutral-900"
      >
        <option value="">Place onto…</option>
        <optgroup label="Topics">
          {topics.map((topic) => (
            <option key={topic.id} value={`topic:${topic.id}`}>
              {topic.name}
            </option>
          ))}
        </optgroup>
        {questions.map((question) => (
          <optgroup
            key={question.id}
            label={`${question.tier === "SPINE" ? "Spine" : "Disputed"} — ${question.title}`}
          >
            <option value={`question:${question.id}`}>
              The question itself
            </option>
            {question.positions.map((position) => (
              <option key={position.id} value={`position:${position.id}`}>
                Position: {position.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button
        onClick={() => {
          const [type, id] = value.split(":");
          if (type && id) {
            onPlace(type, id);
            setValue("");
          }
        }}
        disabled={disabled || !value}
        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
      >
        Place
      </button>
    </div>
  );
}
