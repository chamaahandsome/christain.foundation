"use client";

// In-app single-field modal — replaces window.prompt. Submit on Enter,
// cancel on Escape or backdrop click.

import { useEffect, useState } from "react";

export function InputDialog({
  open,
  title,
  body,
  label,
  placeholder,
  initialValue = "",
  type = "text",
  prefix,
  confirmLabel = "Save",
  busy = false,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  type?: "text" | "number" | "url";
  prefix?: string;
  confirmLabel?: string;
  busy?: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);

  // Re-seed the field each time the dialog opens.
  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <form
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(value);
        }}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        {body && (
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {body}
          </p>
        )}
        <label className="mt-4 block text-sm font-medium">
          {label}
          <div className="mt-1 flex items-center gap-2">
            {prefix && <span className="text-sm text-neutral-500">{prefix}</span>}
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              type={type}
              step={type === "number" ? "0.01" : undefined}
              min={type === "number" ? 0 : undefined}
              placeholder={placeholder}
              autoFocus
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-amber-600"
            />
          </div>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
