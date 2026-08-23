// Site-wide topical search (PLAN §3: full-text across CF metadata +
// transcript-derived text). Teaching uses MySQL FULLTEXT with relevance
// ranking and falls back to substring matching when natural-language mode
// has nothing to say (short words, partial terms). The map, channels, and
// series are small tables — substring matching is right for them.

import { Visibility } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Pure (tested): make user input safe for MySQL natural-language MATCH.
 * Strips boolean-mode operators and quotes so nobody can smuggle syntax,
 * collapses whitespace, caps length.
 */
export function sanitizeFulltextQuery(input: string): string {
  return input
    .replace(/["'()<>~*+@-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

const PUBLIC_ITEM = {
  visibility: Visibility.PUBLIC,
  unavailableAt: null,
  youtubeVideoId: { not: null },
  channel: { status: "APPROVED" as const },
};

const ITEM_SELECT = {
  id: true,
  title: true,
  youtubeVideoId: true,
  durationSec: true,
  format: true,
  channel: { select: { name: true, handle: true } },
} as const;

export type SearchItem = {
  id: string;
  title: string;
  youtubeVideoId: string | null;
  durationSec: number | null;
  format: string;
  channel: { name: string; handle: string };
};

async function searchTeaching(query: string, take: number): Promise<SearchItem[]> {
  const sanitized = sanitizeFulltextQuery(query);

  // Relevance-ranked FULLTEXT first…
  if (sanitized) {
    try {
      const hits = await db.contentItem.findMany({
        where: {
          ...PUBLIC_ITEM,
          title: { search: sanitized },
          description: { search: sanitized },
          searchText: { search: sanitized },
        },
        orderBy: {
          _relevance: {
            fields: ["title", "description", "searchText"],
            search: sanitized,
            sort: "desc",
          },
        },
        take,
        select: ITEM_SELECT,
      });
      if (hits.length > 0) return hits;
    } catch {
      // Index missing (fresh env) — fall through to substring matching.
    }
  }

  // …then substring fallback for what natural-language mode ignores.
  return db.contentItem.findMany({
    where: {
      ...PUBLIC_ITEM,
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { searchText: { contains: query } },
      ],
    },
    orderBy: { publishedAt: "desc" },
    take,
    select: ITEM_SELECT,
  });
}

export interface SearchResults {
  questions: {
    slug: string;
    title: string;
    tier: string;
    framing: string;
  }[];
  channels: {
    handle: string;
    name: string;
    kind: string;
    followers: number;
  }[];
  series: {
    id: string;
    title: string;
    itemCount: number;
    channel: { name: string; handle: string };
  }[];
  items: SearchItem[];
}

/** Search everything CF knows: the doctrinal map, channels, series, and the
 * teaching library. Groups run in parallel; each is independently bounded. */
export async function searchAll(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return { questions: [], channels: [], series: [], items: [] };

  const [questions, positionHits, topicHits, channels, series, items] =
    await Promise.all([
      db.question.findMany({
        where: {
          OR: [{ title: { contains: q } }, { framing: { contains: q } }],
        },
        take: 6,
        select: { slug: true, title: true, tier: true, framing: true },
      }),
      // A position match surfaces its question — "credobaptism" should land
      // you on the baptism question, both sides visible.
      db.position.findMany({
        where: { OR: [{ name: { contains: q } }, { summary: { contains: q } }] },
        take: 6,
        select: {
          question: {
            select: { slug: true, title: true, tier: true, framing: true },
          },
        },
      }),
      db.topic.findMany({
        where: { name: { contains: q } },
        take: 3,
        select: {
          questions: {
            take: 4,
            select: { slug: true, title: true, tier: true, framing: true },
          },
        },
      }),
      db.channel.findMany({
        where: {
          status: "APPROVED",
          OR: [
            { name: { contains: q } },
            { handle: { contains: q } },
            { bio: { contains: q } },
          ],
        },
        take: 6,
        select: {
          handle: true,
          name: true,
          kind: true,
          _count: { select: { followers: true } },
        },
      }),
      db.series.findMany({
        where: {
          title: { contains: q },
          channel: { status: "APPROVED" },
          contentItems: { some: {} },
        },
        take: 6,
        select: {
          id: true,
          title: true,
          channel: { select: { name: true, handle: true } },
          _count: { select: { contentItems: true } },
        },
      }),
      searchTeaching(q, 40),
    ]);

  // Merge question hits (direct, via positions, via topics) without dupes.
  const seenSlugs = new Set<string>();
  const mergedQuestions: SearchResults["questions"] = [];
  for (const question of [
    ...questions,
    ...positionHits.map((p) => p.question),
    ...topicHits.flatMap((t) => t.questions),
  ]) {
    if (seenSlugs.has(question.slug)) continue;
    seenSlugs.add(question.slug);
    mergedQuestions.push(question);
  }

  return {
    questions: mergedQuestions.slice(0, 6),
    channels: channels.map((c) => ({
      handle: c.handle,
      name: c.name,
      kind: c.kind,
      followers: c._count.followers,
    })),
    series: series.map((s) => ({
      id: s.id,
      title: s.title,
      itemCount: s._count.contentItems,
      channel: s.channel,
    })),
    items,
  };
}
