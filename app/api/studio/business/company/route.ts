import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";

// Do-Biz company info — the letterhead details printed on invoices,
// quotes, and contracts (email + address; the logo has its own route).

const Schema = z.object({
  channelId: z.string().min(1),
  businessEmail: z.string().email().max(320).nullable().optional(),
  businessAddress: z.string().max(500).nullable().optional(),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { channelId, businessEmail, businessAddress } = parsed.data;
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.BUSINESS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel) return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  if (!access.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.channel.update({
    where: { id: channelId },
    data: {
      ...(businessEmail !== undefined ? { businessEmail } : {}),
      ...(businessAddress !== undefined
        ? { businessAddress: businessAddress?.trim() || null }
        : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
