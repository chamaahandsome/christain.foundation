import { auth } from "@clerk/nextjs/server";
import { ApplicationStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  affirmationComplete,
  applicationTransition,
  canSubmitApplication,
} from "@/lib/gate";

// Submit the draft application for review. Blocks unless the statement is
// affirmed in full, conduct is agreed, and (outside founding-cohort mode)
// at least one approved creator has vouched.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const application = await db.creatorApplication.findFirst({
    where: { userId, status: ApplicationStatus.DRAFT },
    include: { _count: { select: { vouches: true } } },
  });
  if (!application) {
    return NextResponse.json({ error: "No draft application." }, { status: 404 });
  }

  const statement = await db.statementVersion.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { version: "desc" },
    include: { clauses: { select: { key: true } } },
  });
  if (!statement) {
    return NextResponse.json({ error: "No published statement." }, { status: 503 });
  }

  const affirmations = await db.affirmationRecord.findMany({
    where: { userId, statementVersionId: statement.id },
    select: { clause: { select: { key: true } } },
  });

  const check = canSubmitApplication({
    affirmation: affirmationComplete(
      statement.clauses.map((c) => c.key),
      affirmations.map((a) => a.clause.key),
    ),
    conductAgreed: application.conductAgreedAt !== null,
    vouchCount: application._count.vouches,
    invited: process.env.FOUNDING_COHORT_MODE === "true",
  });
  if (!check.ok) {
    return NextResponse.json({ error: "Not ready to submit", details: check.errors }, { status: 422 });
  }

  const updated = await db.creatorApplication.update({
    where: { id: application.id },
    data: {
      status: applicationTransition(application.status, "submit"),
      submittedAt: new Date(),
    },
  });

  return NextResponse.json({ application: updated });
}
