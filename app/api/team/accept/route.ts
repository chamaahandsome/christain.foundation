import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { canAcceptInvitation } from "@/lib/team";

const BodySchema = z.object({ token: z.string().min(16) });

// Accept a team invitation (ported from Maltivas POST /api/team/accept).
// The invited email must match one of the signed-in user's addresses —
// invitation links are addressed, not bearer instruments.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const member = await db.teamMember.findUnique({
    where: { inviteToken: parsed.data.token },
    include: { channel: { select: { handle: true, name: true } } },
  });
  if (!member) {
    return NextResponse.json({ error: "Invitation not found." }, { status: 404 });
  }

  const clerkUser = await currentUser();
  const userEmails = (clerkUser?.emailAddresses ?? []).map((e) => e.emailAddress);
  // Match against every address on the account, not just the primary
  // (Maltivas behavior — people get invited at their ministry address).
  const matching = userEmails.find(
    (email) => email.trim().toLowerCase() === member.email.trim().toLowerCase(),
  );

  const check = canAcceptInvitation({
    status: member.status,
    inviteExpiresAt: member.inviteExpiresAt,
    invitedEmail: member.email,
    userEmail: matching ?? userEmails[0] ?? "",
  });
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: 403 });
  }

  // Ensure the User row exists before binding it.
  await db.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: userEmails[0] ?? `${userId}@placeholder.invalid`,
      name: clerkUser?.fullName ?? null,
    },
    update: {},
  });

  const accepted = await db.teamMember.update({
    where: { id: member.id },
    data: {
      userId,
      status: "ACTIVE",
      acceptedAt: new Date(),
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  return NextResponse.json({
    member: accepted,
    channel: member.channel,
    redirectTo: "/studio",
  });
}
