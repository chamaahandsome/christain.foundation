import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { validateTemplate } from "@/lib/contracts";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { getChannelAccess } from "@/lib/team-authorization";

// Business templates — reusable contract bodies (owner-only). A contract's
// "Save as template" and the create form's template picker both land here.

const CreateSchema = z.object({
  channelId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
  content: z.string().min(1).max(200_000),
});

async function requireOwner(userId: string, channelId: string) {
  const access = await getChannelAccess(userId, channelId);
  if (!access.channel) return { error: "Channel not found", status: 404 } as const;
  if (!access.isOwner) return { error: "Forbidden", status: 403 } as const;
  return { ok: true } as const;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;
  const gate = await requireOwner(userId, body.channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const invalid = validateTemplate(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 422 });

  const template = await db.businessTemplate.create({
    data: {
      channelId: body.channelId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      content: sanitizeRichHtml(body.content),
    },
  });
  return NextResponse.json({ template });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { channelId, templateId } = await req.json().catch(() => ({}));
  if (!channelId || !templateId) {
    return NextResponse.json({ error: "channelId and templateId required" }, { status: 400 });
  }
  const gate = await requireOwner(userId, channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const template = await db.businessTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.channelId !== channelId) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  await db.businessTemplate.delete({ where: { id: templateId } });
  return NextResponse.json({ ok: true });
}
