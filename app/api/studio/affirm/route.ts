import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { affirmationComplete } from "@/lib/gate";

const BodySchema = z.object({
  affirmClauses: z.array(z.string()).min(1),
});

// Re-affirmation on statement change (PLAN §4: re-affirmation required on
// material change). Same per-clause, deliberate mechanics as the original
// application; records are append-only — a new statement version means new
// rows, never edits to the old signature.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const statement = await db.statementVersion.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { version: "desc" },
    include: { clauses: { select: { id: true, key: true } } },
  });
  if (!statement) {
    return NextResponse.json({ error: "No published statement." }, { status: 503 });
  }

  const known = new Map(statement.clauses.map((c) => [c.key, c.id]));
  for (const key of parsed.data.affirmClauses) {
    const clauseId = known.get(key);
    if (!clauseId) continue;
    await db.affirmationRecord.upsert({
      where: { userId_clauseId: { userId, clauseId } },
      create: { userId, clauseId, statementVersionId: statement.id },
      update: {},
    });
  }

  const affirmations = await db.affirmationRecord.findMany({
    where: { userId, statementVersionId: statement.id },
    select: { clause: { select: { key: true } } },
  });

  return NextResponse.json({
    affirmation: affirmationComplete(
      statement.clauses.map((c) => c.key),
      affirmations.map((a) => a.clause.key),
    ),
  });
}
