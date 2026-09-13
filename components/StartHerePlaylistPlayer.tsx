"use client";

// A series on the Start Here pathway: one player, the parts in order, each
// leading into the next.
//
// It never starts on its own — the spec's no-autoplay rule holds for
// arriving on the page — but once someone presses play, the series carries
// on until it ends or they stop it. One YouTube player is kept for the whole
// run and handed each part in turn, rather than a fresh frame per part:
// swapping the frame would need a new autoplay each time, which phones block.

import { useEffect, useId, useRef, useState } from "react";
import {
  loadYouTubeIframeApi,
  reportYouTubeError,
} from "@/components/useYouTubeErrorLog";
import {
  formatDuration,
  formatDurationCoarse,
  nextPlaylistIndex,
  playlistDuration,
  type StartHerePlaylist,
} from "@/lib/start-here";
import { isFatalYouTubeError } from "@/lib/youtube-embed-errors";

const STATE_ENDED = 0;
/** Series this short keep their parts list open; longer ones start folded. */
const OPEN_BY_DEFAULT_MAX = 6;

type Player = InstanceType<NonNullable<Window["YT"]>["Player"]>;

function embedUrl(youtubeId: string): string {
  const origin =
    typeof window !== "undefined"
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : "";
  // autoplay=1 is safe: this frame only mounts after the person pressed play.
  return `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&enablejsapi=1&autoplay=1${origin}`;
}

