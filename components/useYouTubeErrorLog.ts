"use client";

// Attaches the YouTube iframe API to an embedded player purely to observe
// onError events: logs the cause locally and to /api/log, and reports fatal
// codes (deleted / embed-disabled) so the card can swap to a link-out.
// The iframe must include enablejsapi=1.

import { useEffect, type RefObject } from "react";
import {
  describeYouTubeError,
  isFatalYouTubeError,
} from "@/lib/youtube-embed-errors";

export function useYouTubeErrorLog(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  videoId: string,
  opts: { source: string; onFatal?: (code: number) => void } = { source: "embed" },
) {
  const { source, onFatal } = opts;

  useEffect(() => {
    let cancelled = false;

    const attach = () => {
      if (cancelled || !window.YT?.Player || !iframeRef.current) return;
      new window.YT.Player(iframeRef.current, {
        events: {
          onError: (event: { data: number }) => {
            const code = event.data;
            const message = describeYouTubeError(code);
            console.warn(`[youtube-embed] ${videoId} error ${code}: ${message}`);
            const body = JSON.stringify({ source, videoId, code, message });
            if (
              !navigator.sendBeacon?.(
                "/api/log",
                new Blob([body], { type: "application/json" }),
              )
            ) {
              fetch("/api/log", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body,
                keepalive: true,
              }).catch(() => {});
            }
            if (isFatalYouTubeError(code)) onFatal?.(code);
          },
        },
      });
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
      cancelled = true;
    };
  }, [iframeRef, videoId, source, onFatal]);
}
