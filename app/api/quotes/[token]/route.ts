import { NextResponse } from "next/server";
import { z } from "zod";
import { NotificationType } from "@prisma/client";
import { db } from "@/lib/db";
import { nextContractNumber } from "@/lib/contracts";

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
    include: { channel: { select: { id: true, name: true, ownerId: true } } },
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
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const contract = await db.contract.create({
    data: {
      channelId: quote.channelId,
      contractNumber: nextContractNumber(last?.contractNumber ?? null),
      title: quote.title,
      clientName: quote.clientName,
      clientEmail: quote.clientEmail,
      amountCents: quote.amountCents,
      content:
        `<h2>Agreement</h2>` +
        `<p>This agreement follows accepted quote ${quote.quoteNumber} — ` +
        `${esc(quote.title)}, $${(quote.amountCents / 100).toLocaleString()}.</p>` +
        (quote.description
          ? quote.description.includes("<")
            ? `<h3>Scope</h3>${quote.description}`
            : `<h3>Scope</h3><p>${esc(quote.description)}</p>`
          : "") +
        `<h3>Payment</h3><p>$${(quote.amountCents / 100).toLocaleString()}, terms as agreed.</p>` +
        `<h3>Terms</h3><ul><li>Cancellation…</li><li>This agreement is governed by…</li></ul>`,
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
