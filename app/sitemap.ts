import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { startHereTopics } from "@/lib/start-here";

// Sharing/SEO (PLAN §8): the map is highly linkable — every question,
// channel, and watch page belongs in the sitemap.

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.thechristian.foundation";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statics: MetadataRoute.Sitemap = [
    "",
    "/start",
    "/map",
    "/explore",
    "/search",
    "/apply",
  ].map((path) => ({ url: `${BASE}${path}`, changeFrequency: "daily" as const }));

  const startTopics: MetadataRoute.Sitemap = startHereTopics().map((topic) => ({
    url: `${BASE}/start/${topic.slug}`,
    changeFrequency: "weekly" as const,
  }));

  const [questions, channels, items] = await Promise.all([
    db.question.findMany({ select: { slug: true } }).catch(() => []),
    db.channel
      .findMany({ where: { status: "APPROVED" }, select: { handle: true } })
      .catch(() => []),
    db.contentItem
      .findMany({
        where: {
          visibility: "PUBLIC",
          unavailableAt: null,
          youtubeVideoId: { not: null },
          channel: { status: "APPROVED" },
        },
        orderBy: { publishedAt: "desc" },
        take: 2000,
        select: { id: true, updatedAt: true },
      })
      .catch(() => []),
  ]);

  return [
    ...statics,
    ...startTopics,
    ...questions.map((q) => ({
      url: `${BASE}/map/${q.slug}`,
      changeFrequency: "weekly" as const,
    })),
    ...channels.map((c) => ({
      url: `${BASE}/@${c.handle}`,
      changeFrequency: "daily" as const,
    })),
    ...items.map((item) => ({
      url: `${BASE}/watch/${item.id}`,
      lastModified: item.updatedAt,
    })),
  ];
}
