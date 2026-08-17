import { auth } from "@clerk/nextjs/server";
import { NotificationType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { teamInviteNotification } from "@/lib/notify";
import {
  ACCESS_LEVELS,
  FEATURES,
  generateInviteToken,
  invitationExpiry,
  parseFeatureAccess,
} from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

// Channel team management (PLAN §4, ported from Maltivas /api/team/*).
// Mutations are owner-only, as in Maltivas (assertOwnership): delegated team
// managers could otherwise escalate their own access. Team members with
// "team" viewer access may read the roster.

const FeatureAccessSchema = z.record(z.string(), z.string());

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const channelId = new URL(req.url).searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }

  const access = await getChannelAccess(userId, channelId, FEATURES.TEAM);
  if (!access.channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!access.isOwner && !access.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await db.teamMember.findMany({
    where: { channelId },
    orderBy: { invitedAt: "asc" },
    select: {
      id: true,
      email: true,
      userId: true,
      user: { select: { name: true, imageUrl: true } },
      featureAccess: true,
      status: true,
      invitedAt: true,
      acceptedAt: true,
      inviteToken: access.isOwner, // the accept link is owner-visible only
      inviteExpiresAt: true,
    },
  });

  return NextResponse.json({ members, isOwner: access.isOwner });
}

const InviteSchema = z.object({
  channelId: z.string().min(1),
  email: z.string().email(),
  featureAccess: FeatureAccessSchema.default({}),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = InviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const access = await getChannelAccess(userId, body.channelId);
  if (!access.channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!access.isOwner) {
    return NextResponse.json(
      { error: "Only the channel owner can manage the team." },
      { status: 403 },
    );
  }

  const email = body.email.trim().toLowerCase();
  if (email === (await db.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email?.toLowerCase()) {
    return NextResponse.json(
      { error: "You already own this channel." },
      { status: 400 },
    );
  }

  const featureAccess = parseFeatureAccess(body.featureAccess);
  const hasAnyAccess = Object.values(featureAccess).some(
    (level) => level !== ACCESS_LEVELS.NONE,
  );
  if (!hasAnyAccess) {
    return NextResponse.json(
      { error: "Grant at least one feature before inviting." },
      { status: 400 },
    );
  }

  const existing = await db.teamMember.findUnique({
    where: { channelId_email: { channelId: body.channelId, email } },
  });
  if (existing && existing.status === "ACTIVE") {
    return NextResponse.json(
      { error: "This person is already on the team. Edit their access instead." },
      { status: 409 },
    );
  }

  const token = generateInviteToken();
  const expiry = invitationExpiry(new Date());
  const data = {
    featureAccess,
    status: "PENDING" as const,
    inviteToken: token,
    inviteExpiresAt: expiry,
    invitedById: userId,
    invitedAt: new Date(),
    acceptedAt: null,
    userId: null,
  };

  const member = existing
    ? await db.teamMember.update({ where: { id: existing.id }, data })
    : await db.teamMember.create({
        data: { channelId: body.channelId, email, ...data },
      });

  // No transactional email yet (SES lands with the newsletter port) — the
  // owner copies the accept link from the roster. If the invitee already has
  // a CF account, they also get an in-app notification.
  const invitee = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (invitee) {
    const planned = teamInviteNotification({
      channelName: access.channel.name,
      token,
    });
    await db.notification.create({
      data: {
        userId: invitee.id,
        type: NotificationType.TEAM_INVITE,
        title: planned.title,
        body: planned.body ?? null,
        url: planned.url,
      },
    });
  }

  return NextResponse.json({ member, acceptPath: `/team/accept/${token}` });
}

const UpdateSchema = z.object({
  memberId: z.string().min(1),
  featureAccess: FeatureAccessSchema.optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = UpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const member = await db.teamMember.findUnique({
    where: { id: body.memberId },
    select: { id: true, channelId: true, status: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  }

  const access = await getChannelAccess(userId, member.channelId);
  if (!access.isOwner) {
    return NextResponse.json(
      { error: "Only the channel owner can manage the team." },
      { status: 403 },
    );
  }
  if (body.status && member.status === "PENDING") {
    return NextResponse.json(
      { error: "Pending invitations can't change status — re-invite or remove." },
      { status: 409 },
    );
  }

  const updated = await db.teamMember.update({
    where: { id: member.id },
    data: {
      ...(body.featureAccess
        ? { featureAccess: parseFeatureAccess(body.featureAccess) }
        : {}),
      ...(body.status ? { status: body.status } : {}),
    },
  });

  return NextResponse.json({ member: updated });
}

const RemoveSchema = z.object({ memberId: z.string().min(1) });

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = RemoveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const member = await db.teamMember.findUnique({
    where: { id: parsed.data.memberId },
    select: { id: true, channelId: true },
  });
  if (!member) {
    return NextResponse.json({ error: "Team member not found." }, { status: 404 });
  }

  const access = await getChannelAccess(userId, member.channelId);
  if (!access.isOwner) {
    return NextResponse.json(
      { error: "Only the channel owner can manage the team." },
      { status: 403 },
    );
  }

  await db.teamMember.delete({ where: { id: member.id } });
  return NextResponse.json({ removed: true });
}
