import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { s3Configured, safeFileName, uploadPublicObject } from "@/lib/s3";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

// Image upload to the shared Maltivas S3 bucket (covers and other channel
// imagery). Multipart in, public URL out — the Maltivas pattern.

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!s3Configured()) {
    return NextResponse.json(
      { error: "Image uploads aren't configured on this environment yet." },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const channelId = form?.get("channelId");
  const file = form?.get("file");
  if (typeof channelId !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "channelId and file are required." }, { status: 400 });
  }

  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.LIBRARY,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }
  if (!access.authorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Use a PNG, JPEG, WebP, or GIF image." },
      { status: 422 },
    );
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image is over the 5MB limit." }, { status: 413 });
  }

  try {
    const url = await uploadPublicObject({
      key: `covers/${channelId}/${Date.now()}-${safeFileName(file.name)}`,
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("s3 upload failed", err);
    return NextResponse.json(
      { error: "Upload failed. Try again shortly." },
      { status: 502 },
    );
  }
}
