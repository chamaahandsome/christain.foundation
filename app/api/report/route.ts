import { auth } from "@clerk/nextjs/server";
import { currentUser } from "@clerk/nextjs/server";
import { ReviewCaseStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateClaim } from "@/lib/doctrine";

const BodySchema = z.object({
  contentItemId: z.string().min(1),
  claim: z.string().min(1).max(6000),
});

// Open a doctrine review case on published teaching (concept §5.4).
// Sign-in required — a report puts a claim on the record, not an anonymous
// flag. Safety/abuse moderation is a separate concern (and queue).
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const check = validateClaim(parsed.data.claim);
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 422 });
  }

  const item = await db.contentItem.findUnique({
    where: { id: parsed.data.contentItemId },
    select: { id: true, channelId: true, channel: { select: { ownerId: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "Content not found." }, { status: 404 });
  }
  if (item.channel.ownerId === userId) {
    return NextResponse.json(
      { error: "You can't open a case against your own channel." },
      { status: 400 },
    );
  }

  // One open case per reporter per content item — refinements go in the
  // existing case, not a pile of duplicates.
  const existing = await db.doctrineReviewCase.findFirst({
    where: {
      contentItemId: item.id,
      openedById: userId,
      status: { in: [ReviewCaseStatus.OPEN, ReviewCaseStatus.IN_REVIEW] },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an open report on this teaching. It's in the review queue." },
      { status: 409 },
    );
  }

  // Ensure the reporter's User row exists (webhook may not be configured yet).
  const clerkUser = await currentUser();
  await db.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email:
        clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@placeholder.invalid`,
      name: clerkUser?.fullName ?? null,
    },
    update: {},
  });

  const reviewCase = await db.doctrineReviewCase.create({
    data: {
      channelId: item.channelId,
      contentItemId: item.id,
      claim: parsed.data.claim.trim(),
      openedById: userId,
    },
  });

  return NextResponse.json({ case: { id: reviewCase.id, status: reviewCase.status } });
}
