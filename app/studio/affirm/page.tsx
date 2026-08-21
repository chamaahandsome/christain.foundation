import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { affirmationComplete } from "@/lib/gate";
import { AffirmForm } from "@/components/AffirmForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Re-affirm the statement" };

// Re-affirmation on statement change (PLAN §4). The signature is the gate:
// when the published statement materially changes, existing creators sign
// the new version the same way they signed the first — per clause,
// deliberately. Old records are never touched.
export default async function StudioAffirmPage() {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const statement = await db.statementVersion.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { version: "desc" },
    include: { clauses: { orderBy: { sortOrder: "asc" } } },
  });
  if (!statement) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-neutral-500">No published statement.</p>
      </main>
    );
  }

  const affirmations = await db.affirmationRecord.findMany({
    where: { userId, statementVersionId: statement.id },
    select: { clause: { select: { key: true } } },
  });
  const check = affirmationComplete(
    statement.clauses.map((c) => c.key),
    affirmations.map((a) => a.clause.key),
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        The creator gate
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {statement.title} — version {statement.version}
      </h1>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {statement.preamble}
      </p>
      {check.complete ? (
        <p className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          You have affirmed the current statement in full. Nothing to sign.
        </p>
      ) : (
        <AffirmForm
          clauses={statement.clauses.map(({ key, title, text }) => ({ key, title, text }))}
          missing={check.missing}
        />
      )}
    </main>
  );
}
