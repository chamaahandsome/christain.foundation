import { NextResponse } from "next/server";
import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { nextContractNumber } from "@/lib/contracts";
import { contractContentFromQuote } from "@/lib/billing";

// Public quote response: accept mints the contract draft (the Do-Biz
// booking → quote → contract workflow); decline closes it out.

const BodySchema = z.object({
  action: z.enum(["accept", "decline"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const quote = await db.quote.findUnique({
    where: { token },
    include: {
      channel: { select: { id: true, name: true, ownerId: true, businessLogoUrl: true } },
    },
  });
  if (!quote) return NextResponse.json({ error: "Unknown quote." }, { status: 404 });
  if (!["sent", "viewed"].includes(quote.status)) {
    return NextResponse.json({ error: "This quote is no longer open." }, { status: 409 });
  }
  if (quote.expiresAt && quote.expiresAt.getTime() <= Date.now()) {
    await db.quote.update({ where: { id: quote.id }, data: { status: "expired" } });
    return NextResponse.json({ error: "This quote has expired." }, { status: 409 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (parsed.data.action === "decline") {
    await db.quote.update({
      where: { id: quote.id },
      data: { status: "declined", declinedAt: new Date() },
    });
    await db.notification.create({
      data: {
        userId: quote.channel.ownerId,
        type: NotificationType.SYSTEM,
        title: `Quote ${quote.quoteNumber} was declined by ${quote.clientName}`,
        url: "/studio",
      },
    });
    return NextResponse.json({ ok: true, declined: true });
  }

  // accept → contract draft, carrying the quote's terms
  const last = await db.contract.findFirst({
    where: { channelId: quote.channelId, contractNumber: { startsWith: "CON-" } },
    orderBy: { contractNumber: "desc" },
    select: { contractNumber: true },
  });
  const contract = await db.contract.create({
    data: {
      channelId: quote.channelId,
      contractNumber: nextContractNumber(last?.contractNumber ?? null),
      title: quote.title,
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      amountCents: quote.amountCents,
      logoUrl: quote.channel.businessLogoUrl,
      // The quote's line items ride in as the scope, chips included — the
      // draft is signing-ready in the editor.
      content: contractContentFromQuote(quote),
      activities: {
        create: { type: "created", description: `Drafted from accepted quote ${quote.quoteNumber}` },
      },
    },
  });
  await db.quote.update({
    where: { id: quote.id },
    data: { status: "accepted", acceptedAt: new Date(), contractId: contract.id },
  });
  if (quote.bookingRequestId) {
    await db.bookingRequest.updateMany({
      where: { id: quote.bookingRequestId, status: "PENDING" },
      data: { status: "ACCEPTED", contractId: contract.id },
    });
  }
  await db.notification.create({
    data: {
      userId: quote.channel.ownerId,
      type: NotificationType.SYSTEM,
      title: `🎉 ${quote.clientName} accepted quote ${quote.quoteNumber}`,
      body: "A contract draft is ready in Business → Contracts — review, sign, and send.",
      url: "/studio",
    },
  });
  return NextResponse.json({ ok: true, accepted: true });
}
