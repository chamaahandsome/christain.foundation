import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  RAIL_ORDER,
  RAIL_SELECT,
  pageWithCursor,
  parseRailQuery,
  railWhere,
} from "@/lib/watch-rail";

export const dynamic = "force-dynamic";

// The next page of a channel's library for the watch-page rail. Public and
// anonymous — these are the same embeds the watch page already shows to
// everyone — so the CDN may keep a page as long as the watch page itself
// (revalidate = 300).
export async function GET(req: Request) {
  const query = parseRailQuery(new URL(req.url).searchParams);
  if ("error" in query) {
    return NextResponse.json({ error: query.error }, { status: 400 });
  }

  const rows = await db.contentItem.findMany({
    where: railWhere(query.channelId, query.excludeIds),
    orderBy: RAIL_ORDER,
    take: query.take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: RAIL_SELECT,
  });

  return NextResponse.json(pageWithCursor(rows, query.take), {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
