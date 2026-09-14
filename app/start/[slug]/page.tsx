import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StartHerePathway } from "@/components/StartHerePathway";
import { StartHereFrame } from "@/components/StartHereFrame";
import { isAdminUser } from "@/lib/admin";
import {
  applyDepthOverrides,
  getStartHereTopic,
  startHereTopics,
} from "@/lib/start-here";
import { loadDepthOverrides } from "@/lib/start-here-depth";

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

  // Milk/meat: the file's labels with any admin switches laid over them,
  // and whether this viewer may switch them.
  const [overrides, canEditDepth] = await Promise.all([
    loadDepthOverrides(),
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? isAdminUser() : Promise.resolve(false),
  ]);

  return (
    <StartHereFrame>
      <StartHerePathway
        topics={applyDepthOverrides(startHereTopics(), overrides)}
        initialSlug={slug}
        canEditDepth={canEditDepth}
      />
    </StartHereFrame>
  );
}
