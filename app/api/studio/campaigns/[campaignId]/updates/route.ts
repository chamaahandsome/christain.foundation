import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { NotificationType, TransactionStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { sanitizeRichHtml } from "@/lib/sanitize-html";

// Campaign updates — the creator's progress reports. notifyBackers pings
// every distinct successful backer.

const CreateSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20_000),
  backersOnly: z.boolean().default(false),
  notifyBackers: z.boolean().default(true),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { campaignId } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, channelId: true, title: true, slug: true },
  });
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  const access = await getChannelAccess(
    userId,
    campaign.channelId,
    FEATURES.LIBRARY,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;
  const cleanBody = sanitizeRichHtml(body.body.trim());

  const update = await db.campaignUpdate.create({
    data: {
      campaignId,
      title: body.title.trim(),
      body: cleanBody,
      backersOnly: body.backersOnly,
      notifyBackers: body.notifyBackers,
    },
  });

  if (body.notifyBackers) {
    const backers = await db.campaignPledge.findMany({
      where: { campaignId, status: TransactionStatus.SUCCEEDED },
      select: { userId: true },
      distinct: ["userId"],
    });
    if (backers.length > 0) {
      await db.notification.createMany({
        data: backers.map((b) => ({
          userId: b.userId,
          type: NotificationType.SYSTEM,
          title: `📣 Update on “${campaign.title}”: ${body.title.trim()}`,
          body: cleanBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 280),
          url: `/campaign/${campaign.slug}`,
        })),
      });
    }
  }

  return NextResponse.json({ update });
}
