import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/invites";

// Founding-cohort invite codes (PLAN §4). Admins mint them; an applicant who
// redeems one may submit without vouches (there is no one to vouch yet).

export async function GET() {
  const { userId } = await auth();
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const codes = await db.inviteCode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      applications: {
        select: { id: true, status: true, proposedHandle: true, proposedName: true },
      },
    },
  });

  return NextResponse.json({ codes });
}

const CreateSchema = z.object({
  note: z.string().max(500).optional(),
  email: z.string().email().optional(),
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const code = await db.inviteCode.create({
    data: {
      code: generateInviteCode(),
      note: body.note ?? null,
      email: body.email ?? null,
      maxUses: body.maxUses,
      createdById: userId!,
      expiresAt: body.expiresInDays
        ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  return NextResponse.json({ code });
}

const RevokeSchema = z.object({
  id: z.string().min(1),
  action: z.literal("revoke"),
});

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = RevokeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const existing = await db.inviteCode.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, revokedAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Code not found." }, { status: 404 });
  }

  const code = existing.revokedAt
    ? existing
    : await db.inviteCode.update({
        where: { id: existing.id },
        data: { revokedAt: new Date() },
      });

  return NextResponse.json({ code });
}
