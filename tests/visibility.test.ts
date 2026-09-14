import { describe, expect, it } from "vitest";
import { allowedVisibilities, visibilityProblem } from "@/lib/visibility";

describe("allowedVisibilities", () => {
  it("keeps an embedded YouTube video public only", () => {
    expect(allowedVisibilities("EMBEDDED_YOUTUBE")).toEqual(["PUBLIC"]);
  });

  it("offers members-only and paid for content CF serves itself", () => {
    expect(allowedVisibilities("NATIVE_MUX")).toEqual(["PUBLIC", "MEMBERS", "PAID"]);
    expect(allowedVisibilities("DOCUMENT")).toEqual(["PUBLIC", "MEMBERS", "PAID"]);
  });
});

describe("visibilityProblem", () => {
  it("allows public on anything", () => {
    expect(visibilityProblem("EMBEDDED_YOUTUBE", "PUBLIC")).toBeNull();
    expect(visibilityProblem("NATIVE_MUX", "PUBLIC")).toBeNull();
  });

  it("refuses members-only and paid on a YouTube video, and says why", () => {
    expect(visibilityProblem("EMBEDDED_YOUTUBE", "MEMBERS")).toMatch(/free on YouTube/);
    expect(visibilityProblem("EMBEDDED_YOUTUBE", "PAID")).toMatch(/free on YouTube/);
  });

  it("allows members-only and paid on hosted content", () => {
    expect(visibilityProblem("NATIVE_MUX", "MEMBERS")).toBeNull();
    expect(visibilityProblem("DOCUMENT", "PAID")).toBeNull();
  });

  it("rejects a visibility that doesn't exist", () => {
    expect(visibilityProblem("NATIVE_MUX", "SECRET")).toBe("Unknown visibility.");
  });
});
