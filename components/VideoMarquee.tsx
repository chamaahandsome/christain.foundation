"use client";

// Scrolling rows of video cards — the homepage's moving shop window.
// Pure CSS animation (keyframes in globals.css), edge-faded, pauses on hover,
// honors prefers-reduced-motion.
//
// Click behavior: cards with an internal href navigate (platform /watch
// pages); showcase cards open an on-page lightbox with the embedded player —
// nobody leaves the site.

import { useEffect, useRef, useState } from "react";
import { useYouTubeErrorLog } from "@/components/useYouTubeErrorLog";
import { buildEmbedUrl, thumbnailUrl } from "@/lib/youtube";

export interface MarqueeItem {
  videoId: string;
  title: string;
  channel: string;
  /** Internal link (/watch/…). Omit to play in the on-page lightbox. */
  href?: string;
}

function Card({
  item,
  onSelect,
}: {
  item: MarqueeItem;
  onSelect: (item: MarqueeItem) => void;
}) {
  const content = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbnailUrl(item.videoId, "mqdefault")}
        alt=""
        loading="lazy"
        className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent" />
      {/* play glyph on hover */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-neutral-900 shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5.14v13.72L19 12 8 5.14Z" />
          </svg>
        </span>
      </span>
      <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
        <span className="block truncate text-sm font-medium text-white">
          {item.title}
        </span>
        <span className="block text-xs text-neutral-300">{item.channel}</span>
      </span>
    </>
  );

  const className =
    "group relative block w-64 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-neutral-900 shadow-md";

  return item.href ? (
    <a href={item.href} className={className}>
      {content}
    </a>
  ) : (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`${className} text-left`}
      aria-label={`Play: ${item.title} — ${item.channel}`}
    >
      {content}
    </button>
  );
}

function Lightbox({
  item,
  onClose,
}: {
  item: MarqueeItem;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  useYouTubeErrorLog(iframeRef, item.videoId, { source: "home-lightbox" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      <div
        className="w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between gap-4">
          <p className="truncate text-sm text-neutral-200">
            <span className="font-medium text-white">{item.title}</span>
            <span className="ml-2 text-neutral-400">{item.channel}</span>
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black shadow-2xl">
          <iframe
            ref={iframeRef}
            src={`${buildEmbedUrl(item.videoId, { autoplay: true })}&origin=${encodeURIComponent(window.location.origin)}`}
            title={item.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <p className="mt-2 text-right text-xs text-neutral-400">
          Trouble playing?{" "}
          <a
            href={`https://www.youtube.com/watch?v=${item.videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-neutral-200"
          >
            Watch on YouTube ↗
          </a>
        </p>
      </div>
    </div>
  );
}

function Row({
  items,
  reverse,
  duration,
  onSelect,
}: {
  items: MarqueeItem[];
  reverse?: boolean;
  duration: number;
  onSelect: (item: MarqueeItem) => void;
}) {
  return (
    <div
      className="marquee-row overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
      }}
    >
      <div
        className={`marquee-track flex w-max gap-4 pr-4 ${reverse ? "marquee-track--reverse" : ""}`}
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        {[...items, ...items].map((item, i) => (
          <Card key={`${item.videoId}-${i}`} item={item} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

export function VideoMarquee({ items }: { items: MarqueeItem[] }) {
  const [playing, setPlaying] = useState<MarqueeItem | null>(null);

  if (items.length < 4) return null;

  // Split into up to three rows with alternating directions and speeds.
  const rowCount = items.length >= 12 ? 3 : 2;
  const rows: MarqueeItem[][] = Array.from({ length: rowCount }, () => []);
  items.forEach((item, i) => rows[i % rowCount].push(item));

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <Row
          key={i}
          items={row}
          reverse={i % 2 === 1}
          duration={55 + i * 12}
          onSelect={setPlaying}
        />
      ))}
      {playing && <Lightbox item={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}
