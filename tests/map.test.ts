import { describe, expect, it } from "vitest";
import { QuestionTier } from "@prisma/client";
import {
  pathwayProgress,
  placementTarget,
  validateQuestionPositions,
} from "@/lib/map";

describe("validateQuestionPositions", () => {
  it("SPINE requires exactly one position", () => {
    expect(validateQuestionPositions(QuestionTier.SPINE, 1).valid).toBe(true);
    expect(validateQuestionPositions(QuestionTier.SPINE, 0).valid).toBe(false);
    expect(validateQuestionPositions(QuestionTier.SPINE, 2).valid).toBe(false);
  });

  it("DISPUTED requires at least two positions", () => {
    expect(validateQuestionPositions(QuestionTier.DISPUTED, 2).valid).toBe(true);
    expect(validateQuestionPositions(QuestionTier.DISPUTED, 4).valid).toBe(true);
    expect(validateQuestionPositions(QuestionTier.DISPUTED, 1).valid).toBe(false);
    expect(validateQuestionPositions(QuestionTier.DISPUTED, 0).valid).toBe(false);
  });

  it("explains failures", () => {
    const result = validateQuestionPositions(QuestionTier.SPINE, 3);
    expect(result.error).toMatch(/exactly one position/);
  });
});

describe("placementTarget", () => {
  it("returns the single target", () => {
    expect(
      placementTarget({ topicId: "t1", questionId: null, positionId: null }),
    ).toEqual({ type: "topic", id: "t1" });
    expect(
      placementTarget({ topicId: null, questionId: "q1", positionId: null }),
    ).toEqual({ type: "question", id: "q1" });
    expect(
      placementTarget({ topicId: null, questionId: null, positionId: "p1" }),
    ).toEqual({ type: "position", id: "p1" });
  });

  it("throws when zero or multiple targets are set", () => {
    expect(() =>
      placementTarget({ topicId: null, questionId: null, positionId: null }),
    ).toThrow(/exactly one/);
    expect(() =>
      placementTarget({ topicId: "t1", questionId: "q1", positionId: null }),
    ).toThrow(/exactly one/);
  });
});

describe("pathwayProgress", () => {
  const steps = ["s1", "s2", "s3", "s4"];

  it("reports zero progress with the first step next", () => {
    expect(pathwayProgress(steps, [])).toEqual({
      total: 4,
      completed: 0,
      percent: 0,
      nextStepId: "s1",
      done: false,
    });
  });

  it("reports partial progress with the first incomplete step next", () => {
    expect(pathwayProgress(steps, ["s1", "s3"])).toEqual({
      total: 4,
      completed: 2,
      percent: 50,
      nextStepId: "s2",
      done: false,
    });
  });

  it("reports completion", () => {
    expect(pathwayProgress(steps, steps)).toEqual({
      total: 4,
      completed: 4,
      percent: 100,
      nextStepId: null,
      done: true,
    });
  });

  it("ignores completed ids that are not steps", () => {
    const summary = pathwayProgress(steps, ["s1", "ghost"]);
    expect(summary.completed).toBe(1);
    expect(summary.percent).toBe(25);
  });

  it("handles an empty pathway without claiming completion", () => {
    expect(pathwayProgress([], [])).toEqual({
      total: 0,
      completed: 0,
      percent: 0,
      nextStepId: null,
      done: false,
    });
  });
});