export function StartHerePlaylistPlayer({ playlist }: { playlist: StartHerePlaylist }) {
  const parts = playlist.videos;
  const [started, setStarted] = useState(false);
  const [startAt, setStartAt] = useState(0); // the part the frame first loads
  const [index, setIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  // The parts drawer. A twenty-part list would bury the page, so long series
  // start folded; short ones are already a glance and start open.
  const [listOpen, setListOpen] = useState(parts.length <= OPEN_BY_DEFAULT_MAX);
  const listId = useId();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<Player | null>(null);
  const readyRef = useRef(false);
  // The player's callbacks outlive any one render, so they read these.
  const indexRef = useRef(0);
  const startAtRef = useRef(0);

  function show(i: number) {
    indexRef.current = i;
    setIndex(i);
    setFinished(false);
  }

  function advance() {
    const next = nextPlaylistIndex(indexRef.current, parts.length);
    if (next === null) {
      setFinished(true);
      return;
    }
    show(next);
    playerRef.current?.loadVideoById?.(parts[next].youtube_id);
  }
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  /** Play part `i` — starting the series if it hasn't begun. */
  function choose(i: number) {
    show(i);
    if (!started) {
      startAtRef.current = i;
      setStartAt(i);
      setStarted(true);
      return;
    }
    // Before the player is ready the frame is still loading startAt;
    // onReady picks up whatever was chosen in the meantime.
    if (readyRef.current) playerRef.current?.loadVideoById?.(parts[i].youtube_id);
  }

  useEffect(() => {
    if (!started) return;
    let cancelled = false;
    loadYouTubeIframeApi(() => {
      if (cancelled || !window.YT?.Player || !iframeRef.current) return;
      playerRef.current = new window.YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            readyRef.current = true;
            if (indexRef.current !== startAtRef.current) {
              playerRef.current?.loadVideoById?.(parts[indexRef.current].youtube_id);
            }
          },
          onStateChange: (e) => {
            if (e.data === STATE_ENDED) advanceRef.current();
          },
          onError: (e) => {
            const id = parts[indexRef.current]?.youtube_id ?? "";
            reportYouTubeError("start-here-playlist", id, e.data);
            // A part that can't play is skipped, not the end of the series.
            if (isFatalYouTubeError(e.data)) advanceRef.current();
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current = null;
      readyRef.current = false;
    };
  }, [started, parts]);

  const total = formatDurationCoarse(playlistDuration(playlist));
  const current = parts[index];

  function partRow(i: number, focusable: boolean) {
    const part = parts[i];
    const active = started && i === index;
    return (
      <li key={part.youtube_id}>
        <button
          type="button"
          onClick={() => choose(i)}
          tabIndex={focusable ? 0 : -1}
          aria-current={active ? "true" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm transition-colors ${
            active
              ? "bg-amber-50 font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
              : "text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
          }`}
        >
          <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-neutral-400">
            {active && !finished ? "▶" : i + 1}
          </span>
          <span className="min-w-0 flex-1 truncate">{part.title}</span>
          <span className="shrink-0 text-xs tabular-nums text-neutral-400">
            {formatDuration(part.duration_seconds)}
          </span>
        </button>
      </li>
    );
  }

  return (
    <section
      aria-label={`Series: ${playlist.title}`}
      className="rounded-2xl border border-neutral-200 p-4 sm:p-5 dark:border-neutral-800"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Series · {parts.length} parts{total && ` · ${total}`}
        </p>
        <a
          href={`https://www.youtube.com/playlist?list=${playlist.youtube_playlist_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-neutral-400 hover:text-neutral-600 hover:underline dark:hover:text-neutral-300"
        >
          On YouTube ↗
        </a>
      </div>
      <h3 className="mt-1 text-lg font-semibold leading-snug">{playlist.title}</h3>
      <p className="text-sm text-neutral-500">
        <a
          href={playlist.channel_url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {playlist.creator}
        </a>
      </p>
      <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
        {playlist.why_this_one}
      </p>

      <div className="mt-4">
        {started ? (
          <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
            <iframe
              ref={iframeRef}
              src={embedUrl(parts[startAt].youtube_id)}
              title={playlist.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => choose(0)}
            aria-label={`Play the series from part 1: ${parts[0].title}`}
            className="group relative block w-full overflow-hidden rounded-xl bg-neutral-950"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${parts[0].youtube_id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
              className="aspect-video w-full object-cover opacity-90 transition-transform duration-300 group-hover:scale-105"
            />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex items-center gap-2 rounded-xl bg-black/60 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/30 transition-transform group-hover:scale-105">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M8 5.14v13.72L19 12 8 5.14Z" />
                </svg>
                Play the series
              </span>
            </span>
          </button>
        )}
      </div>

      {started && (
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium" aria-live="polite">
            {finished ? (
              <>
                That&apos;s the whole series.{" "}
                <button
                  type="button"
                  onClick={() => choose(0)}
                  className="text-amber-700 hover:underline dark:text-amber-400"
                >
                  Watch again from part 1
                </button>
              </>
            ) : (
              <>
                Part {index + 1} of {parts.length}
                <span className="text-neutral-400"> · next plays on its own</span>
              </>
            )}
          </p>
          <a
            href={`https://www.youtube.com/watch?v=${current.youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-400 underline hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            Trouble playing? Watch on YouTube ↗
          </a>
        </div>
      )}

      {/* The parts, in a drawer that slides open. Folded, it still shows
          the part you're on once the series is playing. */}
      <div className="mt-3 border-t border-neutral-100 dark:border-neutral-800">
        <button
          type="button"
          onClick={() => setListOpen((open) => !open)}
          aria-expanded={listOpen}
          aria-controls={listId}
          className="mt-1 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
        >
          <span>{listOpen ? "Hide parts" : `Show all ${parts.length} parts`}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={`h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-300 motion-reduce:transition-none ${
              listOpen ? "rotate-180" : ""
            }`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {!listOpen && started && (
          <ol aria-label="Now playing">{partRow(index, true)}</ol>
        )}

        {/* grid-rows 0fr → 1fr animates to the list's natural height. */}
        <div
          id={listId}
          className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${
            listOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <ol
              aria-hidden={!listOpen}
              className="divide-y divide-neutral-100 dark:divide-neutral-800"
            >
              {parts.map((_, i) => partRow(i, listOpen))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
