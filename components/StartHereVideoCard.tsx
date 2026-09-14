"use client";

// One curated pick: horizontal card — thumbnail left, text right.
// - Lazy: thumbnail first, iframe only on click. Never autoplay (spec).
// - Dead-video fallback: failed thumbnail → link-out card, logged.

import { useRef, useState } from "react";
import { useYouTubeErrorLog } from "@/components/useYouTubeErrorLog";
import { DepthBadge } from "@/components/DepthBadge";
import type { StartHereVideo } from "@/lib/start-here";
import { formatDurationCoarse, videoDepthKey } from "@/lib/start-here";

function embedUrl(youtubeId: string): string {
  // enablejsapi lets us observe onError events (logging + dead-video swap);
  // origin is required alongside it for the API to accept the frame.
  const origin =
    typeof window !== "undefined" ? `&origin=${encodeURIComponent(window.location.origin)}` : "";
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&enablejsapi=1${origin}`;
}

function Caption({
  video,
  depthEditable,
}: {
  video: StartHereVideo;
  depthEditable: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="text-base font-semibold leading-snug">{video.title}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
        <span>
          <a
            href={video.channel_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {video.creator}
          </a>
          {video.duration_seconds > 0 && (
            <> · {formatDurationCoarse(video.duration_seconds)}</>
          )}
        </span>
        {video.depth && (
          <DepthBadge
            depth={video.depth}
            itemKey={videoDepthKey(video.youtube_id)}
            editable={depthEditable}
          />
        )}
      </p>
      <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
        {video.why_this_one}
      </p>
    </div>
  );
}

function PlayingEmbed({
  video,
  onFatal,
  depthEditable,
}: {
  video: StartHereVideo;
  onFatal: () => void;
  depthEditable: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useYouTubeErrorLog(iframeRef, video.youtube_id, {
    source: "start-here",
    onFatal,
  });

  return (
    <div>
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <iframe
          ref={iframeRef}
          src={embedUrl(video.youtube_id)}
          title={video.title}
          className="h-full w-full"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className="mt-2 text-right text-xs text-neutral-400">
        Trouble playing?{" "}
        <a
          href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          Watch on YouTube ↗
        </a>
      </p>
      <div className="mt-2">
        <Caption video={video} depthEditable={depthEditable} />
      </div>
    </div>
  );
}

export function StartHereVideoCard({
  video,
  depthEditable = false,
  onPlay,
}: {
  video: StartHereVideo;
  /** Admins: the milk/meat badge becomes a switch. */
  depthEditable?: boolean;
  /** Called once, when the viewer presses play. */
  onPlay?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [dead, setDead] = useState(false);

  if (dead) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex aspect-video w-full shrink-0 items-center justify-center rounded-xl bg-neutral-100 sm:w-44 dark:bg-neutral-800">
          <a
            href={`https://www.youtube.com/watch?v=${video.youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:bg-white dark:border-neutral-600 dark:hover:border-amber-600 dark:hover:bg-neutral-700"
          >
            Watch on YouTube ↗
          </a>
        </div>
        <Caption video={video} depthEditable={depthEditable} />
      </div>
    );
  }

  if (playing) {
    return (
      <PlayingEmbed
        video={video}
        onFatal={() => setDead(true)}
        depthEditable={depthEditable}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <button
        type="button"
        onClick={() => {
          setPlaying(true);
          onPlay?.();
        }}
        aria-label={`Play: ${video.title}`}
        className="group relative w-full shrink-0 overflow-hidden rounded-xl bg-neutral-950 sm:w-44"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`}
          alt=""
          loading="lazy"
          className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={() => {
            console.warn(`start-here: dead video ${video.youtube_id} (${video.title})`);
            setDead(true);
          }}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/50 text-white ring-1 ring-white/40 transition-transform group-hover:scale-110">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.14v13.72L19 12 8 5.14Z" />
            </svg>
          </span>
        </span>
      </button>
      <Caption video={video} depthEditable={depthEditable} />
    </div>
  );
}
