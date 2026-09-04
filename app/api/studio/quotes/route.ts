import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateSignToken, nextDocNumber } from "@/lib/contracts";
import { sendQuoteEmail } from "@/lib/business-emails";
import { getChannelAccess } from "@/lib/team-authorization";

// Quotes (Do-Biz workflow leg): usually raised from a booking request;
// accepting one mints the contract. Owner-only.

const CreateSchema = z.object({
  channelId: z.string().min(1),
  bookingRequestId: z.string().optional(),
  clientName: z.string().min(2).max(200),
  clientEmail: z.string().email().max(320),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  amountCents: z.number().int().min(100),
  expiresAt: z.string().datetime().nullable().optional(),
});

const PatchSchema = z.object({
  channelId: z.string().min(1),
  quoteId: z.string().min(1),
  action: z.enum(["send", "delete"]),
});

async function requireOwner(userId: string, channelId: string) {
  const access = await getChannelAccess(userId, channelId);
  if (!access.channel) return { error: "Channel not found", status: 404 } as const;
  if (!access.isOwner) return { error: "Forbidden", status: 403 } as const;
  return { channel: access.channel } as const;
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

  const last = await db.quote.findFirst({
    where: { channelId: body.channelId },
    orderBy: { quoteNumber: "desc" },
    select: { quoteNumber: true },
  });
  const quote = await db.quote.create({
    data: {
      channelId: body.channelId,
      quoteNumber: nextDocNumber("QUO", last?.quoteNumber ?? null),
      bookingRequestId: body.bookingRequestId ?? null,
      clientName: body.clientName.trim(),
      clientEmail: body.clientEmail.trim().toLowerCase(),
      title: body.title.trim(),
      description: body.description?.trim() || null,
      amountCents: body.amountCents,
      token: generateSignToken(),
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    },
  });
  return NextResponse.json({ quote });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { channelId, quoteId, action } = parsed.data;
  const gate = await requireOwner(userId, channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const quote = await db.quote.findUnique({ where: { id: quoteId } });
  if (!quote || quote.channelId !== channelId) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  if (action === "delete") {
    if (quote.status !== "draft") {
      return NextResponse.json({ error: "Only draft quotes can be deleted." }, { status: 409 });
    }
    await db.quote.delete({ where: { id: quoteId } });
    return NextResponse.json({ ok: true });
  }

  // send
  if (quote.status !== "draft") {
    return NextResponse.json({ error: "This quote was already sent." }, { status: 409 });
  }
  await db.quote.update({
    where: { id: quoteId },
    data: { status: "sent", sentAt: new Date() },
  });
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  const emailed = origin
    ? await sendQuoteEmail({
        to: quote.clientEmail,
        clientName: quote.clientName,
        channelName: gate.channel.name,
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        amountCents: quote.amountCents,
        quoteUrl: `${origin}/quote/${quote.token}`,
        replyTo: user?.email ?? undefined,
      })
    : false;
  return NextResponse.json({ ok: true, token: quote.token, emailed });
}
