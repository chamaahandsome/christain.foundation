import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminUser } from "@/lib/admin";
import { startHereDepthKeys, startHereTopics } from "@/lib/start-here";
import { saveDepthOverride } from "@/lib/start-here-depth";

// Admins switch a Start Here item between milk and meat. The file keeps
// each item's first label; this records the override the pages read, so a
// switch shows on the next load with no redeploy.

const BodySchema = z.object({
  key: z.string().min(1).max(200),
  depth: z.enum(["milk", "meat"]),
});

export async function POST(req: Request) {
  if (!(await isAdminUser())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { key, depth } = parsed.data;

  // Only items actually on the pathway can be relabelled.
  if (!startHereDepthKeys({ topics: startHereTopics() }).has(key)) {
    return NextResponse.json({ error: "Unknown Start Here item" }, { status: 404 });
  }

  try {
    await saveDepthOverride({ key, depth, userId });
  } catch (err) {
    // Almost always the database not being ready for switches: a server
    // started before `prisma generate` added the override table (the dev
    // client is cached on globalThis, so hot reload won't fix it), or a
    // production database that hasn't had `prisma db push`.
    console.error("start-here depth: save failed", err);
    return NextResponse.json(
      {
        error:
          "Couldn't save — the database isn't ready for label switches. Restart the server after `prisma generate`, or run `prisma db push`.",
      },
      { status: 503 },
    );
  }
  revalidatePath("/start", "layout");
  return NextResponse.json({ key, depth });
}
