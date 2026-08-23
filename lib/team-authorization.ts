// Server-side channel authorization (ported from Maltivas
// lib/team-authorization.ts, adapted to Channel/TeamMember). Owners hold
// manager on everything; active team members are checked against their
// per-feature access map. Pure access rules live in lib/team.ts (tested).

import { db } from "@/lib/db";
import {
  ACCESS_LEVELS,
  OWNER_ACCESS,
  parseFeatureAccess,
  hasFeatureAccess,
  type AccessLevel,
  type Feature,
  type FeatureAccessMap,
} from "@/lib/team";

export interface ChannelAccess {
  authorized: boolean;
  isOwner: boolean;
  isTeamMember: boolean;
  featureAccess: FeatureAccessMap;
  channel: {
    id: string;
    ownerId: string;
    name: string;
    handle: string;
    status: string;
    youtubeChannelId: string | null;
    youtubeVerifiedAt: Date | null;
  } | null;
}

const DENIED: ChannelAccess = {
  authorized: false,
  isOwner: false,
  isTeamMember: false,
  featureAccess: {},
  channel: null,
};

/** Check what a user may do on a channel, optionally requiring a feature at a
 * minimum level. Without a feature, any owner/active-member relationship
 * authorizes (useful for "can see the studio surface at all"). */
export async function getChannelAccess(
  userId: string,
  channelId: string,
  feature?: Feature,
  minLevel: AccessLevel = ACCESS_LEVELS.VIEWER,
): Promise<ChannelAccess> {
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      ownerId: true,
      name: true,
      handle: true,
      status: true,
      youtubeChannelId: true,
      youtubeVerifiedAt: true,
    },
  });
  if (!channel) return DENIED;

  if (channel.ownerId === userId) {
    return {
      authorized: true,
      isOwner: true,
      isTeamMember: false,
      featureAccess: OWNER_ACCESS,
      channel,
    };
  }

  const membership = await db.teamMember.findFirst({
    where: { channelId, userId, status: "ACTIVE" },
    select: { featureAccess: true },
  });
  if (!membership) return { ...DENIED, channel };

  const featureAccess = parseFeatureAccess(membership.featureAccess);
  const authorized = feature
    ? hasFeatureAccess(featureAccess, feature, minLevel)
    : true;

  return { authorized, isOwner: false, isTeamMember: true, featureAccess, channel };
}

/** All channels a user can work in: owned, plus active team memberships. */
export async function getAccessibleChannels(userId: string) {
  const [owned, memberships] = await Promise.all([
    db.channel.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { contentItems: true, followers: true } } },
    }),
    db.teamMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        channel: {
          include: { _count: { select: { contentItems: true, followers: true } } },
        },
      },
    }),
  ]);

  return {
    owned,
    managing: memberships.map((m) => ({
      channel: m.channel,
      featureAccess: parseFeatureAccess(m.featureAccess),
    })),
  };
}
