import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { caseTransition } from "@/lib/doctrine";

const BodySchema = z.object({
  caseId: z.string().min(1),
  note: z.string().min(10).max(5000),
});

// Appeal an upheld doctrine decision (§5.4). Appeal belongs to the accused:
// only the channel owner, only on an UPHELD case, and the appeal must argue
// the case — it goes back into the admin queue.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body (an appeal needs a note of at least 10 characters)." },
      { status: 400 },
    );
  }

  const reviewCase = await db.doctrineReviewCase.findUnique({
    where: { id: parsed.data.caseId },
    include: { channel: { select: { ownerId: true } } },
  });
  if (!reviewCase) {
    return NextResponse.json({ error: "Case not found." }, { status: 404 });
  }
  if (reviewCase.channel.ownerId !== userId) {
    return NextResponse.json(
      { error: "Only the channel owner can appeal." },
      { status: 403 },
    );
  }

  let nextStatus;
  try {
    nextStatus = caseTransition(reviewCase.status, "appeal");
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 409 });
  }

  const updated = await db.doctrineReviewCase.update({
    where: { id: reviewCase.id },
    data: { status: nextStatus, appealNote: parsed.data.note.trim() },
  });

  return NextResponse.json({ case: updated });
}
