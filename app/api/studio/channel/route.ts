import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { validateLinks, validateProfile } from "@/lib/channel-settings";
import { db } from "@/lib/db";
import { canonicalChannelInput } from "@/lib/youtube-api";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

const BodySchema = z.object({
  channelId: z.string().min(1),
  name: z.string().max(120).optional(),
  bio: z.string().max(4000).optional(),
  links: z.record(z.string(), z.string().max(400)).optional(),
  youtubeChannelId: z.string().max(120).nullable().optional(),
});

// Channel profile settings — owner, or team staff with settings:manager.
export async function PATCH(req: Request) {
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

  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  if (body.name !== undefined || body.bio !== undefined) {
    const profile = validateProfile({
      name: body.name ?? access.channel.name,
      bio: body.bio ?? "",
    });
    if (!profile.ok) errors.push(...profile.errors);
    if (body.name !== undefined) data.name = body.name.trim();
    if (body.bio !== undefined) data.bio = body.bio.trim() || null;
  }
  if (body.links !== undefined) {
    const checked = validateLinks(body.links);
    if (checked.errors.length > 0) errors.push(...checked.errors);
    else data.links = checked.links;
  }
  if (body.youtubeChannelId !== undefined) {
    const raw = body.youtubeChannelId?.trim();
    let nextValue: string | null | undefined;
    if (!raw) {
      nextValue = null;
    } else {
      // Accepts @handle, UC… id, or a channel URL; stored canonically so
      // ingestion can always resolve it.
      const canonical = canonicalChannelInput(raw);
      if (!canonical) {
        errors.push(
          "YouTube channel not recognized — use the @handle, the UC… channel id, or the channel's URL.",
        );
      } else {
        nextValue = canonical;
      }
    }
    if (nextValue !== undefined && nextValue !== access.channel.youtubeChannelId) {
      // Relinking to a different channel voids the previous ownership proof.
      data.youtubeChannelId = nextValue;
      data.youtubeVerifiedAt = null;
      data.youtubeVerifiedVia = null;
      data.youtubeVerifyToken = null;
    }
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: "Invalid settings", details: errors }, { status: 422 });
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  try {
    const channel = await db.channel.update({
      where: { id: body.channelId },
      data,
    });
    return NextResponse.json({ channel });
  } catch (err) {
    // Unique constraint on youtubeChannelId — already claimed by another channel.
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "That YouTube channel is already linked to another CF channel." },
        { status: 409 },
      );
    }
    throw err;
  }
}
