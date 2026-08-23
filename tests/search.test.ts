import { describe, expect, it } from "vitest";
import { sanitizeFulltextQuery } from "@/lib/search";

describe("sanitizeFulltextQuery", () => {
  it("passes plain queries through", () => {
    expect(sanitizeFulltextQuery("does science disprove God")).toBe(
      "does science disprove God",
    );
  });

  it("strips MySQL boolean-mode operators and quotes", () => {
    expect(sanitizeFulltextQuery('+baptism -infant "exact phrase"')).toBe(
      "baptism infant exact phrase",
    );
    expect(sanitizeFulltextQuery("a*b (c) <d> ~e @f 'g'")).toBe("a b c d e f g");
  });

  it("collapses whitespace and trims", () => {
    expect(sanitizeFulltextQuery("  what   is\tthe   gospel  ")).toBe(
      "what is the gospel",
    );
  });

  it("caps absurd input length", () => {
    expect(sanitizeFulltextQuery("word ".repeat(100)).length).toBeLessThanOrEqual(200);
  });

  it("returns empty string when nothing survives", () => {
    expect(sanitizeFulltextQuery('+-*"()')).toBe("");
    expect(sanitizeFulltextQuery("   ")).toBe("");
  });
});
