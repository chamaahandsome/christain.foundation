import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StartHerePathway } from "@/components/StartHerePathway";
import { getStartHereTopic, startHereTopics } from "@/lib/start-here";

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

// Server shell for deep links and SEO; the pathway itself is a client-side
// tabbed experience (pills / Back / Next swap topics in place).
export default async function StartTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getStartHereTopic(slug)) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <StartHerePathway topics={startHereTopics()} initialSlug={slug} />
    </main>
  );
}
