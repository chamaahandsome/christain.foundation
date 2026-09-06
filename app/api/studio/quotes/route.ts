import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { generateSignToken, nextDocNumber } from "@/lib/contracts";
import type { Prisma as PrismaNS } from "@prisma/client";
import { sendQuoteEmail } from "@/lib/business-emails";
import { getChannelAccess } from "@/lib/team-authorization";
import { computeBillTotals, parseLineItems } from "@/lib/billing";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";

// Quotes (Do-Biz workflow leg): usually raised from a booking request;
// accepting one mints the contract. Owner-only.

const BillFields = {
  lineItems: z.array(z.unknown()).max(50).optional(),
  taxBps: z.number().int().min(0).max(10_000).optional(),
  discountCents: z.number().int().min(0).optional(),
  notes: z.string().max(4000).nullable().optional(),
  terms: z.string().max(4000).nullable().optional(),
  validDays: z.number().int().min(1).max(365).optional(),
};

const CreateSchema = z.object({
  channelId: z.string().min(1),
  bookingRequestId: z.string().optional(),
  clientName: z.string().min(2).max(200),
  clientEmail: z.string().email().max(320),
  title: z.string().min(2).max(200),
  description: z.string().max(100_000).optional(),
  amountCents: z.number().int().min(100).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  ...BillFields,
});

const PatchSchema = z.object({
  channelId: z.string().min(1),
  quoteId: z.string().min(1),
  action: z.enum(["send", "delete", "edit", "convertToInvoice"]),
  clientName: z.string().min(2).max(200).optional(),
  clientEmail: z.string().email().max(320).optional(),
  title: z.string().min(2).max(200).optional(),
  ...BillFields,
});

/** Structured quotes compute their amount from line items; quick quotes
 * (booking modal) still pass amountCents directly. */
function billData(body: {
  lineItems?: unknown[];
  taxBps?: number;
  discountCents?: number;
  notes?: string | null;
  terms?: string | null;
  amountCents?: number;
}) {
  const lineItems = parseLineItems(body.lineItems);
  const totals = computeBillTotals({
    lineItems,
    taxBps: body.taxBps,
    discountCents: body.discountCents,
  });
  const amountCents =
    lineItems.length > 0 ? totals.totalCents : (body.amountCents ?? 0);
  return {
    lineItems:
      lineItems.length > 0
        ? (lineItems as unknown as Prisma.InputJsonValue)
        : undefined,
    taxBps: body.taxBps ?? 0,
    discountCents: body.discountCents ?? 0,
    notes: body.notes?.trim() || null,
    terms: body.terms?.trim() || null,
    amountCents,
  };
}

async function requireOwner(userId: string, channelId: string) {
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) return { error: "Channel not found", status: 404 } as const;
  if (!access.authorized) return { error: "Forbidden", status: 403 } as const;
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
  const bill = billData(body);
  if (bill.amountCents < 100) {
    return NextResponse.json(
      { error: "Add at least one line item — the total must be $1 or more." },
      { status: 422 },
    );
  }
  const quote = await db.quote.create({
    data: {
      channelId: body.channelId,
      quoteNumber: nextDocNumber("QUO", last?.quoteNumber ?? null),
      bookingRequestId: body.bookingRequestId ?? null,
      clientName: body.clientName.trim(),
      clientEmail: body.clientEmail.trim().toLowerCase(),
      title: body.title.trim(),
      description: body.description?.trim()
        ? sanitizeRichHtml(body.description.trim())
        : null,
      ...bill,
      token: generateSignToken(),
      expiresAt: body.expiresAt
        ? new Date(body.expiresAt)
        : new Date(Date.now() + (body.validDays ?? 30) * 86_400_000),
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
  const { channelId, quoteId, action, ...body } = parsed.data;
  const gate = await requireOwner(userId, channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const quote = await db.quote.findUnique({ where: { id: quoteId } });
  if (!quote || quote.channelId !== channelId) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Accepted quote → draft invoice carrying items/tax/client, linked back
  // to the quote and to its minted contract (so signing auto-sends it).
  if (action === "convertToInvoice") {
    if (quote.status !== "accepted") {
      return NextResponse.json(
        { error: "Only accepted quotes convert to invoices." },
        { status: 409 },
      );
    }
    const existing = await db.invoice.findUnique({
      where: { quoteId: quote.id },
      select: { id: true },
    });
    if (existing) return NextResponse.json({ invoice: existing, existing: true });

    const lastInv = await db.invoice.findFirst({
      where: { channelId },
      orderBy: { invoiceNumber: "desc" },
      select: { invoiceNumber: true },
    });
    const invoice = await db.invoice.create({
      data: {
        channelId,
        invoiceNumber: nextDocNumber("INV", lastInv?.invoiceNumber ?? null),
        quoteId: quote.id,
        contractId: quote.contractId,
        clientName: quote.clientName,
        clientEmail: quote.clientEmail,
        title: quote.title,
        description: quote.description,
        lineItems: (quote.lineItems ?? undefined) as
          | PrismaNS.InputJsonValue
          | undefined,
        taxBps: quote.taxBps,
        discountCents: quote.discountCents,
        notes: quote.notes,
        terms: quote.terms,
        amountCents: quote.amountCents,
        token: generateSignToken(),
      },
    });
    if (quote.contractId) {
      await db.contractActivity.create({
        data: {
          contractId: quote.contractId,
          type: "created",
          description: `Invoice ${invoice.invoiceNumber} drafted from quote ${quote.quoteNumber}`,
        },
      });
    }
    return NextResponse.json({ invoice });
  }

  if (action === "edit") {
    if (quote.status !== "draft") {
      return NextResponse.json({ error: "Only draft quotes can be edited." }, { status: 409 });
    }
    const bill = billData(body);
    const updated = await db.quote.update({
      where: { id: quoteId },
      data: {
        ...(body.clientName ? { clientName: body.clientName.trim() } : {}),
        ...(body.clientEmail
          ? { clientEmail: body.clientEmail.trim().toLowerCase() }
          : {}),
        ...(body.title ? { title: body.title.trim() } : {}),
        ...bill,
        ...(bill.amountCents >= 100 ? {} : { amountCents: quote.amountCents }),
        ...(body.validDays
          ? { expiresAt: new Date(Date.now() + body.validDays * 86_400_000) }
          : {}),
      },
    });
    return NextResponse.json({ quote: updated });
  }

  if (action === "delete") {
    if (quote.status !== "draft") {
      return NextResponse.json({ error: "Only draft quotes can be deleted." }, { status: 409 });
    }
    await db.quote.delete({ where: { id: quoteId } });
    return NextResponse.json({ ok: true });
  }

  // send (or resend while still open)
  if (!["draft", "sent", "viewed"].includes(quote.status)) {
    return NextResponse.json({ error: "This quote is no longer open." }, { status: 409 });
  }
  await db.quote.update({
    where: { id: quoteId },
    data: {
      // a resend never demotes "viewed"
      status: quote.status === "draft" ? "sent" : quote.status,
      sentAt: quote.sentAt ?? new Date(),
    },
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
