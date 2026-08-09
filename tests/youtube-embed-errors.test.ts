import { describe, expect, it } from "vitest";
import {
  describeYouTubeError,
  isFatalYouTubeError,
} from "@/lib/youtube-embed-errors";

describe("describeYouTubeError", () => {
  it.each([
    [2, /invalid/],
    [5, /ad blocker|player failure/],
    [100, /not found/],
    [101, /embedding disabled/],
    [150, /embedding disabled/],
    [42, /unknown/],
  ])("code %d → %s", (code, pattern) => {
    expect(describeYouTubeError(code)).toMatch(pattern);
  });
});

describe("isFatalYouTubeError", () => {
  it("marks deleted/embed-disabled as fatal, player failures as retryable", () => {
    expect(isFatalYouTubeError(100)).toBe(true);
    expect(isFatalYouTubeError(101)).toBe(true);
    expect(isFatalYouTubeError(150)).toBe(true);
    expect(isFatalYouTubeError(5)).toBe(false);
    expect(isFatalYouTubeError(2)).toBe(false);
  });
});
