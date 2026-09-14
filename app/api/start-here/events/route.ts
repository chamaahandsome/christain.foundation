import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { startHereTopics } from "@/lib/start-here";
import { StartHereEventSchema, eventProblem } from "@/lib/start-here-analytics";
import { recordStartHereEvent } from "@/lib/start-here-analytics-db";

// Start Here usage events — step views and plays, sent by the page with
// sendBeacon. Public on purpose: most people using Start Here aren't signed
// in. The page never waits on this, so a failure here costs a data point,
// never the visitor's experience.

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  // A real visitor sends a handful per step; this only stops a flood.
  if (!rateLimit("start-here-events", ip, { limit: 120, windowMs: 60_000 }).allowed) {
    return new NextResponse(null, { status: 429 });
  }

  // sendBeacon posts a Blob, so read the text rather than trusting the header.
  let body: unknown;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const parsed = StartHereEventSchema.safeParse(body);
  if (!parsed.success) {
    return new NextResponse(null, { status: 400 });
  }
  // Only steps and items actually on the pathway are counted.
  if (eventProblem(parsed.data, { topics: startHereTopics() })) {
    return new NextResponse(null, { status: 422 });
  }

  let userId: string | null = null;
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    userId = (await auth().catch(() => null))?.userId ?? null;
  }

  try {
    await recordStartHereEvent({ ...parsed.data, userId });
  } catch (err) {
    // Most likely the events table isn't there yet (`prisma db push`).
    console.error("start-here events: record failed", err);
  }
  return new NextResponse(null, { status: 204 });
}
