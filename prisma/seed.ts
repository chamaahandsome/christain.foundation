// Seed runner — idempotent, upserts by slug, safe to re-run.
// Data lives in prisma/seed-data.ts (validated by tests/seed-data.test.ts).

import { PrismaClient } from "@prisma/client";
import {
  QUESTIONS,
  START_HERE_STEPS,
  STATEMENT_CLAUSES,
  STATEMENT_PREAMBLE,
  STATEMENT_VERSION,
  TOPICS,
} from "./seed-data";

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

  // Doctrinal statement (the creator gate, concept §5)
  const statement = await db.statementVersion.upsert({
    where: { version: STATEMENT_VERSION },
    create: {
      version: STATEMENT_VERSION,
      title: "The Christian Foundation Doctrinal Statement",
      preamble: STATEMENT_PREAMBLE,
      publishedAt: new Date(),
    },
    update: { preamble: STATEMENT_PREAMBLE },
  });
  for (const [index, clause] of STATEMENT_CLAUSES.entries()) {
    await db.statementClause.upsert({
      where: {
        statementVersionId_key: {
          statementVersionId: statement.id,
          key: clause.key,
        },
      },
      create: {
        statementVersionId: statement.id,
        key: clause.key,
        title: clause.title,
        text: clause.text,
        sortOrder: index,
      },
      update: { title: clause.title, text: clause.text, sortOrder: index },
    });
  }

  console.log(
    `Seeded ${TOPICS.length} topics, ${QUESTIONS.length} questions, ${START_HERE_STEPS.length} pathway steps, statement v${STATEMENT_VERSION} with ${STATEMENT_CLAUSES.length} clauses.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
