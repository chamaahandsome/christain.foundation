import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { pathwayProgress } from "@/lib/map";
import { thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Start Here",
  description:
    "New to the faith? Start here: who Jesus is, what the gospel is, what the resurrection means — laid out clearly, in order.",
};

export default async function StartHerePage() {
  const pathway = await db.pathway
    .findFirst({
      where: { slug: "start-here", published: true },
      include: {
        steps: {
          orderBy: { sortOrder: "asc" },
          include: {
            contentItem: {
              select: { id: true, title: true, youtubeVideoId: true },
            },
          },
        },
      },
    })
    .catch(() => null);

  let completedIds = new Set<string>();
  if (pathway && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    const { userId } = await auth();
    if (userId) {
      const rows = await db.pathwayProgress.findMany({
        where: { userId, stepId: { in: pathway.steps.map((s) => s.id) } },
        select: { stepId: true },
      });
      completedIds = new Set(rows.map((r) => r.stepId));
    }
  }

  const summary = pathway
    ? pathwayProgress(
        pathway.steps.map((s) => s.id),
        completedIds,
      )
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Start Here</h1>
      <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        If you came to faith last week and you're asking “where do I start?” —
        this is the path. The essentials, in order, laid out clearly and
        confidently.
      </p>

      {!pathway ? (
        <p className="mt-10 text-sm text-neutral-500">
          The pathway is being prepared. Check back soon.
        </p>
      ) : (
        <>
          {summary && summary.total > 0 && (
            <div className="mt-6">
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full bg-neutral-800 transition-all dark:bg-neutral-200"
                  style={{ width: `${summary.percent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-neutral-500">
                {summary.completed} of {summary.total} steps
                {summary.done && " — complete. Walk on."}
              </p>
            </div>
          )}

          <ol className="mt-8 space-y-4">
            {pathway.steps.map((step, index) => {
              const done = completedIds.has(step.id);
              const isNext = summary?.nextStepId === step.id;
              return (
                <li
                  key={step.id}
                  className={`rounded-xl border px-5 py-4 ${
                    isNext
                      ? "border-neutral-800 dark:border-neutral-200"
                      : "border-neutral-200 dark:border-neutral-800"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        done
                          ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
                      }`}
                    >
                      {done ? "✓" : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-medium">{step.title}</h2>
                      {step.description && (
                        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                          {step.description}
                        </p>
                      )}
                      {step.contentItem && (
                        <Link
                          href={`/watch/${step.contentItem.id}`}
                          className="group mt-3 flex items-center gap-3"
                        >
                          {step.contentItem.youtubeVideoId && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumbnailUrl(step.contentItem.youtubeVideoId, "mqdefault")}
                              alt=""
                              className="h-14 w-24 rounded-md object-cover"
                            />
                          )}
                          <span className="text-sm group-hover:underline">
                            {step.contentItem.title}
                          </span>
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </main>
  );
}
