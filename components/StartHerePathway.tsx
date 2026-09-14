"use client";

// The Start Here pathway as a tabbed experience: pills, Back, and Next swap
// the topic in place — no page navigation. The URL follows via pushState so
// deep links and refresh land on the same question (the server page renders
// any /start/{slug} directly).

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StartHerePlaylistPlayer } from "@/components/StartHerePlaylistPlayer";
import { StartHereVideoCard } from "@/components/StartHereVideoCard";
import {
  isPlaceholderVideo,
  seriesDepthKey,
  topicDebates,
  topicPlaylists,
  videoDepthKey,
  type StartHereDepth,
  type StartHereTopic,
} from "@/lib/start-here";
import { trackStartHere } from "@/lib/start-here-tracking";

/** Remembered per viewer, on their own device. */
const MILK_ONLY_KEY = "start-here:milk-only";

/** How far the edge fade reaches into the strip, in px. */
const STRIP_FADE = 28;

/** Desktop nudge for the step strip — a mouse can't swipe. */
function StripArrow({
  direction,
  show,
  onClick,
}: {
  direction: -1 | 1;
  show: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      aria-label={direction < 0 ? "Earlier steps" : "Later steps"}
      // Hidden rather than removed, so the strip never changes width.
      className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-200 text-lg leading-none text-neutral-500 transition-opacity hover:border-amber-400 hover:text-amber-700 sm:flex dark:border-neutral-700 dark:hover:border-amber-600 dark:hover:text-amber-400 ${
        show ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <span aria-hidden>{direction < 0 ? "‹" : "›"}</span>
    </button>
  );
}

function TierBadge({ tier, note }: { tier: string; note: string }) {
  const essential = tier === "essential";
  return (
    <p className="flex flex-wrap items-center gap-3">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
          essential
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
        }`}
      >
        {essential ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="5" r="3" />
            <path d="M12 8v13M5 12H2a10 10 0 0 0 20 0h-3" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
          </svg>
        )}
        {essential ? "Essential" : "Open question"}
      </span>
      <span className="text-sm text-neutral-500">{note}</span>
    </p>
  );
}

export function StartHerePathway({
  topics,
  initialSlug,
  canEditDepth = false,
}: {
  topics: StartHereTopic[];
  initialSlug: string;
  /** Admins: every milk/meat badge becomes a switch. */
  canEditDepth?: boolean;
}) {
  const [slug, setSlug] = useState(initialSlug);

  // "Milk only" hides the heavier teaching for a viewer who wants the
  // foundations first. Read after mount: storage can be missing or refuse.
  const [milkOnly, setMilkOnly] = useState(false);
  useEffect(() => {
    try {
      setMilkOnly(localStorage.getItem(MILK_ONLY_KEY) === "1");
    } catch {
      // private window or blocked storage — default stays off
    }
  }, []);
  function chooseMilkOnly(value: boolean) {
    setMilkOnly(value);
    try {
      localStorage.setItem(MILK_ONLY_KEY, value ? "1" : "0");
    } catch {
      // not remembered; the choice still holds for this visit
    }
  }

  const index = Math.max(
    0,
    topics.findIndex((t) => t.slug === slug),
  );
  const topic = topics[index];
  const prevTopic = index > 0 ? topics[index - 1] : null;
  const nextTopic = index + 1 < topics.length ? topics[index + 1] : null;

  function goTo(nextSlug: string) {
    setSlug(nextSlug);
    window.history.pushState(null, "", `/start/${nextSlug}`);
    window.scrollTo({ top: 0 });
  }

  // The step strip: every step in one row that slides sideways. The current
  // step is kept in view, and the edges fade wherever there is more to see.
  const stripRef = useRef<HTMLDivElement>(null);
  const firstStripScroll = useRef(true);
  const [edges, setEdges] = useState({ left: false, right: false });

  function measureEdges() {
    const el = stripRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.left === left && e.right === right ? e : { left, right }));
  }

  function nudgeStrip(direction: -1 | 1) {
    const el = stripRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: "smooth" });
  }

  // Centre the current step inside the strip. The strip scrolls, never the
  // page — scrollIntoView would also move the page up or down, and goTo has
  // already sent the page to the top. The first placement is instant; after
  // that it glides.
  useEffect(() => {
    const el = stripRef.current;
    const pill = el?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!el || !pill) return;
    const target = pill.offsetLeft - (el.clientWidth - pill.offsetWidth) / 2;
    el.scrollTo({
      left: Math.max(0, target),
      behavior: firstStripScroll.current ? "auto" : "smooth",
    });
    firstStripScroll.current = false;
    measureEdges();
  }, [slug]);

  useEffect(() => {
    measureEdges();
    window.addEventListener("resize", measureEdges);
    return () => window.removeEventListener("resize", measureEdges);
  }, []);

  // Analytics: one step view per step per visit to the page — tabbing back
  // to a step already seen doesn't count it twice.
  const viewedSteps = useRef(new Set<string>());
  useEffect(() => {
    if (viewedSteps.current.has(topic.slug)) return;
    viewedSteps.current.add(topic.slug);
    trackStartHere({ type: "step_view", stepSlug: topic.slug });
  }, [topic.slug]);

  // Browser back/forward stays inside the tabs.
  useEffect(() => {
    function onPop() {
      const match = window.location.pathname.match(/\/start\/([^/]+)/);
      if (match && topics.some((t) => t.slug === match[1])) {
        setSlug(match[1]);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [topics]);

  const allVideos = [...topic.videos]
    .sort((a, b) => a.order - b.order)
    .filter((video) => !isPlaceholderVideo(video));
  const playlists = topicPlaylists(topic);
  const allDebates = topicDebates(topic).filter((video) => !isPlaceholderVideo(video));

  // Milk only keeps curated order and simply leaves meat out.
  const shown = (depth?: StartHereDepth) => !milkOnly || depth !== "meat";
  const videos = allVideos.filter((v) => shown(v.depth));
  // Series keep their curated order; "first" ones lead, the rest follow.
  const leadingSeries = playlists.filter((p) => p.position === "first" && shown(p.depth));
  const trailingSeries = playlists.filter((p) => p.position !== "first" && shown(p.depth));
  // The other side, heard in full — kept last, after the teaching.
  const debates = allDebates.filter((d) => shown(d.depth));

  const labelled = [...allVideos, ...playlists, ...allDebates].some((item) => item.depth);
  const hiddenCount =
    allVideos.length -
    videos.length +
    (playlists.length - leadingSeries.length - trailingSeries.length) +
    (allDebates.length - debates.length);

  const stripMask = `linear-gradient(to right, ${
    edges.left ? "transparent" : "black"
  }, black ${STRIP_FADE}px, black calc(100% - ${STRIP_FADE}px), ${
    edges.right ? "transparent" : "black"
  })`;

  return (
    <>
      {/* Progress strip — every step, slid sideways to choose one. Sticky just
          under the site header (h-14) so the page scrolls beneath it; the
          page background keeps text from showing through, and the negative
          margin carries that background across main's side padding. */}
      <nav
        aria-label="Pathway progress"
        className="sticky top-14 z-30 -mx-4 mb-5 flex items-center gap-1 border-b border-neutral-200/70 bg-[var(--background)] px-4 py-2 dark:border-neutral-800/70"
      >
        <StripArrow direction={-1} show={edges.left} onClick={() => nudgeStrip(-1)} />
        <div
          ref={stripRef}
          onScroll={measureEdges}
          className="relative flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 scrollbar-none [&::-webkit-scrollbar]:hidden"
          style={{ maskImage: stripMask, WebkitMaskImage: stripMask }}
        >
          {topics.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => goTo(t.slug)}
              aria-current={t.slug === topic.slug ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                t.slug === topic.slug
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                  : "bg-neutral-100 text-neutral-700 hover:bg-amber-100 hover:text-amber-900 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-amber-950 dark:hover:text-amber-300"
              }`}
            >
              {t.order}. {t.label}
            </button>
          ))}
        </div>
        <StripArrow direction={1} show={edges.right} onClick={() => nudgeStrip(1)} />
      </nav>

      {/* The panel */}
      <article
        key={topic.slug}
        className="rounded-3xl border border-neutral-200 bg-white p-6 sm:p-10 dark:border-neutral-800 dark:bg-neutral-900/60"
      >
        <TierBadge tier={topic.tier} note={topic.tier_note} />

        <h1 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {topic.question}
        </h1>

        <p className="mt-4 text-pretty text-base leading-8 text-neutral-700 dark:text-neutral-300">
          {topic.framing}
        </p>

        {/* Milk or meat — and a way to leave the meat for later. */}
        {labelled && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 dark:border-neutral-800">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              <span className="font-medium text-neutral-800 dark:text-neutral-200">Milk</span>{" "}
              is foundational teaching;{" "}
              <span className="font-medium text-neutral-800 dark:text-neutral-200">meat</span>{" "}
              is heavier (Hebrews 5:12–14).
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={milkOnly}
                onChange={(e) => chooseMilkOnly(e.target.checked)}
                className="h-4 w-4 accent-amber-600"
              />
              Milk only
            </label>
          </div>
        )}
        {milkOnly && hiddenCount > 0 && (
          <p className="mt-3 text-sm text-neutral-500">
            {hiddenCount} heavier {hiddenCount === 1 ? "item is" : "items are"} hidden —
            untick Milk only to see {hiddenCount === 1 ? "it" : "them"}.
          </p>
        )}

        <div className="mt-8 space-y-6">
          {/* Series asked to lead sit above the picks. */}
          {leadingSeries.map((series) => (
            <StartHerePlaylistPlayer
              key={series.youtube_playlist_id}
              playlist={series}
              depthEditable={canEditDepth}
              onPlay={() =>
                trackStartHere({
                  type: "video_play",
                  stepSlug: topic.slug,
                  itemKey: seriesDepthKey(series.youtube_playlist_id),
                })
              }
            />
          ))}
          {allVideos.length === 0 && playlists.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
              The teaching for this question is being hand-picked. Check back
              soon.
            </p>
          ) : (
            videos.map((video) => (
              <StartHereVideoCard
                key={`${video.youtube_id}-${video.order}`}
                video={video}
                depthEditable={canEditDepth}
                onPlay={() =>
                  trackStartHere({
                    type: "video_play",
                    stepSlug: topic.slug,
                    itemKey: videoDepthKey(video.youtube_id),
                  })
                }
              />
            ))
          )}
          {/* The rest follow the picks, in the order they were curated —
              each watched in order, one part into the next. */}
          {trailingSeries.map((series) => (
            <StartHerePlaylistPlayer
              key={series.youtube_playlist_id}
              playlist={series}
              depthEditable={canEditDepth}
              onPlay={() =>
                trackStartHere({
                  type: "video_play",
                  stepSlug: topic.slug,
                  itemKey: seriesDepthKey(series.youtube_playlist_id),
                })
              }
            />
          ))}
        </div>

        {/* Debates: the objections a new believer will meet, and how they are
            answered — so no one is caught flat-footed. Set apart from the
            teaching, in the sky tone the page already uses for open
            questions, because this is where the other side gets its say. */}
        {debates.length > 0 && (
          <section
            aria-labelledby={`debates-${topic.slug}`}
            className="mt-10 rounded-2xl border border-sky-200 bg-sky-50/60 p-5 sm:p-6 dark:border-sky-900/60 dark:bg-sky-950/20"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-400">
              Hear the other side
            </p>
            <h2
              id={`debates-${topic.slug}`}
              className="mt-1 text-xl font-semibold tracking-tight"
            >
              See the counter-arguments
            </h2>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              Sooner or later someone will bring these objections to you. Watch
              how they are made and how they are answered, so you are not caught
              flat-footed — and can give a reason for the hope that is in you,
              with gentleness and respect (1 Peter 3:15).
            </p>
            <div className="mt-5 space-y-6">
              {debates.map((debate) => (
                <StartHereVideoCard
                  key={`${debate.youtube_id}-${debate.order}`}
                  video={debate}
                  depthEditable={canEditDepth}
                  onPlay={() =>
                    trackStartHere({
                      type: "video_play",
                      stepSlug: topic.slug,
                      itemKey: videoDepthKey(debate.youtube_id),
                    })
                  }
                />
              ))}
            </div>
          </section>
        )}

        <hr className="mt-10 border-neutral-200 dark:border-neutral-800" />

        <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <p className="max-w-xs text-xs leading-5 text-neutral-400">
            Videos are hosted on YouTube and belong to their creators. CF is
            not affiliated with or endorsed by them.
          </p>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {prevTopic && (
              <button
                type="button"
                onClick={() => goTo(prevTopic.slug)}
                className="group inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-base font-medium text-neutral-500 hover:bg-amber-50 hover:text-amber-900 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
              >
                <span aria-hidden className="transition-transform group-hover:-translate-x-1">
                  ←
                </span>
                Back
              </button>
            )}
            {nextTopic ? (
              <button
                type="button"
                onClick={() => goTo(nextTopic.slug)}
                className="group inline-flex items-center gap-2 rounded-2xl border border-neutral-300 px-6 py-3 text-base font-medium hover:border-amber-500 hover:bg-amber-50 dark:border-neutral-700 dark:hover:border-amber-600 dark:hover:bg-amber-950/40"
              >
                Next: {nextTopic.question.replace(/\?$/, "").toLowerCase()}
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </button>
            ) : (
              <Link
                href="/map"
                className="group inline-flex items-center gap-2 rounded-2xl border border-neutral-300 px-6 py-3 text-base font-medium hover:border-amber-500 hover:bg-amber-50 dark:border-neutral-700 dark:hover:border-amber-600 dark:hover:bg-amber-950/40"
              >
                Next: explore the map
                <span aria-hidden className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            )}
          </div>
        </div>
      </article>
    </>
  );
}
