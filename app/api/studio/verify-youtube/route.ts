import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { resolveChannel } from "@/lib/youtube-api";
import {
  descriptionContainsToken,
  generateVerifyToken,
  googleAccountOwnsChannel,
  parseMineChannelIds,
} from "@/lib/youtube-verify";

const BodySchema = z.object({
  channelId: z.string().min(1),
  action: z.enum(["start", "check_description", "check_google"]),
});

// Prove the linked YouTube channel is actually yours (see lib/youtube-verify).
// Verification is channel-level state; settings:manager (or the owner) runs it.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const body = parsed.data;

  const access = await getChannelAccess(
    userId,
    body.channelId,
    FEATURES.SETTINGS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!access.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const channel = await db.channel.findUniqueOrThrow({
    where: { id: body.channelId },
    select: {
      id: true,
      youtubeChannelId: true,
      youtubeVerifyToken: true,
      youtubeVerifiedAt: true,
    },
  });
  if (!channel.youtubeChannelId) {
    return NextResponse.json(
      { error: "Link a YouTube channel in settings first." },
      { status: 400 },
    );
  }
  if (channel.youtubeVerifiedAt) {
    return NextResponse.json({ verified: true, alreadyVerified: true });
  }

  // ---- start: mint the description token ----
  if (body.action === "start") {
    const token = channel.youtubeVerifyToken ?? generateVerifyToken();
    if (!channel.youtubeVerifyToken) {
      await db.channel.update({
        where: { id: channel.id },
        data: { youtubeVerifyToken: token },
      });
    }
    return NextResponse.json({ token });
  }

  // ---- check_google: Clerk-held Google OAuth token → channels?mine=true ----
  if (body.action === "check_google") {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "YOUTUBE_API_KEY is not configured." },
        { status: 503 },
      );
    }
    const info = await resolveChannel(channel.youtubeChannelId, apiKey);
    if (!info) {
      return NextResponse.json(
        { error: "Could not resolve the linked YouTube channel." },
        { status: 422 },
      );
    }

    let accessToken: string | undefined;
    try {
      const client = await clerkClient();
      const tokens = await client.users.getUserOauthAccessToken(userId, "google");
      accessToken = tokens.data[0]?.token;
    } catch {
      accessToken = undefined;
    }
    if (!accessToken) {
      return NextResponse.json(
        {
          error:
            "No Google account is connected to your CF sign-in. Sign in with Google (or connect it in your account settings), then try again — or use the description method below.",
        },
        { status: 409 },
      );
    }

    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true&maxResults=50",
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        {
          error:
            "Your Google sign-in doesn't include YouTube access. Ask the CF team to enable the youtube.readonly scope, reconnect Google — or use the description method below.",
        },
        { status: 409 },
      );
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: `YouTube API failed (${res.status}). Try again shortly.` },
        { status: 502 },
      );
    }

    const owned = parseMineChannelIds(await res.json());
    if (!googleAccountOwnsChannel(owned, info.channelId)) {
      return NextResponse.json(
        {
          error:
            "That Google account doesn't own this channel. If the channel is a Brand Account, use the description method instead.",
        },
        { status: 403 },
      );
    }

    await db.channel.update({
      where: { id: channel.id },
      data: {
        youtubeVerifiedAt: new Date(),
        youtubeVerifiedVia: "google",
        youtubeVerifyToken: null,
      },
    });
    return NextResponse.json({ verified: true, via: "google" });
  }

  // ---- check_description: read the token back from the channel ----
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY is not configured." },
      { status: 503 },
    );
  }
  if (!channel.youtubeVerifyToken) {
    return NextResponse.json(
      { error: "Generate a verification code first." },
      { status: 400 },
    );
  }
  const info = await resolveChannel(channel.youtubeChannelId, apiKey);
  if (!info) {
    return NextResponse.json(
      { error: "Could not resolve the linked YouTube channel." },
      { status: 422 },
    );
  }
  if (!descriptionContainsToken(info.description, channel.youtubeVerifyToken)) {
    return NextResponse.json(
      {
        error:
          "Code not found in the channel description yet. YouTube can take a minute to update — save the description and try again.",
      },
      { status: 409 },
    );
  }

  await db.channel.update({
    where: { id: channel.id },
    data: {
      youtubeVerifiedAt: new Date(),
      youtubeVerifiedVia: "description",
      youtubeVerifyToken: null,
    },
  });
  return NextResponse.json({ verified: true, via: "description" });
}
