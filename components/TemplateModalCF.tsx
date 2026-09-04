"use client";

// The Do-Biz template picker, CF-skinned: search + filters + categories in
// the left panel, a template card grid with hover-preview overlays on the
// right. Selecting a template creates the contract immediately and opens
// the editor (the Maltivas flow).

import { useMemo, useState } from "react";

export interface PickerTemplate {
  id: string;
  name: string;
  category: string;
  description: string | null;
  isDefault: boolean;
}

export function TemplateModalCF({
  open,
  templates,
  creating,
  onSelect,
  onBlank,
  onClose,
}: {
  open: boolean;
  templates: PickerTemplate[];
  creating: boolean;
  onSelect: (templateId: string) => void;
  onBlank: () => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"library" | "mine">("library");
  const [category, setCategory] = useState<string>("All");

  const categories = useMemo(
    () => ["All", ...new Set(templates.map((t) => t.category))],
    [templates],
  );
  const filtered = templates.filter((t) => {
    if (filter === "mine" && t.isDefault) return false;
    if (category !== "All" && t.category !== category) return false;
    const q = search.trim().toLowerCase();
    if (q && !`${t.name} ${t.description ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const mineCount = templates.filter((t) => !t.isDefault).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-[80vh] w-full max-w-5xl flex-col rounded-3xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 p-5 dark:border-neutral-800">
          <h2 className="text-xl font-semibold">Choose a template</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* Left panel */}
          <div className="hidden w-64 shrink-0 space-y-5 border-r border-neutral-200 p-5 sm:block dark:border-neutral-800">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="w-full rounded-xl border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950"
            />
            <div className="space-y-1">
              <button
                onClick={() => setFilter("library")}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                  filter === "library"
                    ? "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                ★ For ministries
              </button>
              <button
                onClick={() => setFilter("mine")}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
                  filter === "mine"
                    ? "border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="flex-1">My templates</span>
                {mineCount > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {mineCount}
                  </span>
                )}
              </button>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Categories</h3>
              <div className="space-y-0.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className={`w-full rounded-lg px-3 py-1.5 text-left text-sm ${
                      category === c
                        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right panel — template grid */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {/* Blank */}
              <button
                onClick={onBlank}
                disabled={creating}
                className="group overflow-hidden rounded-2xl border border-dashed border-neutral-300 text-left transition-colors hover:border-amber-400 disabled:opacity-50 dark:border-neutral-700"
              >
                <div className="flex aspect-[4/3] items-center justify-center bg-neutral-50 dark:bg-neutral-800/60">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-200 text-3xl text-neutral-500 transition-colors group-hover:bg-amber-100 group-hover:text-amber-700 dark:bg-neutral-700">
                    +
                  </span>
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium">Blank contract</p>
                  <p className="text-xs text-neutral-500">Start from nothing</p>
                </div>
              </button>

              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  disabled={creating}
                  className="group overflow-hidden rounded-2xl border border-neutral-200 text-left transition-all hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-lg disabled:opacity-50 dark:border-neutral-800"
                >
                  <div className="relative flex aspect-[4/3] items-center justify-center bg-linear-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40">
                    <span className="text-5xl">📄</span>
                    {/* Hover preview overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-amber-600/0 opacity-0 backdrop-blur-0 transition-all duration-300 group-hover:bg-amber-600/85 group-hover:opacity-100 group-hover:backdrop-blur-sm">
                      <div className="px-4 text-center">
                        <p className="text-sm font-bold text-white">Use this template</p>
                        {t.description && (
                          <p className="mt-1 text-xs leading-snug text-white/90">
                            {t.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.category}</p>
                  </div>
                </button>
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <p className="text-4xl">🗂</p>
                <p className="mt-3 text-sm font-medium">No templates match</p>
                <p className="text-xs text-neutral-500">
                  {filter === "mine"
                    ? "Save a contract as a template and it appears here."
                    : "Try a different search or category."}
                </p>
              </div>
            )}
          </div>
        </div>

        {creating && (
          <div className="border-t border-neutral-200 p-3 text-center text-sm text-neutral-500 dark:border-neutral-800">
            Creating your contract…
          </div>
        )}
      </div>
    </div>
  );
}
