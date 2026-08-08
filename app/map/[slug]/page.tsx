import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuestionTier, Visibility } from "@prisma/client";
import { db } from "@/lib/db";
import { thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

async function getQuestion(slug: string) {
  return db.question.findUnique({
    where: { slug },
    include: {
      topic: { select: { name: true, slug: true } },
      positions: {
        orderBy: { sortOrder: "asc" },
        include: {
          placements: {
            include: {
              contentItem: {
                select: {
                  id: true,
                  title: true,
                  youtubeVideoId: true,
                  visibility: true,
                  channel: { select: { name: true, handle: true, status: true } },
                },
              },
            },
          },
        },
      },
      placements: {
        include: {
          contentItem: {
            select: {
              id: true,
              title: true,
              youtubeVideoId: true,
              visibility: true,
              channel: { select: { name: true, handle: true, status: true } },
            },
          },
        },
      },
    },
  });
}

type PlacedContent = {
  id: string;
  title: string;
  youtubeVideoId: string | null;
  visibility: Visibility;
  channel: { name: string; handle: string; status: string };
};

function visible(item: PlacedContent | null | undefined): item is PlacedContent {
  return Boolean(
    item &&
      item.visibility === Visibility.PUBLIC &&
      item.channel.status === "APPROVED" &&
      item.youtubeVideoId,
  );
}

function ContentGrid({ items }: { items: PlacedContent[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-neutral-500">Content is being gathered.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/watch/${item.id}`} className="group block">
            {item.youtubeVideoId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl(item.youtubeVideoId, "mqdefault")}
                alt=""
                className="aspect-video w-full rounded-lg object-cover"
              />
            )}
            <p className="mt-2 line-clamp-2 text-sm group-hover:underline">
              {item.title}
            </p>
            <p className="text-xs text-neutral-500">{item.channel.name}</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const question = await getQuestion(slug).catch(() => null);
  if (!question) return {};
  return { title: question.title, description: question.framing.slice(0, 160) };
}

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const question = await getQuestion(slug).catch(() => null);
  if (!question) notFound();

  const isSpine = question.tier === QuestionTier.SPINE;
  const questionContent = question.placements
    .map((p) => p.contentItem)
    .filter(visible);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs uppercase tracking-widest text-neutral-500">
        {isSpine ? "The spine — essential" : "Disputed among the faithful"}
        {question.topic && <> · {question.topic.name}</>}
      </p>
      <h1 className="mt-2 text-3xl font-semibold">{question.title}</h1>
      <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {question.framing}
      </p>

      {isSpine ? (
        // Spine: one confident answer — a single teaching path, no
        // both-sides framing (concept §4).
        <section className="mt-10">
          <ContentGrid
            items={[
              ...questionContent,
              ...question.positions.flatMap((pos) =>
                pos.placements.map((p) => p.contentItem).filter(visible),
              ),
            ]}
          />
        </section>
      ) : (
        // Disputed: positions side by side, each at its strongest.
        <div className="mt-10 space-y-10">
          {question.positions.map((position) => (
            <section key={position.id}>
              <h2 className="text-xl font-semibold">{position.name}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
                {position.summary}
              </p>
              <div className="mt-4">
                <ContentGrid
                  items={position.placements.map((p) => p.contentItem).filter(visible)}
                />
              </div>
            </section>
          ))}
          {questionContent.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold">Understanding the question</h2>
              <div className="mt-4">
                <ContentGrid items={questionContent} />
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
