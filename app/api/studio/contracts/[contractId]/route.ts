import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  SIGN_TOKEN_TTL_DAYS,
  countUnassignedClientChips,
  generateSignToken,
  getUniqueRecipients,
  validateContractDraft,
} from "@/lib/contracts";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { sendContractSigningEmail } from "@/lib/business-emails";

// Per-contract management: edit (drafts only), send (creator signs + a
// tokenized signing link is minted for the client), cancel, delete (drafts).

async function requireOwner(userId: string, contractId: string) {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: { channel: { select: { id: true, ownerId: true, name: true } } },
  });
  if (!contract) return { error: "Contract not found", status: 404 } as const;
  const access = await getChannelAccess(
    userId,
    contract.channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.authorized) return { error: "Forbidden", status: 403 } as const;
  return { contract } as const;
}

const PatchSchema = z.object({
  action: z.enum(["edit", "send", "cancel"]).default("edit"),
  title: z.string().min(1).max(200).optional(),
  clientName: z.string().max(200).optional(),
  clientEmail: z.string().max(320).optional(),
  clientCompany: z.string().max(200).nullable().optional(),
  amountCents: z.number().int().nullable().optional(),
  content: z.string().min(1).max(200_000).optional(),
  logoUrl: z.string().url().max(2000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { contractId } = await params;
  const gate = await requireOwner(userId, contractId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  const { contract } = gate;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.action === "cancel") {
    if (contract.status === "SIGNED") {
      return NextResponse.json(
        { error: "A fully signed contract can't be cancelled here." },
        { status: 409 },
      );
    }
    await db.contract.update({
      where: { id: contract.id },
      data: {
        status: "CANCELLED",
        activities: { create: { type: "cancelled", description: "Contract cancelled" } },
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "send") {
    if (contract.status !== "DRAFT") {
      return NextResponse.json({ error: "Only drafts can be sent." }, { status: 409 });
    }
    const invalidDraft = validateContractDraft(contract);
    if (invalidDraft) return NextResponse.json({ error: invalidDraft }, { status: 422 });
    // The stored Do-Biz signature signs for the creator (set once in the
    // first-visit modal).
    const channel = await db.channel.findUnique({
      where: { id: contract.channelId },
      select: { digitalSignature: true, digitalSignatureName: true },
    });
    if (!channel?.digitalSignature || !channel.digitalSignatureName) {
      return NextResponse.json(
        { error: "Create your signature first — it signs every contract you send." },
        { status: 422 },
      );
    }
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    const expiresAt = new Date(Date.now() + SIGN_TOKEN_TTL_DAYS * 86_400_000);

    // One signing token per unique recipient (the Maltivas multi-signer
    // flow): every client chip carrying an email is a recipient; chips
    // without an email — and chip-less documents — fall to clientEmail.
    const assigned = getUniqueRecipients(contract.content);
    const needsDefault =
      assigned.length === 0 || countUnassignedClientChips(contract.content) > 0;
    const targets = [...assigned];
    if (
      needsDefault &&
      !targets.some((t) => t.email === contract.clientEmail.toLowerCase())
    ) {
      targets.push({
        email: contract.clientEmail.toLowerCase(),
        name: contract.clientName,
      });
    }
    const tokens = targets.map((target) => ({
      token: generateSignToken(),
      signerEmail: target.email,
      signerName: target.name,
    }));

    await db.$transaction([
      db.contractSignature.create({
        data: {
          contractId: contract.id,
          signerRole: "creator",
          signerName: channel.digitalSignatureName,
          signerEmail: user?.email ?? "",
          signatureType: "drawn",
          signature: channel.digitalSignature,
          signedAt: new Date(),
        },
      }),
      db.contractSignToken.createMany({
        data: tokens.map((tk) => ({
          token: tk.token,
          contractId: contract.id,
          signerEmail: tk.signerEmail,
          signerName: tk.signerName,
          expiresAt,
        })),
      }),
      db.contract.update({
        where: { id: contract.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          activities: {
            create: {
              type: "sent",
              description:
                tokens.length === 1
                  ? `Signing link created for ${tokens[0].signerName} <${tokens[0].signerEmail}>`
                  : `Signing links created for ${tokens.length} recipients: ${tokens
                      .map((tk) => tk.signerEmail)
                      .join(", ")}`,
            },
          },
        },
      }),
    ]);

    const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    let emailedCount = 0;
    if (origin) {
      for (const tk of tokens) {
        const ok = await sendContractSigningEmail({
          to: tk.signerEmail,
          clientName: tk.signerName,
          channelName: gate.contract.channel.name,
          contractTitle: contract.title,
          contractNumber: contract.contractNumber,
          signingUrl: `${origin}/sign/${tk.token}`,
          replyTo: user?.email ?? undefined,
        });
        if (ok) emailedCount += 1;
      }
      if (emailedCount > 0) {
        await db.contractActivity.create({
          data: {
            contractId: contract.id,
            type: "sent",
            description: `Signing link emailed to ${emailedCount} of ${tokens.length} recipient${tokens.length > 1 ? "s" : ""}`,
          },
        });
      }
    }
    return NextResponse.json({
      ok: true,
      token: tokens[0].token,
      recipients: tokens.length,
      emailed: emailedCount,
    });
  }

  // edit — drafts only
  if (contract.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only drafts can be edited — cancel and redraft instead." },
      { status: 409 },
    );
  }
  const next = {
    title: body.title?.trim() ?? contract.title,
    clientName: body.clientName?.trim() ?? contract.clientName,
    clientEmail: body.clientEmail?.trim().toLowerCase() ?? contract.clientEmail,
    content: body.content !== undefined ? sanitizeRichHtml(body.content) : contract.content,
    amountCents: body.amountCents !== undefined ? body.amountCents : contract.amountCents,
  };
  // Drafts save freely (a half-filled client is fine mid-edit); the full
  // validation gate runs at send.

  const updated = await db.contract.update({
    where: { id: contract.id },
    data: {
      ...next,
      ...(body.clientCompany !== undefined
        ? { clientCompany: body.clientCompany?.trim() || null }
        : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.expiresAt !== undefined
        ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null }
        : {}),
      activities: { create: { type: "updated", description: "Draft edited" } },
    },
  });
  return NextResponse.json({ contract: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ contractId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { contractId } = await params;
  const gate = await requireOwner(userId, contractId);
  if ("error" in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });
  if (gate.contract.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Only drafts can be deleted — cancel instead." },
      { status: 409 },
    );
  }
  await db.contractActivity.deleteMany({ where: { contractId } });
  await db.contractSignature.deleteMany({ where: { contractId } });
  await db.contractSignToken.deleteMany({ where: { contractId } });
  await db.contract.delete({ where: { id: contractId } });
  return NextResponse.json({ ok: true });
}
