import Link from "next/link";
import { startHereTopics } from "@/lib/start-here";

export const metadata = {
  title: "Start Here",
  description:
    "Fifteen questions every new believer asks, in the order worth asking them — answered with the clearest teaching we could find.",
};

export default function StartPage() {
  const topics = startHereTopics();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Start Here</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        You just came to faith — or you're close — and you're asking,{" "}
        <em>"where do I start?"</em> Here. Fifteen questions, in the order
        worth asking them. Take them at your own pace; each page hands you the
        next.
      </p>

      <ol className="mt-8 space-y-2">
        {topics.map((topic) => (
          <li key={topic.slug}>
            <Link
              href={`/start/${topic.slug}`}
              className="group flex items-center gap-4 rounded-xl border border-neutral-200 px-4 py-3 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                {topic.order}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium group-hover:underline">
                  {topic.question}
                </span>
              </span>
              {topic.tier === "open_question" && (
                <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  Open question
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
