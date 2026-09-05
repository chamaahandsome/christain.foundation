"use client";

// The Maltivas EBookReader experience over CF's chapters-in-DB substrate:
// TOC sidebar (drawer on mobile), prev/next + arrow keys, progress,
// typography settings (size, serif/sans, light/sepia/dark), tiled
// watermark, copy blockers — and the inline paywall when a free preview
// runs out. Locked chapters never receive their HTML from the server.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BuyEbookButtons } from "@/components/BuyEbookButtons";

interface ReaderChapter {
  sortOrder: number;
  title: string;
  readable: boolean;
  freePreview: boolean;
  html: string | null; // sanitized server-side; null when locked
}

/** "Chapter IV" / "Chapter 4" → 4; used to resolve a book's own internal
 * TOC links (whose file hrefs are stripped server-side) onto reader
 * chapters. */
function parseOrdinal(text: string): number | null {
  const m = text.match(/chapter\s+([ivxlcdm]+|\d+)/i);
  if (!m) return null;
  const raw = m[1];
  if (/^\d+$/.test(raw)) return Number(raw);
  const vals: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  let total = 0;
  const s = raw.toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const cur = vals[s[i]];
    const nxt = vals[s[i + 1]] ?? 0;
    if (!cur) return null;
    total += cur < nxt ? -cur : cur;
  }
  return total > 0 ? total : null;
}

const THEMES = {
  light: "bg-white text-neutral-900",
  sepia: "bg-[#f4ecd8] text-[#433422]",
  dark: "bg-neutral-900 text-neutral-100",
} as const;

