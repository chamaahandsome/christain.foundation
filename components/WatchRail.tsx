"use client";

// The watch page's "up next" column, YouTube-style: the rest of the channel's
// library, newest first. The first page arrives server-rendered with the
// page; more load as the list nears its end — inside the rail's own scroll
// area on desktop (the player stays in view), down the page on a phone.
// Filter, order and paging rules live in lib/watch-rail.

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { formatRuntime, type RailItem } from "@/lib/watch-rail";
import { isValidYouTubeId, thumbnailUrl } from "@/lib/youtube";

export function WatchRail({
  channelId,
  channelName,
  excludeId,
  initialItems,
  initialCursor,
  scroll = false,
}: {
  channelId: string;
  channelName: string;
  /** the video playing now — never offered as "up next" */
  excludeId: string;
  initialItems: RailItem[];
  initialCursor: string | null;
  /** desktop: the list scrolls on its own inside a height-capped column */
  scroll?: boolean;
}) {
  const headingId = useId();
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);

  const loadMore = useCallback(async () => {
    if (!cursor || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({ channelId, cursor, exclude: excludeId });
      const res = await fetch(`/api/channel-videos?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: RailItem[]; nextCursor: string | null };
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...data.items.filter((i) => !seen.has(i.id))];
      });
      setCursor(data.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [channelId, cursor, excludeId]);

  // Watch the end of the list. A fresh observer after every page reports
  // straight away if the end is still in reach, so a tall screen keeps
  // filling without a scroll. A hidden copy (the other breakpoint's rail)
  // never intersects, so only the visible rail ever fetches.
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !cursor || failed) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      {
        root: scroll ? scrollerRef.current : null,
        rootMargin: "0px 0px 800px 0px",
      },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, failed, loadMore, scroll]);

  return (
    <section
      aria-labelledby={headingId}
      className={scroll ? "flex min-h-0 flex-1 flex-col" : undefined}
    >
      <h2
        id={headingId}
        className="mb-3 shrink-0 text-sm font-semibold uppercase tracking-wide text-neutral-500"
      >
        More from {channelName}
      </h2>

      <div
        ref={scrollerRef}
        className={
          scroll
            ? "-mr-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-3 [scrollbar-width:thin]"
            : undefined
        }
      >
        {items.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Nothing else from {channelName} yet.
          </p>
        ) : (
          <ul className="space-y-3" aria-busy={loading}>
            {items.map((video) => {
              const runtime = formatRuntime(video.durationSec);
              return (
                <li key={video.id}>
                  <Link
                    href={`/watch/${video.id}`}
                    className="group flex items-start gap-3 rounded-lg"
                  >
                    <span className="relative block w-40 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                      {video.youtubeVideoId && isValidYouTubeId(video.youtubeVideoId) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbnailUrl(video.youtubeVideoId, "mqdefault")}
                          alt=""
                          loading="lazy"
                          className="aspect-video w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <span className="block aspect-video w-full" />
                      )}
                      {runtime && (
                        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-px text-[11px] font-medium text-white">
                          {runtime}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 pt-0.5">
                      <span className="line-clamp-2 text-sm font-medium leading-snug group-hover:underline">
                        {video.title}
                      </span>
                      <span className="mt-1 block truncate text-xs text-neutral-500">
                        {channelName}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {cursor && !failed && <li ref={sentinelRef} aria-hidden className="h-px" />}
          </ul>
        )}

        {loading && (
          <div className="mt-3 space-y-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex animate-pulse gap-3">
                <div className="aspect-video w-40 shrink-0 rounded-lg bg-neutral-100 dark:bg-neutral-800" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 rounded bg-neutral-100 dark:bg-neutral-800" />
                  <div className="h-3 w-2/3 rounded bg-neutral-100 dark:bg-neutral-800" />
                </div>
              </div>
            ))}
          </div>
        )}

        {failed && (
          <p className="mt-3 text-sm text-neutral-500">
            Couldn&apos;t load more.{" "}
            <button
              onClick={() => void loadMore()}
              className="text-amber-700 hover:underline dark:text-amber-400"
            >
              Try again
            </button>
          </p>
        )}
      </div>
    </section>
  );
}
