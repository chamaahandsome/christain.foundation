import Link from "next/link";
import { formatRuntime } from "@/lib/watch-rail";
import { thumbnailUrl } from "@/lib/youtube";

// A library item as a card: YouTube thumbnail, title, who taught it. The
// thumbnail comes from YouTube's own CDN — we embed the player and link the
// art, we never proxy either (PLAN §2, Layer 1).

export function VideoCard({
  item,
  className = "",
}: {
  className?: string;
  item: {
    id: string;
    title: string;
    youtubeVideoId: string | null;
    durationSec?: number | null;
    publishedAt?: Date | null;
    channel: { name: string; handle: string };
  };
}) {
  const length = formatRuntime(item.durationSec);
  return (
    <Link href={`/watch/${item.id}`} className={`group block ${className}`}>
      <div className="relative overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
        {item.youtubeVideoId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl(item.youtubeVideoId, "mqdefault")}
            alt=""
            loading="lazy"
            className="aspect-video w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="aspect-video w-full bg-linear-to-br from-amber-500 to-orange-600" />
        )}
        {length && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
            {length}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-sm font-medium group-hover:underline">
        {item.title}
      </p>
      <p className="text-xs text-neutral-500">{item.channel.name}</p>
    </Link>
  );
}