export function EbookReader(props: {
  bookId: string;
  title: string;
  author: string | null;
  channelName: string;
  chapters: ReaderChapter[];
  initialChapter: number;
  watermark: string;
  priceCents: number;
  owned: boolean;
  tricklAvailable: boolean;
  signedIn: boolean;
}) {
  const [current, setCurrent] = useState(props.initialChapter);
  const [tocOpen, setTocOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fontSize, setFontSize] = useState(17);
  const [serif, setSerif] = useState(true);
  const [theme, setTheme] = useState<keyof typeof THEMES>("light");

  const idx = props.chapters.findIndex((c) => c.sortOrder === current);
  const chapter = props.chapters[idx] ?? props.chapters[0];
  const prev = props.chapters[idx - 1] ?? null;
  const next = props.chapters[idx + 1] ?? null;

  const go = useCallback(
    (target: ReaderChapter | null) => {
      if (!target) return;
      setCurrent(target.sortOrder);
      window.scrollTo({ top: 0 });
      const url = new URL(window.location.href);
      url.searchParams.set("ch", String(target.sortOrder));
      window.history.replaceState(null, "", url.toString());
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(prev);
      else if (e.key === "ArrowRight") go(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, prev, next]);

  // Restore reading preferences per device.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cf-reader-settings") ?? "{}");
      if (saved.fontSize) setFontSize(saved.fontSize);
      if (saved.serif !== undefined) setSerif(saved.serif);
      if (saved.theme && saved.theme in THEMES) setTheme(saved.theme);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "cf-reader-settings",
        JSON.stringify({ fontSize, serif, theme }),
      );
    } catch {}
  }, [fontSize, serif, theme]);

  const pct = Math.round(((idx + 1) / props.chapters.length) * 100);

  return (
    <div className={`min-h-screen ${THEMES[theme]}`}>
      {/* Top bar */}
      <div
        className={`sticky top-0 z-40 border-b backdrop-blur ${
          theme === "dark"
            ? "border-neutral-800 bg-neutral-900/95"
            : theme === "sepia"
              ? "border-[#e2d5b8] bg-[#f4ecd8]/95"
              : "border-neutral-200 bg-white/95"
        }`}
      >
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <button
            onClick={() => setTocOpen((v) => !v)}
            className="rounded-lg px-2 py-1.5 text-sm opacity-70 hover:opacity-100"
            aria-label="Chapters"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{props.title}</p>
            <p className="truncate text-xs opacity-60">
              {chapter.title} · {idx + 1}/{props.chapters.length} · {pct}%
            </p>
          </div>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="rounded-lg px-2 py-1.5 text-sm opacity-70 hover:opacity-100"
            aria-label="Reading settings"
          >
            Aa
          </button>
          <Link
            href={`/book/${props.bookId}`}
            className="rounded-lg px-2 py-1.5 text-sm opacity-70 hover:opacity-100"
          >
            ✕
          </Link>
        </div>
        {/* progress hairline */}
        <div className="h-0.5 w-full bg-black/5 dark:bg-white/5">
          <div
            className="h-full bg-linear-to-r from-amber-500 to-orange-600"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Settings popover */}
      {settingsOpen && (
        <div className="fixed right-4 top-16 z-50 w-64 rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-xl dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">
            Text size
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setFontSize((s) => Math.max(14, s - 1))}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-sm dark:border-neutral-600"
            >
              A−
            </button>
            <span className="flex-1 text-center text-sm">{fontSize}px</span>
            <button
              onClick={() => setFontSize((s) => Math.min(24, s + 1))}
              className="rounded-lg border border-neutral-300 px-3 py-1 text-lg dark:border-neutral-600"
            >
              A+
            </button>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide opacity-60">
            Font
          </p>
          <div className="mt-2 flex gap-2">
            {[
              [true, "Serif"],
              [false, "Sans"],
            ].map(([v, label]) => (
              <button
                key={String(v)}
                onClick={() => setSerif(v as boolean)}
                className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
                  serif === v
                    ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    : "border-neutral-300 dark:border-neutral-600"
                } ${v ? "font-serif" : ""}`}
              >
                {label as string}
              </button>
            ))}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide opacity-60">
            Theme
          </p>
          <div className="mt-2 flex gap-2">
            {(Object.keys(THEMES) as (keyof typeof THEMES)[]).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs capitalize ${
                  theme === t
                    ? "border-amber-500 ring-1 ring-amber-500"
                    : "border-neutral-300 dark:border-neutral-600"
                } ${THEMES[t]}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-4xl">
        {/* TOC sidebar / drawer */}
        {tocOpen && (
          <nav className="fixed inset-y-0 left-0 z-50 w-72 overflow-y-auto border-r border-neutral-200 bg-white p-4 text-neutral-900 shadow-xl lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:shadow-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Chapters</p>
              <button onClick={() => setTocOpen(false)} className="text-sm opacity-60">
                ✕
              </button>
            </div>
            <ol className="space-y-0.5">
              {props.chapters.map((c) => (
                <li key={c.sortOrder}>
                  <button
                    onClick={() => {
                      go(c);
                      setTocOpen(false);
                    }}
                    className={`flex w-full items-baseline gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                      c.sortOrder === current
                        ? "bg-amber-50 font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                        : "opacity-80 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="w-5 shrink-0 text-xs opacity-50">
                      {c.sortOrder}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {!c.readable && <span className="shrink-0 text-xs">🔒</span>}
                    {c.freePreview && !props.owned && c.readable && (
                      <span className="shrink-0 text-[10px] uppercase text-amber-600">
                        free
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-10">
          {chapter.readable && chapter.html ? (
            <div
              className="relative mx-auto max-w-2xl select-none"
              onContextMenu={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              onClickCapture={(e) => {
                // A book's own TOC page links to its chapters. The file
                // hrefs are stripped server-side; resolve the click onto a
                // reader chapter by title, then by "Chapter IV" ordinal.
                const a = (e.target as HTMLElement).closest("a");
                if (!a || /^https?:\/\//.test(a.getAttribute("href") ?? "")) return;
                e.preventDefault();
                const text = (a.textContent ?? "").trim().toLowerCase();
                if (!text) return;
                const byTitle = props.chapters.find(
                  (c) => c.title.trim().toLowerCase() === text,
                );
                if (byTitle) return go(byTitle);
                // Match by parsed ordinal on BOTH sides — survives roman vs
                // arabic numbering ("Chapter I" links to "Chapter 1") and
                // front-matter shifting positional indexes.
                const ord = parseOrdinal(text);
                if (ord) {
                  const byOrd = props.chapters.find(
                    (c) => parseOrdinal(c.title) === ord,
                  );
                  if (byOrd) return go(byOrd);
                  if (props.chapters[ord - 1]) return go(props.chapters[ord - 1]);
                }
              }}
            >
              {/* Tiled watermark */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 flex flex-wrap content-start gap-x-24 gap-y-32 overflow-hidden opacity-[0.05]"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className="rotate-[-20deg] whitespace-nowrap font-mono text-xs tracking-[0.3em]"
                  >
                    {props.watermark}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl font-semibold">{chapter.title}</h1>
              <div
                className={`prose-reader mt-6 leading-relaxed ${serif ? "font-serif" : ""}`}
                style={{ fontSize: `${fontSize}px`, lineHeight: 1.75 }}
                dangerouslySetInnerHTML={{ __html: chapter.html }}
              />
            </div>
          ) : (
            /* Paywall — the Maltivas EBookPaywallUI moment */
            <div className="mx-auto max-w-md py-16 text-center">
              <p className="text-5xl">🔒</p>
              <h2 className="mt-4 text-xl font-semibold">
                You&apos;ve reached the end of the free preview
              </h2>
              <p className="mt-2 text-sm leading-6 opacity-70">
                &ldquo;{chapter.title}&rdquo; and the rest of{" "}
                <span className="font-medium">{props.title}</span> unlock with
                the book — yours to read forever, supporting{" "}
                {props.channelName} directly.
              </p>
              <div className="mt-6 flex justify-center">
                <BuyEbookButtons
                  ebookId={props.bookId}
                  priceCents={props.priceCents}
                  owned={props.owned}
                  tricklAvailable={props.tricklAvailable}
                  signedIn={props.signedIn}
                />
              </div>
            </div>
          )}

          {/* Prev / next */}
          <div className="mx-auto mt-12 flex max-w-2xl items-center justify-between border-t border-black/10 pt-6 dark:border-white/10">
            <button
              onClick={() => go(prev)}
              disabled={!prev}
              className="rounded-xl border border-current/20 px-4 py-2 text-sm opacity-80 hover:opacity-100 disabled:opacity-30"
            >
              ← {prev ? prev.title : "Start"}
            </button>
            <span className="text-xs opacity-50">
              {idx + 1} / {props.chapters.length}
            </span>
            <button
              onClick={() => go(next)}
              disabled={!next}
              className="rounded-xl border border-current/20 px-4 py-2 text-sm opacity-80 hover:opacity-100 disabled:opacity-30"
            >
              {next ? next.title : "The end"} →
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
