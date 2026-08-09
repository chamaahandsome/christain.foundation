// Start Here content gate.
//   npx tsx scripts/check-start-here.ts            → strict validation (pre-launch gate)
//   npx tsx scripts/check-start-here.ts --videos   → also check every youtube_id
//                                                    is still alive (weekly job)
//
// Liveness check hits the thumbnail endpoint: deleted/private videos stop
// serving hqdefault.jpg. Catches dead embeds before a user does.

import rawData from "../content/start-here.json";
import {
  hasPlaceholders,
  isPlaceholderVideo,
  validateStartHere,
  type StartHereData,
} from "../lib/start-here";

const data = rawData as StartHereData;

async function checkVideosAlive(): Promise<string[]> {
  const dead: string[] = [];
  for (const topic of data.topics) {
    for (const video of topic.videos) {
      if (isPlaceholderVideo(video)) continue;
      const url = `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`;
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (!res.ok) {
          dead.push(`${topic.slug}: ${video.youtube_id} "${video.title}" → HTTP ${res.status}`);
        }
      } catch (err) {
        dead.push(`${topic.slug}: ${video.youtube_id} → ${(err as Error).message}`);
      }
    }
  }
  return dead;
}

async function main() {
  const checkVideos = process.argv.includes("--videos");

  const errors = validateStartHere(data, { strict: true });
  if (errors.length > 0) {
    console.error(`Start Here content FAILS strict validation (${errors.length} errors):`);
    for (const error of errors) console.error(`  - ${error}`);
    if (hasPlaceholders(data)) {
      console.error("\n(Curation is incomplete — REPLACE placeholders remain.)");
    }
    process.exit(1);
  }
  console.log("Start Here content: strict validation OK.");

  if (checkVideos) {
    const dead = await checkVideosAlive();
    if (dead.length > 0) {
      console.error(`\nDead videos (${dead.length}):`);
      for (const line of dead) console.error(`  - ${line}`);
      process.exit(1);
    }
    console.log("All curated videos are alive.");
  }
}

main();
