// Diagnostic: verifies YOUTUBE_API_KEY against the live API using the same
// client code the ingestion path uses.
//   node --env-file=.env ./node_modules/.bin/tsx scripts/verify-youtube.ts [@handle]

import {
  fetchVideoDetails,
  isIngestable,
  listUploads,
  resolveChannel,
} from "../lib/youtube-api";

async function main() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");

  const handle = process.argv[2] ?? "@Ligonier";
  const channel = await resolveChannel(handle, key);
  if (!channel) {
    console.error(`Could not resolve channel ${handle}`);
    process.exit(1);
  }
  console.log(`channel: ${channel.title}`);
  console.log(`uploads playlist: ${channel.uploadsPlaylistId}`);

  if (channel.uploadsPlaylistId) {
    const ids = await listUploads(channel.uploadsPlaylistId, key, { maxPages: 1 });
    console.log(`videos found (first page): ${ids.length}`);
    const details = await fetchVideoDetails(ids.slice(0, 3), key);
    for (const video of details) {
      console.log(
        `- ${video.title.slice(0, 60)} | ${video.durationSec}s | ingestable: ${isIngestable(video)}`,
      );
    }
  }
  console.log("OK — key works.");
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
