import { describe, expect, it } from "vitest";
import { QuestionTier } from "@prisma/client";
import { QUESTIONS, START_HERE_STEPS, TOPICS } from "@/prisma/seed-data";
import { validateQuestionPositions } from "@/lib/map";

// The seeded map must obey the concept §4 rules encoded in lib/map.ts —
// a seed that violates them would put the product core in an invalid state.

describe("seeded doctrinal map", () => {
  it("every question satisfies the spine/disputed position rules", () => {
    for (const question of QUESTIONS) {
      const result = validateQuestionPositions(
        question.tier,
        question.positions.length,
      );
      expect(result.valid, `${question.slug}: ${result.error ?? ""}`).toBe(true);
    }
  });

  it("contains both spine and disputed questions", () => {
    const tiers = new Set(QUESTIONS.map((q) => q.tier));
    expect(tiers.has(QuestionTier.SPINE)).toBe(true);
    expect(tiers.has(QuestionTier.DISPUTED)).toBe(true);
  });

  it("origins is disputed, not spine (concept §4: explicitly non-essential)", () => {
    const origins = QUESTIONS.find((q) => q.slug === "origins");
    expect(origins).toBeDefined();
    expect(origins!.tier).toBe(QuestionTier.DISPUTED);
    expect(origins!.positions.length).toBeGreaterThanOrEqual(2);
  });

  it("question and topic slugs are unique and well-formed", () => {
    const slugs = QUESTIONS.map((q) => q.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const topicSlugs = TOPICS.map((t) => t.slug);
    expect(new Set(topicSlugs).size).toBe(topicSlugs.length);
    for (const slug of [...slugs, ...topicSlugs]) {
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  it("position slugs are unique within each question", () => {
    for (const question of QUESTIONS) {
      const slugs = question.positions.map((p) => p.slug);
      expect(new Set(slugs).size, question.slug).toBe(slugs.length);
    }
  });

  it("every question references a seeded topic", () => {
    const topicSlugs = new Set(TOPICS.map((t) => t.slug));
    for (const question of QUESTIONS) {
      expect(topicSlugs.has(question.topic), question.slug).toBe(true);
    }
  });

  it("every question and position carries substantive framing", () => {
    for (const question of QUESTIONS) {
      expect(question.framing.length, question.slug).toBeGreaterThan(80);
      for (const position of question.positions) {
        expect(position.summary.length, position.slug).toBeGreaterThan(20);
      }
    }
  });

  it("the Start Here pathway has ordered, titled steps", () => {
    expect(START_HERE_STEPS.length).toBeGreaterThanOrEqual(3);
    for (const step of START_HERE_STEPS) {
      expect(step.title.length).toBeGreaterThan(3);
    }
  });
});
