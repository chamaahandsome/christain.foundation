import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { slugify, validateCampaignDraft } from "@/lib/campaigns";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

// Campaign authoring — owner or library:manager. Drafts are free to create;
// launching (sibling route) is where the §9.4 payout gate applies.

const CreateSchema = z.object({
  channelId: z.string().min(1),
  title: z.string().min(1).max(200),
  category: z.enum(["MISSION", "CREATIVE"]),
  shortDescription: z.string().min(1).max(2000),
  story: z.string().max(50_000).optional(),
  goalCents: z.number().int(),
  endsAt: z.string().datetime().optional(),
  deliverable: z.string().max(2000).optional(),
  deliveryTimeline: z.string().max(200).optional(),
  coverImageUrl: z.string().url().max(500).optional(),
  videoUrl: z.string().url().max(500).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const access = await getChannelAccess(
    userId,
    body.channelId,
    FEATURES.CAMPAIGNS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  if (!access.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  const invalid = validateCampaignDraft({
    title: body.title,
    category: body.category,
    shortDescription: body.shortDescription,
    goalCents: body.goalCents,
    endsAt,
    deliverable: body.deliverable,
  });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  // Unique slug: title-derived, numeric suffix on collision.
  const base = slugify(body.title) || "campaign";
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const clash = await db.campaign.findUnique({ where: { slug }, select: { id: true } });
    if (!clash) break;
    slug = `${base}-${i}`;
  }

  const campaign = await db.campaign.create({
    data: {
      channelId: body.channelId,
      title: body.title.trim(),
      slug,
      category: body.category,
      shortDescription: body.shortDescription.trim(),
      story: body.story?.trim() ? sanitizeRichHtml(body.story.trim()) : null,
      goalCents: body.goalCents,
      endsAt,
      deliverable: body.deliverable?.trim() || null,
      deliveryTimeline: body.deliveryTimeline?.trim() || null,
      coverImageUrl: body.coverImageUrl ?? null,
      videoUrl: body.videoUrl ?? null,
    },
  });
  return NextResponse.json({ campaign });
}
