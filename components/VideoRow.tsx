"use client";

// A horizontal video shelf: title + arrow buttons, cards slide across with
// scroll-snap (native touch scrolling on mobile, arrows on desktop). Cards
// are server-rendered children; this component only owns the scrolling.

import { useRef, useState } from "react";

export function VideoRow({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  function updateEdges() {
    const el = scroller.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  }

  function slide(direction: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  const arrowClass =
    "flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition-colors hover:border-amber-500 hover:text-amber-600 disabled:opacity-30 disabled:hover:border-neutral-200 disabled:hover:text-neutral-600 dark:border-neutral-700 dark:text-neutral-300";

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {title}
          {typeof count === "number" && (
            <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
              {count}
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          <button
            aria-label={`Scroll ${title} back`}
            onClick={() => slide(-1)}
            disabled={atStart}
            className={arrowClass}
          >
            ←
          </button>
          <button
            aria-label={`Scroll ${title} forward`}
            onClick={() => slide(1)}
            disabled={atEnd}
            className={arrowClass}
          >
            →
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        onScroll={updateEdges}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}
