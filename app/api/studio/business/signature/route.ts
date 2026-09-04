import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";

// The creator's stored digital signature (first-visit modal): a PNG
// data-URL — generated cursive or hand-drawn — reused on every contract.

const BodySchema = z.object({
  channelId: z.string().min(1),
  name: z.string().min(2).max(200),
  signature: z.string().startsWith("data:image/png").max(500_000),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { channelId, name, signature } = parsed.data;

  const access = await getChannelAccess(userId, channelId);
  if (!access.channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  if (!access.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.channel.update({
    where: { id: channelId },
    data: { digitalSignature: signature, digitalSignatureName: name.trim() },
  });
  return NextResponse.json({ ok: true });
}
