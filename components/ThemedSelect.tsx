"use client";

// A select that looks like the rest of CF — native <select> popups are
// drawn by the OS and can't be themed, so this is a button + panel with
// the same amber-on-white language as the editor bubbles.

import { useEffect, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  /** small muted text after the label */
  hint?: string;
}

export function ThemedSelect({
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled,
  className = "",
  align = "left",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close on any click outside this control.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-left text-sm outline-none hover:border-amber-400 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900"
      >
        <span className={`min-w-0 truncate ${current ? "" : "text-neutral-400"}`}>
          {current?.label ?? placeholder}
          {current?.hint && (
            <span className="text-neutral-400"> — {current.hint}</span>
          )}
        </span>
        <span className="shrink-0 text-[10px] text-neutral-400">▾</span>
      </button>
      {open && (
        <div
          className={`absolute top-full z-30 mt-1 max-h-64 min-w-full overflow-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm ${
                  active
                    ? "bg-amber-50 font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                    : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="w-4 shrink-0 text-amber-600">{active ? "✓" : ""}</span>
                <span className="min-w-0 truncate">
                  {o.label}
                  {o.hint && <span className="text-neutral-400"> — {o.hint}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
