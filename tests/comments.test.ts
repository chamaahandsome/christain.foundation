import { describe, expect, it } from "vitest";
import { MAX_COMMENT_LENGTH, validateCommentBody } from "@/lib/comments";

describe("validateCommentBody", () => {
  it("accepts a normal comment", () => {
    expect(validateCommentBody("This teaching helped me understand Romans 8.").ok).toBe(true);
  });

  it("rejects empty and whitespace-only bodies", () => {
    expect(validateCommentBody("").ok).toBe(false);
    expect(validateCommentBody("   \n  ").ok).toBe(false);
    expect(validateCommentBody("x").ok).toBe(false);
  });

  it("rejects oversized bodies, accepts the boundary", () => {
    expect(validateCommentBody("x".repeat(MAX_COMMENT_LENGTH)).ok).toBe(true);
    expect(validateCommentBody("x".repeat(MAX_COMMENT_LENGTH + 1)).ok).toBe(false);
  });
});
