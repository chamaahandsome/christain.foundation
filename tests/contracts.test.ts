import { describe, expect, it } from "vitest";
import {
  bookingContractContent,
  contractHash,
  generateSignToken,
  nextContractNumber,
  tokenUsable,
  validateBookingRequest,
  validateContractDraft,
  validateTemplate,
} from "@/lib/contracts";

describe("nextContractNumber", () => {
  it("starts at CON-001 and increments", () => {
    expect(nextContractNumber(null)).toBe("CON-001");
    expect(nextContractNumber("CON-001")).toBe("CON-002");
    expect(nextContractNumber("CON-099")).toBe("CON-100");
    expect(nextContractNumber("garbage")).toBe("CON-001");
  });
});

describe("validateContractDraft", () => {
  const base = {
    title: "Speaking engagement",
    clientName: "Jane Doe",
    clientEmail: "jane@example.com",
    content:
      "<p>This agreement covers a speaking engagement at the spring conference, including travel.</p>",
  };
  it("accepts a sound draft", () => {
    expect(validateContractDraft(base)).toBeNull();
  });
  it("rejects bad emails, thin bodies, and negative amounts", () => {
    expect(validateContractDraft({ ...base, clientEmail: "nope" })).toMatch(/email/);
    expect(validateContractDraft({ ...base, content: "<p>ok</p>" })).toMatch(/too short/);
    expect(validateContractDraft({ ...base, amountCents: -5 })).toMatch(/amount/);
    expect(validateContractDraft({ ...base, amountCents: null })).toBeNull();
  });
});

describe("tokenUsable", () => {
  const now = new Date("2026-09-01T12:00:00Z");
  const live = { expiresAt: new Date("2026-09-10"), usedAt: null };
  it("gates on use, expiry, and contract state", () => {
    expect(tokenUsable(live, "SENT", now)).toBe("ok");
    expect(tokenUsable(live, "VIEWED", now)).toBe("ok");
    expect(tokenUsable({ ...live, usedAt: now }, "SENT", now)).toBe("used");
    expect(
      tokenUsable({ ...live, expiresAt: new Date("2026-08-01") }, "SENT", now),
    ).toBe("expired");
    expect(tokenUsable(live, "CANCELLED", now)).toBe("closed");
    expect(tokenUsable(live, "SIGNED", now)).toBe("closed");
  });
});

describe("tokens and hashing", () => {
  it("tokens are long, urlsafe, and unique", () => {
    const a = generateSignToken();
    const b = generateSignToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{30,}$/);
    expect(a).not.toBe(b);
  });
  it("hash is stable and content-sensitive", () => {
    expect(contractHash("abc")).toBe(contractHash("abc"));
    expect(contractHash("abc")).not.toBe(contractHash("abd"));
    expect(contractHash("abc")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("validateBookingRequest", () => {
  const base = {
    requesterName: "Pastor Jim",
    requesterEmail: "jim@church.org",
    message: "We'd love to have you speak at our spring men's conference.",
  };
  it("accepts a sound request and rejects thin ones", () => {
    expect(validateBookingRequest(base)).toBeNull();
    expect(validateBookingRequest({ ...base, requesterEmail: "bad" })).toMatch(/email/);
    expect(validateBookingRequest({ ...base, message: "come speak" })).toMatch(/Describe/);
    expect(validateBookingRequest({ ...base, budgetCents: -1 })).toMatch(/budget/);
  });
});

describe("validateTemplate", () => {
  it("needs a name and a real body", () => {
    expect(
      validateTemplate({ name: "Speaking", content: "<p>" + "x".repeat(60) + "</p>" }),
    ).toBeNull();
    expect(validateTemplate({ name: "S", content: "<p>long enough body text here okay for sure</p>" })).toMatch(/Name/);
    expect(validateTemplate({ name: "Speaking", content: "<p>short</p>" })).toMatch(/short/);
  });
});

describe("bookingContractContent", () => {
  it("prefills the request and escapes HTML in the message", () => {
    const html = bookingContractContent({
      requesterName: "Pastor Jim",
      organization: "Grace Church",
      eventDate: new Date("2026-10-10"),
      location: "Nairobi",
      message: "Bring your <best> talk & notes",
    });
    expect(html).toContain("Pastor Jim");
    expect(html).toContain("Grace Church");
    expect(html).toContain("&lt;best&gt;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain("<best>");
  });
});
