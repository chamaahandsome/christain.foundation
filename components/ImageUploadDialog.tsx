"use client";

// Image picker modal: upload a file to the shared S3 bucket (primary) or
// paste an https URL (fallback), with a remove option.

import { useEffect, useState } from "react";

export function ImageUploadDialog({
  open,
  title,
  channelId,
  allowRemove = true,
  onDone,
  onCancel,
}: {
  open: boolean;
  title: string;
  channelId: string;
  allowRemove?: boolean;
  onDone: (url: string | null) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setUrl("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("channelId", channelId);
      form.set("file", file);
      const res = await fetch("/api/studio/upload-image", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Upload failed (${res.status})`);
        return;
      }
      onDone(data.url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{title}</h2>

        <label
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 px-4 py-8 text-center transition-colors hover:border-amber-500 hover:bg-amber-50 dark:border-neutral-700 dark:hover:border-amber-600 dark:hover:bg-amber-950/30 ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <span className="text-2xl" aria-hidden>
            🖼️
          </span>
          <span className="mt-2 text-sm font-medium">
            {busy ? "Uploading…" : "Upload an image"}
          </span>
          <span className="mt-1 text-xs text-neutral-500">
            PNG, JPEG, WebP, or GIF · up to 5MB
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) onDone(url.trim());
          }}
        >
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            placeholder="…or paste an https image URL"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-950 dark:focus:border-amber-600"
          />
          <button
            type="submit"
            disabled={busy || !url.trim()}
            className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
          >
            Use URL
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex justify-between gap-2">
          {allowRemove ? (
            <button
              onClick={() => onDone(null)}
              disabled={busy}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
            >
              Remove image
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
