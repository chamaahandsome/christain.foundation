"use client";

import { useState } from "react";

const LINK_KEYS = ["website", "youtube", "instagram", "x", "facebook", "podcast"] as const;

interface Initial {
  name: string;
  bio: string;
  links: Partial<Record<(typeof LINK_KEYS)[number], string>>;
  youtubeChannelId: string;
}

export function ChannelSettingsForm({
  channelId,
  initial,
}: {
  channelId: string;
  initial: Initial;
}) {
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [links, setLinks] = useState<Record<string, string>>({ ...initial.links });
  const [youtube, setYoutube] = useState(initial.youtubeChannelId);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function save() {
    setBusy(true);
    setMessage(null);
    setErrors([]);
    try {
      const res = await fetch("/api/studio/channel", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channelId,
          name,
          bio,
          links,
          youtubeChannelId: youtube.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.details ?? [data.error ?? `Failed (${res.status})`]);
        return;
      }
      setMessage("Settings saved.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="mt-8 space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium">Channel name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Bio</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          maxLength={2000}
          className={inputClass}
          placeholder="Who you are, what your channel carries."
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">
          YouTube channel (for library import)
        </label>
        <input
          value={youtube}
          onChange={(e) => setYoutube(e.target.value)}
          className={inputClass}
          placeholder="@yourhandle or UC… channel id"
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Links (https only)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {LINK_KEYS.map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs font-medium capitalize text-neutral-500">
                {key}
              </label>
              <input
                value={links[key] ?? ""}
                onChange={(e) => setLinks({ ...links, [key]: e.target.value })}
                className={inputClass}
                placeholder={`https://…`}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      )}
      {message && <p className="text-sm text-green-600 dark:text-green-400">{message}</p>}

      <button
        onClick={() => void save()}
        disabled={busy}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
      >
        {busy ? "Saving…" : "Save settings"}
      </button>
    </div>
  );
}
