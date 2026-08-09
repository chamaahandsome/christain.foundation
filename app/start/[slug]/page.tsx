import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StartHereVideoCard } from "@/components/StartHereVideoCard";
import {
  getStartHereTopic,
  isPlaceholderVideo,
  startHereTopics,
} from "@/lib/start-here";

export function generateStaticParams() {
  return startHereTopics().map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = getStartHereTopic(slug);
  if (!topic) return {};
  return { title: topic.question, description: topic.framing.slice(0, 160) };
}

export default async function StartTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = getStartHereTopic(slug);
  if (!topic) notFound();

  const topics = startHereTopics();
  const nextTopic = topic.next ? getStartHereTopic(topic.next) : null;
  const videos = [...topic.videos].sort((a, b) => a.order - b.order);
  const curated = videos.filter((video) => !isPlaceholderVideo(video));
  const isEssential = topic.tier === "essential";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {/* 1. Progress strip */}
      <nav aria-label="Pathway progress" className="mb-8 flex flex-wrap gap-1.5">
        {topics.map((t) => (
          <Link
            key={t.slug}
            href={`/start/${t.slug}`}
            aria-current={t.slug === topic.slug ? "page" : undefined}
            title={t.question}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
              t.slug === topic.slug
                ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
            }`}
          >
            {t.order}
          </Link>
        ))}
      </nav>

      {/* 2. Tier badge + note */}
      <p className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            isEssential
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
              : "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
          }`}
        >
          {isEssential ? "Essential" : "Open question"}
        </span>
        <span className="text-xs text-neutral-500">{topic.tier_note}</span>
      </p>

      {/* 3. Question */}
      <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {topic.question}
      </h1>

      {/* 4. Framing — the value-add, body size, prominent */}
      <p className="mt-5 text-pretty text-base leading-7 text-neutral-700 dark:text-neutral-300">
        {topic.framing}
      </p>

      {/* 5. Videos */}
      <div className="mt-8 space-y-4">
        {curated.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            The teaching for this question is being hand-picked. Check back
            soon.
          </p>
        ) : (
          curated.map((video) => (
            <StartHereVideoCard key={`${video.youtube_id}-${video.order}`} video={video} />
          ))
        )}
      </div>

      {/* 6. Attribution + next */}
      <p className="mt-8 text-xs leading-5 text-neutral-400">
        These videos are hosted on YouTube and belong to their creators.
        Christian Foundation selected them editorially and is not affiliated
        with or endorsed by the creators.
      </p>

      <div className="mt-6">
        {nextTopic ? (
          <Link
            href={`/start/${nextTopic.slug}`}
            className="group flex items-center justify-between rounded-2xl border border-neutral-200 px-5 py-4 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <span>
              <span className="block text-xs uppercase tracking-widest text-neutral-500">
                Next question
              </span>
              <span className="mt-1 block font-medium group-hover:underline">
                {nextTopic.question}
              </span>
            </span>
            <span aria-hidden className="text-xl text-neutral-400 transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        ) : (
          <Link
            href="/map"
            className="group flex items-center justify-between rounded-2xl border border-neutral-200 px-5 py-4 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
          >
            <span>
              <span className="block text-xs uppercase tracking-widest text-neutral-500">
                You've walked the pathway
              </span>
              <span className="mt-1 block font-medium group-hover:underline">
                Now explore the map — the questions the faithful still discuss
              </span>
            </span>
            <span aria-hidden className="text-xl text-neutral-400 transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        )}
      </div>
    </main>
  );
}
