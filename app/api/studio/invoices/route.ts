import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateSignToken, nextDocNumber } from "@/lib/contracts";
import { sendInvoiceEmail } from "@/lib/business-emails";
import { getChannelAccess } from "@/lib/team-authorization";

// Invoices (Do-Biz workflow leg): usually raised from a signed contract.
// Light v1 — sent by email/link, payment marked manually; Stripe
// collection joins later. Owner-only.

const CreateSchema = z.object({
  channelId: z.string().min(1),
  contractId: z.string().optional(),
  clientName: z.string().min(2).max(200),
  clientEmail: z.string().email().max(320),
  title: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  amountCents: z.number().int().min(100),
  dueAt: z.string().datetime().nullable().optional(),
});

const PatchSchema = z.object({
  channelId: z.string().min(1),
  invoiceId: z.string().min(1),
  action: z.enum(["send", "markPaid", "void", "delete"]),
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

  const last = await db.invoice.findFirst({
    where: { channelId: body.channelId },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const invoice = await db.invoice.create({
    data: {
      channelId: body.channelId,
      invoiceNumber: nextDocNumber("INV", last?.invoiceNumber ?? null),
      contractId: body.contractId ?? null,
      clientName: body.clientName.trim(),
      clientEmail: body.clientEmail.trim().toLowerCase(),
      title: body.title.trim(),
      description: body.description?.trim() || null,
      amountCents: body.amountCents,
      token: generateSignToken(),
      dueAt: body.dueAt ? new Date(body.dueAt) : null,
    },
  });
  return NextResponse.json({ invoice });
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { channelId, invoiceId, action } = parsed.data;
  const gate = await requireOwner(userId, channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.channelId !== channelId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (action === "delete") {
    if (invoice.status !== "draft") {
      return NextResponse.json({ error: "Only draft invoices can be deleted." }, { status: 409 });
    }
    await db.invoice.delete({ where: { id: invoiceId } });
    return NextResponse.json({ ok: true });
  }
  if (action === "markPaid") {
    if (invoice.status === "void") {
      return NextResponse.json({ error: "This invoice was voided." }, { status: 409 });
    }
    await db.invoice.update({
      where: { id: invoiceId },
      data: { status: "paid", paidAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }
  if (action === "void") {
    if (invoice.status === "paid") {
      return NextResponse.json({ error: "A paid invoice can't be voided." }, { status: 409 });
    }
    await db.invoice.update({ where: { id: invoiceId }, data: { status: "void" } });
    return NextResponse.json({ ok: true });
  }

  // send
  if (invoice.status !== "draft" && invoice.status !== "sent") {
    return NextResponse.json({ error: "This invoice can't be sent." }, { status: 409 });
  }
  await db.invoice.update({
    where: { id: invoiceId },
    data: { status: "sent", sentAt: invoice.sentAt ?? new Date() },
  });
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  const emailed = origin
    ? await sendInvoiceEmail({
        to: invoice.clientEmail,
        clientName: invoice.clientName,
        channelName: gate.channel.name,
        invoiceNumber: invoice.invoiceNumber,
        title: invoice.title,
        amountCents: invoice.amountCents,
        dueAt: invoice.dueAt,
        invoiceUrl: `${origin}/invoice/${invoice.token}`,
        replyTo: user?.email ?? undefined,
      })
    : false;
  return NextResponse.json({ ok: true, token: invoice.token, emailed });
}
