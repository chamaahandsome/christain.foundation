import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { nextContractNumber } from "@/lib/contracts";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";

// Contract authoring — owner-only, like everything with legal or money weight.

const CreateSchema = z.object({
  channelId: z.string().min(1),
  title: z.string().min(1).max(200),
  templateId: z.string().optional(),
  clientName: z.string().max(200).optional(),
  clientEmail: z.string().max(320).optional(),
  clientCompany: z.string().max(200).optional(),
  amountCents: z.number().int().nullable().optional(),
  content: z.string().min(1).max(200_000).default("<p></p>"),
  expiresAt: z.string().datetime().nullable().optional(),
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
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  if (!access.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Drafts may start clientless (the editor fills them in); full
  // validation runs at send.

  const last = await db.contract.findFirst({
    where: { channelId: body.channelId, contractNumber: { startsWith: "CON-" } },
    orderBy: { contractNumber: "desc" },
    select: { contractNumber: true },
  });

  let content = body.content;
  if (body.templateId) {
    const tpl = await db.businessTemplate.findUnique({
      where: { id: body.templateId },
      select: { channelId: true, content: true },
    });
    if (!tpl || tpl.channelId !== body.channelId) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    content = tpl.content;
  }

  const channelLogo = await db.channel.findUnique({
    where: { id: body.channelId },
    select: { businessLogoUrl: true },
  });

  const contract = await db.contract.create({
    data: {
      channelId: body.channelId,
      contractNumber: nextContractNumber(last?.contractNumber ?? null),
      logoUrl: channelLogo?.businessLogoUrl ?? null,
      title: body.title.trim(),
      clientName: body.clientName?.trim() ?? "",
      clientEmail: body.clientEmail?.trim().toLowerCase() ?? "",
      clientCompany: body.clientCompany?.trim() || null,
      amountCents: body.amountCents ?? null,
      content: sanitizeRichHtml(content),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      activities: {
        create: { type: "created", description: "Contract drafted" },
      },
    },
  });
  return NextResponse.json({ contract });
}
