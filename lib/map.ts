// Doctrinal map domain rules (concept §4: the spine and the map).
// Pure functions — enforced at the application layer since relationMode
// "prisma" gives us no DB-level constraints for these.

import { QuestionTier } from "@prisma/client";

export interface QuestionValidation {
  valid: boolean;
  error?: string;
}

/**
 * Spine questions carry one confident answer — exactly one position, no
 * both-sides framing. Disputed questions present views side by side — at
 * least two positions.
 */
export function validateQuestionPositions(
  tier: QuestionTier,
  positionCount: number,
): QuestionValidation {
  if (tier === QuestionTier.SPINE) {
    if (positionCount !== 1) {
      return {
        valid: false,
        error: `A SPINE question must have exactly one position (got ${positionCount}). Essentials get one confident answer.`,
      };
    }
    return { valid: true };
  }
  if (positionCount < 2) {
    return {
      valid: false,
      error: `A DISPUTED question must present at least two positions (got ${positionCount}). If only one view is held, it is not disputed.`,
    };
  }
  return { valid: true };
}

export type PlacementTarget =
  | { type: "topic"; id: string }
  | { type: "question"; id: string }
  | { type: "position"; id: string };

/**
 * A ContentPlacement row must point at exactly one of topic / question /
 * position. Returns the target, or throws on an invalid row.
 */
export function placementTarget(row: {
  topicId: string | null;
  questionId: string | null;
  positionId: string | null;
}): PlacementTarget {
  const targets: PlacementTarget[] = [];
  if (row.topicId) targets.push({ type: "topic", id: row.topicId });
  if (row.questionId) targets.push({ type: "question", id: row.questionId });
  if (row.positionId) targets.push({ type: "position", id: row.positionId });

  if (targets.length !== 1) {
    throw new Error(
      `A content placement must target exactly one of topic, question, or position (got ${targets.length}).`,
    );
  }
  return targets[0];
}

export interface PathwayProgressSummary {
  total: number;
  completed: number;
  percent: number; // 0–100, integer
  nextStepId: string | null; // first incomplete step in sort order
  done: boolean;
}

/**
 * Progress through a Start Here pathway. Steps must be passed in sort order.
 */
export function pathwayProgress(
  orderedStepIds: string[],
  completedStepIds: Iterable<string>,
): PathwayProgressSummary {
  const completedSet = new Set(completedStepIds);
  const total = orderedStepIds.length;
  let completed = 0;
  let nextStepId: string | null = null;

  for (const stepId of orderedStepIds) {
    if (completedSet.has(stepId)) {
      completed += 1;
    } else if (nextStepId === null) {
      nextStepId = stepId;
    }
  }

  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    nextStepId,
    done: total > 0 && completed === total,
  };
}
