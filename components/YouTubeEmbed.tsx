"use client";

// The CF watch surface around the official YouTube player (concept §8):
// our chrome, no autoplay-away. enablejsapi lets us report playback progress
// for continue-watching. We control around the player, not inside it.

import { useEffect, useRef, useState } from "react";
import { buildEmbedUrl } from "@/lib/youtube";

declare global {
  interface Window {
    YT?: {
      Player: new (
        el: HTMLIFrameElement,
        opts: { events: Record<string, (e: { data: number }) => void> },
      ) => { getCurrentTime?: () => number; getPlayerState?: () => number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

const REPORT_INTERVAL_MS = 10_000;
const STATE_ENDED = 0;
const STATE_PLAYING = 1;

function report(contentItemId: string, positionSec: number, completed = false) {
  const body = JSON.stringify({ contentItemId, positionSec, completed });
  // sendBeacon survives tab close; fall back to fetch.
  if (!navigator.sendBeacon?.("/api/progress", new Blob([body], { type: "application/json" }))) {
    fetch("/api/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }
}

export function YouTubeEmbed({
  videoId,
  contentItemId,
  startSec,
  title,
}: {
  videoId: string;
  contentItemId: string;
  startSec?: number;
  title: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Continue-watching: watch pages are CDN-cached (identical HTML for every
  // viewer), so the resume position is resolved here instead of on the server.
  // No Clerk session cookie → skip the lookup entirely; anonymous viewers cost
  // zero API calls. The fetch races a short timeout so playback is never held
  // hostage to a slow lookup.
  const [resume, setResume] = useState<number | undefined>(startSec);
  const [resolved, setResolved] = useState(startSec !== undefined);

  useEffect(() => {
    if (resolved) return;
    if (!document.cookie.includes("__session")) {
      setResolved(true);
      return;
    }
    let done = false;
    const finish = (sec?: number) => {
      if (done) return;
      done = true;
      if (sec && sec > 10) setResume(sec);
      setResolved(true);
    };
    const timer = setTimeout(() => finish(), 1200);
    fetch(`/api/progress?contentItemId=${encodeURIComponent(contentItemId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { positionSec?: number } | null) => {
        clearTimeout(timer);
        finish(data?.positionSec);
      })
      .catch(() => {
        clearTimeout(timer);
        finish();
      });
    return () => {
      done = true;
      clearTimeout(timer);
    };
  }, [resolved, contentItemId]);

  useEffect(() => {
    if (!resolved) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    let player: { getCurrentTime?: () => number; getPlayerState?: () => number } | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const attach = () => {
      if (!window.YT || !iframeRef.current) return;
      player = new window.YT.Player(iframeRef.current, {
        events: {
          onStateChange: (event) => {
            if (event.data === STATE_ENDED) {
              report(contentItemId, Math.floor(player?.getCurrentTime?.() ?? 0), true);
            }
          },
        },
      });
      interval = setInterval(() => {
        if (player?.getPlayerState?.() === STATE_PLAYING) {
          report(contentItemId, Math.floor(player.getCurrentTime?.() ?? 0));
        }
      }, REPORT_INTERVAL_MS);
    };

    if (window.YT?.Player) {
      attach();
    } else {
      const prior = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prior?.();
        attach();
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      const position = Math.floor(player?.getCurrentTime?.() ?? 0);
      if (position > 0) report(contentItemId, position);
    };
  }, [resolved, contentItemId]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      {resolved && (
        <iframe
          ref={iframeRef}
          src={buildEmbedUrl(videoId, { startSec: resume })}
          title={title}
          className="h-full w-full"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}
    </div>
  );
}
