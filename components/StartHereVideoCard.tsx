"use client";

// One curated pick on a Start Here page.
// - Lazy: thumbnail first, iframe only on click. Never autoplay (spec).
// - Dead-video fallback: if the thumbnail fails to load, the card becomes a
//   link-out ("Watch on YouTube") instead of a broken player, and we log it.

import { useState } from "react";
import type { StartHereVideo } from "@/lib/start-here";
import { formatDuration } from "@/lib/start-here";

function embedUrl(youtubeId: string): string {
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`;
}

export function StartHereVideoCard({ video }: { video: StartHereVideo }) {
  const [playing, setPlaying] = useState(false);
  const [dead, setDead] = useState(false);

  if (dead) {
    return (
      <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <p className="text-sm font-medium">{video.title}</p>
        <p className="mt-1 text-xs text-neutral-500">
          This video is no longer available for embedded playback.
        </p>
        <a
          href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Watch on YouTube ↗
        </a>
      </div>
    );
  }

  return (
    <figure className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
      {playing ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={embedUrl(video.youtube_id)}
            title={video.title}
            className="h-full w-full"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="group relative block w-full"
          aria-label={`Play: ${video.title}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover"
            onError={() => {
              console.warn(`start-here: dead video ${video.youtube_id} (${video.title})`);
              setDead(true);
            }}
          />
          <span className="pointer-events-none absolute inset-0 bg-black/25 opacity-0 transition-opacity group-hover:opacity-100" />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg transition-transform group-hover:scale-110">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5.14v13.72L19 12 8 5.14Z" />
              </svg>
            </span>
          </span>
        </button>
      )}
      <figcaption className="p-4">
        <p className="text-sm font-medium">{video.title}</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          <a
            href={video.channel_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {video.creator}
          </a>
          {video.duration_seconds > 0 && <> · {formatDuration(video.duration_seconds)}</>}
        </p>
        <p className="mt-2 text-sm italic leading-6 text-neutral-600 dark:text-neutral-400">
          {video.why_this_one}
        </p>
      </figcaption>
    </figure>
  );
}
