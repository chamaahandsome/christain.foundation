import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const BodySchema = z.object({
  channelId: z.string().min(1),
});

// Toggle follow on a channel. Returns the new state + follower count.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { channelId } = parsed.data;

  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { id: true, status: true },
  });
  if (!channel || channel.status !== "APPROVED") {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  // Ensure the User row exists (webhook provisioning lands later).
  const clerkUser = await currentUser();
  await db.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: clerkUser?.emailAddresses?.[0]?.emailAddress ?? `${userId}@placeholder.invalid`,
      name: clerkUser?.fullName ?? null,
    },
    update: {},
  });

  const existing = await db.follow.findUnique({
    where: { userId_channelId: { userId, channelId } },
  });

  let following: boolean;
  if (existing) {
    await db.follow.delete({ where: { userId_channelId: { userId, channelId } } });
    following = false;
  } else {
    await db.follow.create({ data: { userId, channelId } });
    following = true;
  }

  const followers = await db.follow.count({ where: { channelId } });
  return NextResponse.json({ following, followers });
}
