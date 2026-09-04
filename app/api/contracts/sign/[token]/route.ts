import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { contractHash, tokenUsable } from "@/lib/contracts";
import { sendContractSignedEmails } from "@/lib/business-emails";

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

  const signedAt = new Date();
  const signedContent = row.contract.content;

  await db.$transaction([
    db.contractSignature.upsert({
      where: {
        contractId_signerRole: { contractId: row.contractId, signerRole: "client" },
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
      data: {
        status: "SIGNED",
        signedAt,
        signedContent,
        documentHash: contractHash(signedContent),
        activities: {
          create: {
            type: "signed",
            description: `${body.signerName.trim()} signed (${body.signatureType})`,
          },
        },
      },
    }),
    db.notification.create({
      data: {
        userId: row.contract.channel.ownerId,
        type: "SYSTEM",
        title: `✍️ ${body.signerName.trim()} signed “${row.contract.title}”`,
        body: `${row.contract.contractNumber} is fully executed.`,
        url: "/studio",
      },
    }),
  ]);

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (origin) {
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

  return NextResponse.json({ ok: true, contractId: row.contractId });
}
