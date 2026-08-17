import { auth, currentUser } from "@clerk/nextjs/server";
import { ApplicationStatus, ChannelKind } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { affirmationComplete } from "@/lib/gate";
import { validateHandle } from "@/lib/handles";
import { inviteCodeUsable, normalizeInviteCode } from "@/lib/invites";

// The creator application (concept §5): draft + per-clause affirmation.
// GET returns the current statement, the user's draft, and affirmation state.
// POST upserts the draft and records affirmations/conduct agreement.

async function currentStatement() {
  return db.statementVersion.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { version: "desc" },
    include: { clauses: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const statement = await currentStatement();
  if (!statement) {
    return NextResponse.json({ error: "No published statement." }, { status: 503 });
  }

  const [application, affirmations] = await Promise.all([
    db.creatorApplication.findFirst({
      where: { userId, status: { in: [ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW] } },
      include: {
        vouches: {
          include: { voucherChannel: { select: { handle: true, name: true } } },
        },
        inviteCode: { select: { code: true } },
      },
    }),
    db.affirmationRecord.findMany({
      where: { userId, statementVersionId: statement.id },
      select: { clause: { select: { key: true } } },
    }),
  ]);

  const check = affirmationComplete(
    statement.clauses.map((c) => c.key),
    affirmations.map((a) => a.clause.key),
  );

  return NextResponse.json({
    statement: {
      version: statement.version,
      title: statement.title,
      preamble: statement.preamble,
      clauses: statement.clauses.map(({ key, title, text }) => ({ key, title, text })),
    },
    application,
    affirmation: check,
  });
}

// A social handle as typed by the user; the leading @ is tolerated and
// stripped before storage.
const socialHandle = z
  .string()
  .max(100)
  .transform((value) => value.trim().replace(/^@/, ""))
  .optional();

const BodySchema = z.object({
  proposedHandle: z.string().min(3),
  proposedName: z.string().min(2).max(80),
  proposedKind: z.nativeEnum(ChannelKind),
  // Where we can verify their content — at least one platform (enforced
  // below for non-admins). YouTube doubles as the library-ingestion source.
  youtubeChannelId: z.string().optional(),
  instagramHandle: socialHandle,
  tiktokHandle: socialHandle,
  xHandle: socialHandle,
  ministryStatement: z.string().min(50).max(5000),
  // Clause keys being affirmed in this request. Affirmation is per-clause
  // and deliberate — the client sends each clause the user actually checked.
  affirmClauses: z.array(z.string()).default([]),
  agreeConduct: z.boolean().default(false),
  // Founding-cohort invitation code — redeeming one waives the vouch minimum.
  inviteCode: z.string().max(40).optional(),
});

// Applicants must give us at least one place to verify their content.
const PublicBodySchema = BodySchema.refine(
  (body) =>
    [body.youtubeChannelId, body.instagramHandle, body.tiktokHandle, body.xHandle].some(
      (value) => value && value.trim().length > 0,
    ),
  {
    message:
      "Give us at least one place to verify your content — YouTube, Instagram, TikTok, or X.",
    path: ["youtubeChannelId"],
  },
);

// Admins get to skip the essay and the socials — they file throwaway
// applications to test the review pipeline. Handle/name/kind stay required:
// approval creates a real channel from them.
const AdminBodySchema = BodySchema.extend({
  ministryStatement: z.string().max(5000).default(""),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const schema = (await isAdminUser()) ? AdminBodySchema : PublicBodySchema;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const handleCheck = validateHandle(body.proposedHandle);
  if (!handleCheck.valid) {
    return NextResponse.json({ error: handleCheck.error }, { status: 400 });
  }

  const statement = await currentStatement();
  if (!statement) {
    return NextResponse.json({ error: "No published statement." }, { status: 503 });
  }

  // Ensure the User row exists (Clerk webhook provisioning lands later).
  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@placeholder.invalid`;
  await db.user.upsert({
    where: { id: userId },
    create: { id: userId, email, name: clerkUser?.fullName ?? null },
    update: {},
  });

  const existing = await db.creatorApplication.findFirst({
    where: { userId, status: { in: [ApplicationStatus.DRAFT, ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW] } },
  });
  if (existing && existing.status !== ApplicationStatus.DRAFT) {
    return NextResponse.json(
      { error: "Application is already under review." },
      { status: 409 },
    );
  }

  const data = {
    proposedHandle: body.proposedHandle,
    proposedName: body.proposedName,
    proposedKind: body.proposedKind,
    youtubeChannelId: body.youtubeChannelId || null,
    instagramHandle: body.instagramHandle || null,
    tiktokHandle: body.tiktokHandle || null,
    xHandle: body.xHandle || null,
    ministryStatement: body.ministryStatement,
    ...(body.agreeConduct ? { conductAgreedAt: new Date() } : {}),
  };

  let application = existing
    ? await db.creatorApplication.update({ where: { id: existing.id }, data })
    : await db.creatorApplication.create({ data: { userId, ...data } });

  // Redeem a founding-cohort invite code (usage counted at redemption; an
  // invalid code never blocks saving the draft — it's reported back instead).
  let inviteCodeError: string | undefined;
  if (body.inviteCode && !application.inviteCodeId) {
    const code = await db.inviteCode.findUnique({
      where: { code: normalizeInviteCode(body.inviteCode) },
    });
    const check = code
      ? inviteCodeUsable(code)
      : { usable: false, reason: "Unknown invitation code." };
    if (!code || !check.usable) {
      inviteCodeError = check.reason;
    } else {
      [application] = await db.$transaction([
        db.creatorApplication.update({
          where: { id: application.id },
          data: { inviteCodeId: code.id },
        }),
        db.inviteCode.update({
          where: { id: code.id },
          data: { usageCount: { increment: 1 } },
        }),
      ]);
    }
  }

  // Record affirmations for known clauses (idempotent per user+clause).
  const known = new Map(statement.clauses.map((c) => [c.key, c.id]));
  for (const key of body.affirmClauses) {
    const clauseId = known.get(key);
    if (!clauseId) continue;
    await db.affirmationRecord.upsert({
      where: { userId_clauseId: { userId, clauseId } },
      create: { userId, clauseId, statementVersionId: statement.id },
      update: {},
    });
  }

  const affirmations = await db.affirmationRecord.findMany({
    where: { userId, statementVersionId: statement.id },
    select: { clause: { select: { key: true } } },
  });

  return NextResponse.json({
    application,
    ...(inviteCodeError ? { inviteCodeError } : {}),
    affirmation: affirmationComplete(
      statement.clauses.map((c) => c.key),
      affirmations.map((a) => a.clause.key),
    ),
  });
}
