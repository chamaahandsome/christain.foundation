import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { generateSignToken, nextDocNumber } from "@/lib/contracts";
import { sendInvoiceEmail } from "@/lib/business-emails";
import { getChannelAccess } from "@/lib/team-authorization";
import { computeBillTotals, dueDateFor, parseLineItems } from "@/lib/billing";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";

// Invoices (Do-Biz workflow leg): usually raised from a signed contract.
// Light v1 — sent by email/link, payment marked manually; Stripe
// collection joins later. Owner-only.

const BillFields = {
  lineItems: z.array(z.unknown()).max(50).optional(),
  taxBps: z.number().int().min(0).max(10_000).optional(),
  discountCents: z.number().int().min(0).optional(),
  notes: z.string().max(4000).nullable().optional(),
  terms: z.string().max(4000).nullable().optional(),
  paymentTerms: z.enum(["due-on-receipt", "net-15", "net-30", "net-60"]).optional(),
};

const CreateSchema = z.object({
  channelId: z.string().min(1),
  contractId: z.string().optional(),
  clientName: z.string().min(2).max(200),
  clientEmail: z.string().email().max(320),
  title: z.string().min(2).max(200),
  description: z.string().max(100_000).optional(),
  amountCents: z.number().int().min(100).optional(),
  dueAt: z.string().datetime().nullable().optional(),
  ...BillFields,
});

/** Structured invoices compute their amount from line items; quick
 * invoices still pass amountCents directly. */
function billData(body: {
  lineItems?: unknown[];
  taxBps?: number;
  discountCents?: number;
  notes?: string | null;
  terms?: string | null;
  paymentTerms?: string;
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
    ...(body.paymentTerms ? { paymentTerms: body.paymentTerms } : {}),
    amountCents,
  };
}

const PatchSchema = z.object({
  channelId: z.string().min(1),
  invoiceId: z.string().min(1),
  action: z.enum(["send", "markPaid", "void", "delete", "link", "edit"]),
  // link: the contract this invoice follows (null unlinks). A linked draft
  // invoice is auto-sent when the contract is signed.
  contractId: z.string().nullable().optional(),
  clientName: z.string().min(2).max(200).optional(),
  clientEmail: z.string().email().max(320).optional(),
  title: z.string().min(2).max(200).optional(),
  ...BillFields,
});

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

  const last = await db.invoice.findFirst({
    where: { channelId: body.channelId },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const bill = billData(body);
  if (bill.amountCents < 100) {
    return NextResponse.json(
      { error: "Add at least one line item — the total must be $1 or more." },
      { status: 422 },
    );
  }
  const invoice = await db.invoice.create({
    data: {
      channelId: body.channelId,
      invoiceNumber: nextDocNumber("INV", last?.invoiceNumber ?? null),
      contractId: body.contractId ?? null,
      clientName: body.clientName.trim(),
      clientEmail: body.clientEmail.trim().toLowerCase(),
      title: body.title.trim(),
      description: body.description?.trim()
        ? sanitizeRichHtml(body.description.trim())
        : null,
      ...bill,
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
  const { channelId, invoiceId, action, contractId, ...body } = parsed.data;
  const gate = await requireOwner(userId, channelId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.channelId !== channelId) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (action === "edit") {
    if (invoice.status !== "draft") {
      return NextResponse.json({ error: "Only draft invoices can be edited." }, { status: 409 });
    }
    const bill = billData(body);
    const updated = await db.invoice.update({
      where: { id: invoiceId },
      data: {
        ...(body.clientName ? { clientName: body.clientName.trim() } : {}),
        ...(body.clientEmail
          ? { clientEmail: body.clientEmail.trim().toLowerCase() }
          : {}),
        ...(body.title ? { title: body.title.trim() } : {}),
        ...bill,
        ...(bill.amountCents >= 100 ? {} : { amountCents: invoice.amountCents }),
      },
    });
    return NextResponse.json({ invoice: updated });
  }

  if (action === "link") {
    if (contractId) {
      const contract = await db.contract.findUnique({
        where: { id: contractId },
        select: { channelId: true },
      });
      if (!contract || contract.channelId !== channelId) {
        return NextResponse.json({ error: "Contract not found" }, { status: 404 });
      }
      // One linked invoice per contract keeps the editor dropdown honest.
      await db.invoice.updateMany({
        where: { channelId, contractId, id: { not: invoiceId } },
        data: { contractId: null },
      });
    }
    await db.invoice.update({
      where: { id: invoiceId },
      data: { contractId: contractId ?? null },
    });
    return NextResponse.json({ ok: true });
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
  const sentAt = invoice.sentAt ?? new Date();
  await db.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "sent",
      sentAt,
      // Payment terms fix the due date at send time (unless one was set).
      dueAt: invoice.dueAt ?? dueDateFor(invoice.paymentTerms, sentAt),
    },
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
