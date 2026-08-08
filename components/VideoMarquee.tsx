// Scrolling rows of video cards — the homepage's moving shop window.
// Server component, pure CSS animation (keyframes in globals.css), edge-faded,
// pauses on hover, honors prefers-reduced-motion.

import { thumbnailUrl } from "@/lib/youtube";

export interface MarqueeItem {
  videoId: string;
  title: string;
  channel: string;
  /** Internal link (/watch/…). Omit to render a non-clickable card —
   * the marquee must never lead people off the site. */
  href?: string;
}

function Card({ item }: { item: MarqueeItem }) {
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
      <span className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
        <span className="block truncate text-sm font-medium text-white">
          {item.title}
        </span>
        <span className="block text-xs text-neutral-300">{item.channel}</span>
      </span>
    </>
  );

  const className =
    "group relative block w-64 shrink-0 overflow-hidden rounded-xl bg-neutral-900 shadow-md";

  return item.href ? (
    <a href={item.href} className={className}>
      {content}
    </a>
  ) : (
    <div className={className} aria-label={`${item.title} — ${item.channel}`}>
      {content}
    </div>
  );
}

function Row({
  items,
  reverse,
  duration,
}: {
  items: MarqueeItem[];
  reverse?: boolean;
  duration: number;
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
          <Card key={`${item.videoId}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

export function VideoMarquee({ items }: { items: MarqueeItem[] }) {
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
        />
      ))}
    </div>
  );
}
