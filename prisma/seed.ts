// Seed runner — idempotent, upserts by slug, safe to re-run.
// Data lives in prisma/seed-data.ts (validated by tests/seed-data.test.ts).

import { PrismaClient } from "@prisma/client";
import { QUESTIONS, START_HERE_STEPS, TOPICS } from "./seed-data";

const db = new PrismaClient();

async function main() {
  // Topics
  const topicIds = new Map<string, string>();
  for (const [index, topic] of TOPICS.entries()) {
    const row = await db.topic.upsert({
      where: { slug: topic.slug },
      create: { slug: topic.slug, name: topic.name, sortOrder: index },
      update: { name: topic.name, sortOrder: index },
    });
    topicIds.set(topic.slug, row.id);
  }

  // Questions + positions
  for (const [index, question] of QUESTIONS.entries()) {
    const row = await db.question.upsert({
      where: { slug: question.slug },
      create: {
        slug: question.slug,
        title: question.title,
        tier: question.tier,
        framing: question.framing,
        topicId: topicIds.get(question.topic),
        sortOrder: index,
      },
      update: {
        title: question.title,
        tier: question.tier,
        framing: question.framing,
        topicId: topicIds.get(question.topic),
        sortOrder: index,
      },
    });
    for (const [pIndex, position] of question.positions.entries()) {
      await db.position.upsert({
        where: { questionId_slug: { questionId: row.id, slug: position.slug } },
        create: {
          questionId: row.id,
          slug: position.slug,
          name: position.name,
          summary: position.summary,
          sortOrder: pIndex,
        },
        update: { name: position.name, summary: position.summary, sortOrder: pIndex },
      });
    }
  }

  // Start Here pathway (unpublished until steps have content attached)
  const pathway = await db.pathway.upsert({
    where: { slug: "start-here" },
    create: {
      slug: "start-here",
      title: "Start Here",
      description: "The essentials of the faith, in order, for new believers.",
      published: false,
    },
    update: {},
  });
  for (const [index, step] of START_HERE_STEPS.entries()) {
    await db.pathwayStep.upsert({
      where: { pathwayId_sortOrder: { pathwayId: pathway.id, sortOrder: index } },
      create: {
        pathwayId: pathway.id,
        sortOrder: index,
        title: step.title,
        description: step.description,
      },
      update: { title: step.title, description: step.description },
    });
  }

  console.log(
    `Seeded ${TOPICS.length} topics, ${QUESTIONS.length} questions, ${START_HERE_STEPS.length} pathway steps.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
