import Link from "next/link";
import { QuestionTier } from "@prisma/client";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "The Map",
  description:
    "The essentials of the faith, held with certainty — and the disputed questions, presented honestly. In essentials, unity. In non-essentials, liberty.",
};

export default async function MapPage() {
  const questions = await db.question
    .findMany({
      orderBy: [{ sortOrder: "asc" }],
      include: {
        topic: { select: { name: true } },
        _count: { select: { positions: true } },
      },
    })
    .catch(() => []);

  const spine = questions.filter((q) => q.tier === QuestionTier.SPINE);
  const disputed = questions.filter((q) => q.tier === QuestionTier.DISPUTED);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-semibold">The Map</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        Some things Christians cannot disagree on — on those you will find one
        confident answer. Others, faithful believers have disputed for
        centuries — on those you will find the strongest case for each view,
        side by side, and a plain account of what is actually at stake.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">The spine — the essentials</h2>
        <p className="mt-1 text-sm text-neutral-500">
          One confident answer. There is certainty here, because there is
          certainty here.
        </p>
        <ul className="mt-4 space-y-2">
          {spine.map((q) => (
            <li key={q.id}>
              <Link
                href={`/map/${q.slug}`}
                className="block rounded-xl border border-neutral-200 px-4 py-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <span className="font-medium">{q.title}</span>
                {q.topic && (
                  <span className="ml-2 text-xs text-neutral-500">{q.topic.name}</span>
                )}
              </Link>
            </li>
          ))}
          {spine.length === 0 && (
            <li className="text-sm text-neutral-500">The map is being drawn.</li>
          )}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">The map — disputed questions</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Held in genuine dispute among the faithful. Positions presented at
          their strongest — no strawmen.
        </p>
        <ul className="mt-4 space-y-2">
          {disputed.map((q) => (
            <li key={q.id}>
              <Link
                href={`/map/${q.slug}`}
                className="block rounded-xl border border-neutral-200 px-4 py-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
              >
                <span className="font-medium">{q.title}</span>
                <span className="ml-2 text-xs text-neutral-500">
                  {q._count.positions} positions
                </span>
              </Link>
            </li>
          ))}
          {disputed.length === 0 && (
            <li className="text-sm text-neutral-500">The map is being drawn.</li>
          )}
        </ul>
      </section>
    </main>
  );
}
