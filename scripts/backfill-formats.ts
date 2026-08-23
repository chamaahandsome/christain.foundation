// One-off/maintenance backfill: classify already-imported videos the way
// YouTube presents them (STANDARD / SHORT / LIVE) and mirror each channel's
// playlists as series. Idempotent — safe to re-run any time.
//
//   node --env-file=.env ./node_modules/.bin/tsx scripts/backfill-formats.ts

import { PrismaClient } from "@prisma/client";
import { syncPlaylistsAsSeries } from "../lib/ingest";
import {
  classifyFormat,
  fetchVideoDetails,
  resolveChannel,
} from "../lib/youtube-api";

const db = new PrismaClient();

async function main() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_API_KEY is not set.");

  const channels = await db.channel.findMany({
    where: { youtubeChannelId: { not: null } },
    select: { id: true, handle: true, youtubeChannelId: true },
  });

  for (const channel of channels) {
    const items = await db.contentItem.findMany({
      where: { channelId: channel.id, youtubeVideoId: { not: null } },
      select: { id: true, youtubeVideoId: true, format: true },
    });
    console.log(`@${channel.handle}: ${items.length} items`);
    if (items.length > 0) {
      const details = await fetchVideoDetails(
        items.map((item) => item.youtubeVideoId!),
        apiKey,
      );
      const byVideoId = new Map(details.map((v) => [v.videoId, v]));

      let reclassified = 0;
      const counts: Record<string, number> = {};
      for (const item of items) {
        const video = byVideoId.get(item.youtubeVideoId!);
        if (!video) continue; // deleted/private on YouTube — leave as-is
        const format = classifyFormat(video);
        counts[format] = (counts[format] ?? 0) + 1;
        if (format !== item.format) {
          await db.contentItem.update({
            where: { id: item.id },
            data: { format },
          });
          reclassified += 1;
        }
      }
      console.log(
        `  formats: ${Object.entries(counts)
          .map(([k, v]) => `${k.toLowerCase()} ${v}`)
          .join(", ")} (${reclassified} rows updated)`,
      );
    }

    const info = await resolveChannel(channel.youtubeChannelId!, apiKey);
    if (info) {
      const synced = await syncPlaylistsAsSeries(channel.id, info.channelId, apiKey);
      console.log(`  playlists synced as series: ${synced}`);
    } else {
      console.log("  could not resolve YouTube channel — playlists skipped");
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
