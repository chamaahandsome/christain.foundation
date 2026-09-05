import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  contractHash,
  extractRecipientFields,
  fillRecipientFields,
  signatureBlockHtml,
  substituteSignatureFields,
  tokenUsable,
} from "@/lib/contracts";
import { sendContractSignedEmails, sendInvoiceEmail } from "@/lib/business-emails";

// Tokenized signing: the link in the client's hands is the credential.
// POST records the signature (typed or drawn) with IP and user agent —
// the same compliance trail Maltivas keeps — freezes the signed content,
// and hashes it for the public verify page.

const SignSchema = z.object({
  action: z.enum(["sign", "decline"]),
  signerName: z.string().min(2).max(200).optional(),
  signatureType: z.enum(["typed", "drawn"]).optional(),
  // typed: the name again; drawn: a PNG data-URL from the signature pad
  signature: z.string().max(200_000).optional(),
  declineReason: z.string().max(1000).optional(),
  // Answers for data-filled-by="recipient" fill-ins in the document
  fieldValues: z.record(z.string(), z.string().max(2000)).optional(),
});

async function loadToken(token: string) {
  return db.contractSignToken.findUnique({
    where: { token },
    include: {
      contract: {
        include: {
          channel: { select: { name: true, handle: true, ownerId: true } },
          signatures: true,
        },
      },
    },
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const row = await loadToken(token);
  if (!row) return NextResponse.json({ error: "Unknown signing link." }, { status: 404 });

  const usable = tokenUsable(row, row.contract.status);
  if (usable !== "ok") {
    const message =
      usable === "used"
        ? "This link was already used."
        : usable === "expired"
          ? "This signing link has expired — ask for a fresh one."
          : "This contract is no longer open for signing.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const parsed = SignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;
  const userAgent = req.headers.get("user-agent");

  if (body.action === "decline") {
    await db.$transaction([
      db.contractSignToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      db.contract.update({
        where: { id: row.contractId },
        data: {
          status: "DECLINED",
          declinedAt: new Date(),
          declineReason: body.declineReason?.trim() || null,
          activities: {
            create: {
              type: "declined",
              description: `${row.signerName} declined${
                body.declineReason ? `: ${body.declineReason.slice(0, 200)}` : ""
              }`,
            },
          },
        },
      }),
    ]);
    return NextResponse.json({ ok: true, declined: true });
  }

  if (!body.signerName?.trim() || !body.signatureType || !body.signature) {
    return NextResponse.json(
      { error: "Sign with your name (typed or drawn) to continue." },
      { status: 422 },
    );
  }
  if (body.signatureType === "drawn" && !body.signature.startsWith("data:image/png")) {
    return NextResponse.json({ error: "The drawn signature didn't upload." }, { status: 422 });
  }

  // Recipient fill-ins must all be answered before the document freezes.
  const recipientFields = extractRecipientFields(row.contract.content);
  const missing = recipientFields.filter((f) => !body.fieldValues?.[f.key]?.trim());
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Fill in: ${missing.map((f) => f.label).join(", ")}` },
      { status: 422 },
    );
  }

  const signedAt = new Date();
  // This signer's answers land in the document immediately, so co-signers
  // see them filled in; the frozen signedContent is built only when the
  // LAST recipient signs (all tokens used).
  const filledContent = fillRecipientFields(
    row.contract.content,
    body.fieldValues ?? {},
  );
  const remaining = await db.contractSignToken.count({
    where: {
      contractId: row.contractId,
      usedAt: null,
      expiresAt: { gt: new Date() },
      id: { not: row.id },
    },
  });
  const complete = remaining === 0;

  const signerEmail = row.signerEmail.toLowerCase();

  let signedContent: string | null = null;
  if (complete) {
    const creatorSig = row.contract.signatures.find((s) => s.signerRole === "creator");
    signedContent = filledContent;
    if (creatorSig?.signature) {
      signedContent = substituteSignatureFields(
        signedContent,
        "creator",
        signatureBlockHtml({
          signature: creatorSig.signature,
          signerName: creatorSig.signerName,
          signedAt: creatorSig.signedAt,
        }),
      );
    }
    // Every co-signer's recorded signature, then this signer's.
    const clientSigs = row.contract.signatures.filter(
      (s) => s.signerRole === "client" && s.signature && s.signedAt,
    );
    for (const sig of clientSigs) {
      signedContent = substituteSignatureFields(
        signedContent,
        "client",
        signatureBlockHtml({
          signature: sig.signature!,
          signerName: sig.signerName,
          signedAt: sig.signedAt,
        }),
        {
          email: sig.signerEmail.toLowerCase(),
          includeUnassigned:
            sig.signerEmail.toLowerCase() === row.contract.clientEmail.toLowerCase(),
        },
      );
    }
    signedContent = substituteSignatureFields(
      signedContent,
      "client",
      signatureBlockHtml({
        signature: body.signature,
        signerName: body.signerName.trim(),
        signedAt,
      }),
      // The last signer also absorbs any leftover unassigned chips.
      { email: signerEmail, includeUnassigned: true },
    );
  }

  await db.$transaction([
    db.contractSignature.upsert({
      where: {
        contractId_signerRole_signerEmail: {
          contractId: row.contractId,
          signerRole: "client",
          signerEmail: row.signerEmail,
        },
      },
      create: {
        contractId: row.contractId,
        signerRole: "client",
        signerName: body.signerName.trim(),
        signerEmail: row.signerEmail,
        signatureType: body.signatureType,
        signature: body.signature,
        signerIp: ip,
        userAgent,
        signedAt,
      },
      update: {
        signerName: body.signerName.trim(),
        signatureType: body.signatureType,
        signature: body.signature,
        signerIp: ip,
        userAgent,
        signedAt,
      },
    }),
    db.contractSignToken.update({ where: { id: row.id }, data: { usedAt: signedAt } }),
    db.contract.update({
      where: { id: row.contractId },
      data: complete
        ? {
            status: "SIGNED",
            signedAt,
            content: filledContent,
            signedContent: signedContent!,
            documentHash: contractHash(signedContent!),
            activities: {
              create: {
                type: "signed",
                description: `${body.signerName.trim()} signed (${body.signatureType}) — fully executed`,
              },
            },
          }
        : {
            status: "PARTIALLY_SIGNED",
            content: filledContent,
            activities: {
              create: {
                type: "signed",
                description: `${body.signerName.trim()} signed (${body.signatureType}) — ${remaining} signature${remaining > 1 ? "s" : ""} outstanding`,
              },
            },
          },
    }),
    db.notification.create({
      data: {
        userId: row.contract.channel.ownerId,
        type: "SYSTEM",
        title: complete
          ? `✍️ ${body.signerName.trim()} signed “${row.contract.title}”`
          : `📝 Partial signature by ${body.signerName.trim()} on “${row.contract.title}”`,
        body: complete
          ? `${row.contract.contractNumber} is fully executed.`
          : `${row.contract.contractNumber}: ${remaining} signer${remaining > 1 ? "s" : ""} still pending.`,
        url: "/studio",
      },
    }),
  ]);

  // A draft invoice linked to this contract goes out automatically now
  // that the agreement is executed (the Maltivas link-to-invoice flow).
  const linkedInvoice = complete
    ? await db.invoice.findFirst({
        where: { contractId: row.contractId, status: "draft" },
      })
    : null;
  if (linkedInvoice) {
    await db.invoice.update({
      where: { id: linkedInvoice.id },
      data: { status: "sent", sentAt: new Date() },
    });
    await db.contractActivity.create({
      data: {
        contractId: row.contractId,
        type: "sent",
        description: `Linked invoice ${linkedInvoice.invoiceNumber} sent to ${linkedInvoice.clientEmail}`,
      },
    });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (origin && complete) {
    if (linkedInvoice) {
      await sendInvoiceEmail({
        to: linkedInvoice.clientEmail,
        clientName: linkedInvoice.clientName,
        channelName: row.contract.channel.name,
        invoiceNumber: linkedInvoice.invoiceNumber,
        title: linkedInvoice.title,
        amountCents: linkedInvoice.amountCents,
        dueAt: linkedInvoice.dueAt,
        invoiceUrl: `${origin}/invoice/${linkedInvoice.token}`,
      });
    }
    const owner = await db.user.findUnique({
      where: { id: row.contract.channel.ownerId },
      select: { email: true },
    });
    await sendContractSignedEmails({
      clientEmail: row.signerEmail,
      clientName: body.signerName.trim(),
      creatorEmail: owner?.email ?? null,
      channelName: row.contract.channel.name,
      contractTitle: row.contract.title,
      contractNumber: row.contract.contractNumber,
      verifyUrl: `${origin}/verify/${row.contractId}`,
    });
  }

  return NextResponse.json({ ok: true, contractId: row.contractId, complete });
}
