"use client";

// Step-by-step feature guide (the Maltivas tour, CF-shaped). Steps that
// name an `anchor` (a CSS selector) spotlight that section of the page —
// the backdrop dims everything except a ring around the element and the
// card docks beside it; steps without an anchor (or whose anchor isn't on
// screen) render as a centered card. Auto-opens once per surface
// (localStorage) and replays from a Guide button.

import { useEffect, useLayoutEffect, useState } from "react";

export interface TourStep {
  icon: string;
  title: string;
  body: string;
  /** CSS selector to spotlight, e.g. '[data-tour="editor-title"]' */
  anchor?: string;
}

export function useFirstVisit(storageKey: string): [boolean, () => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(storageKey)) setOpen(true);
    } catch {
      /* storage unavailable — stay closed */
    }
  }, [storageKey]);
  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      /* ignore */
    }
  };
  return [open, dismiss];
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_W = 400;
const CARD_H = 300; // estimate for flip-above logic

export function FeatureTour({
  open,
  title,
  steps,
  onClose,
}: {
  open: boolean;
  title: string;
  steps: TourStep[];
  onClose: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  // Find + track the anchored element for the active step.
  const anchor = open ? steps[i]?.anchor : undefined;
  useLayoutEffect(() => {
    if (!anchor) {
      setRect(null);
      return;
    }
    const el = document.querySelector(anchor) as HTMLElement | null;
    if (!el) {
      setRect(null);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    let raf = 0;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) setRect(null);
      else setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    // let the smooth scroll settle, then glue to the element
    const timer = setTimeout(measure, 380);
    const onMove = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, [anchor, i, open]);

  if (!open || steps.length === 0) return null;
  const step = steps[i];
  const last = i === steps.length - 1;

  // Card placement: docked under (or over) the spotlight, else centered.
  const docked = rect !== null;
  let cardStyle: React.CSSProperties = {};
  if (docked && rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = rect.top + rect.height + 16;
    const top =
      below + CARD_H <= vh - 8 ? below : Math.max(8, rect.top - CARD_H - 16);
    const left = Math.max(
      8,
      Math.min(rect.left + rect.width / 2 - CARD_W / 2, vw - CARD_W - 8),
    );
    cardStyle = { top, left, width: Math.min(CARD_W, vw - 16) };
  }

  const card = (
    <div
      className={`${
        docked ? "fixed" : "w-full max-w-md"
      } rounded-3xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900`}
      style={docked ? cardStyle : undefined}
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-3.5 dark:border-neutral-800">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          {title} · step {i + 1} of {steps.length}
        </p>
        <button
          onClick={onClose}
          className="rounded-md px-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          aria-label="Close guide"
        >
          ✕
        </button>
      </div>

      <div className={`px-6 ${docked ? "py-5" : "py-8"} text-center`}>
        <span className={docked ? "text-3xl" : "text-5xl"}>{step.icon}</span>
        <h2 className={`mt-3 font-semibold ${docked ? "text-lg" : "text-xl"}`}>
          {step.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {step.body}
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-neutral-200 px-6 py-3.5 dark:border-neutral-800">
        <button
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={i === 0}
          className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:hover:bg-neutral-800"
        >
          ← Back
        </button>
        <div className="flex gap-1.5">
          {steps.map((_, d) => (
            <button
              key={d}
              onClick={() => setI(d)}
              aria-label={`Step ${d + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                d === i
                  ? "w-5 bg-linear-to-r from-amber-500 to-orange-600"
                  : "w-1.5 bg-neutral-300 dark:bg-neutral-700"
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => (last ? onClose() : setI((v) => v + 1))}
          className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
        >
          {last ? "Done ✓" : "Next →"}
        </button>
      </div>
    </div>
  );

  if (docked && rect) {
    return (
      <div className="fixed inset-0 z-[80]">
        {/* Spotlight: the ring's giant shadow dims everything around it */}
        <div
          className="pointer-events-none fixed rounded-xl border-2 border-amber-400 transition-all duration-300"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
        {card}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      {card}
    </div>
  );
}
