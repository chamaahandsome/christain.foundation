// Generates lib/showcase.json — real, current videos from well-known
// sound-teaching YouTube channels, used as the homepage marquee until the
// platform's own library takes over (DB content always wins at runtime).
//
//   node --env-file=.env ./node_modules/.bin/tsx scripts/build-showcase.ts
//
// NOTE: these channels are a visual placeholder for development. They are not
// affiliated with the platform. Before public launch the marquee should be
// fed by founding-cohort content (which happens automatically once imported).

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  fetchVideoDetails,
  isIngestable,
  listUploads,
  resolveChannel,
} from "../lib/youtube-api";

const SHOWCASE_CHANNELS = [
  "@Ligonier",
  "@desiringGod",
  "@gracetoyou",
  "@MikeWinger",
  "@ReasonableFaithOrg",
  "@GettyMusicWorship",
  "@CityAlight",
  "@shaneandshane",
  "@HeartCryMissionary",
  "@thegospelcoalition",
  "@godlogicapologetics",
  "@InspiringPhilosophy",
  "@DrJamesTour",
  "@ExpeditionBible",
  "@TruthUnites",
];

const PER_CHANNEL = 3;
const MIN_DURATION_SEC = 240; // skip shorts/clips — show real teaching

interface ShowcaseItem {
  videoId: string;
  title: string;
  channel: string;
}

async function main() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");

  const items: ShowcaseItem[] = [];

  for (const handle of SHOWCASE_CHANNELS) {
    try {
      const channel = await resolveChannel(handle, key);
      if (!channel?.uploadsPlaylistId) {
        console.warn(`skip ${handle}: not resolved`);
        continue;
      }
      const ids = await listUploads(channel.uploadsPlaylistId, key, { maxPages: 1 });
      const details = await fetchVideoDetails(ids, key);
      const picked = details
        .filter(
          (video) =>
            isIngestable(video) &&
            (video.durationSec ?? 0) >= MIN_DURATION_SEC,
        )
        .slice(0, PER_CHANNEL)
        .map((video) => ({
          videoId: video.videoId,
          title: video.title,
          channel: channel.title,
        }));
      items.push(...picked);
      console.log(`${channel.title}: ${picked.length} videos`);
    } catch (err) {
      console.warn(`skip ${handle}: ${(err as Error).message}`);
    }
  }

  if (items.length < 8) {
    throw new Error(`Only ${items.length} showcase items collected — aborting.`);
  }

  // Interleave channels so no row is dominated by one creator.
  items.sort((a, b) => (a.videoId > b.videoId ? 1 : -1));

  const outPath = join(__dirname, "..", "lib", "showcase.json");
  writeFileSync(outPath, JSON.stringify(items, null, 2) + "\n");
  console.log(`Wrote ${items.length} items to ${outPath}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
