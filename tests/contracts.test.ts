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

/* ---------- document field bubbles ---------- */

import {
  countSignatureFields,
  extractRecipientFields,
  fillRecipientFields,
  signatureBlockHtml,
  substituteSignatureFields,
} from "@/lib/contracts";
import { DEFAULT_TEMPLATES } from "@/lib/default-templates";

const DOC =
  `<p>Between <span data-field="company">Acme</span> and ` +
  `<span data-field="freelancer" data-filled-by="recipient">Freelancer name</span>.</p>` +
  `<p>Address: <span data-filled-by="recipient" data-field="address">Your address</span></p>` +
  `<p>Provider: <span data-signature-field="" data-signer="creator">✍️ Your signature</span></p>` +
  `<p>Client: <span data-signature-field="" data-signer="client">✍️ Client signature</span></p>`;

describe("countSignatureFields", () => {
  it("counts chips per signer", () => {
    expect(countSignatureFields(DOC)).toEqual({ creator: 1, client: 1 });
    expect(countSignatureFields("<p>none</p>")).toEqual({ creator: 0, client: 0 });
  });
});

describe("extractRecipientFields", () => {
  it("finds recipient fill-ins regardless of attribute order, dedup by key", () => {
    const fields = extractRecipientFields(DOC + DOC);
    expect(fields.map((f) => f.key)).toEqual(["freelancer", "address"]);
    expect(fields[0].label).toBe("Freelancer name");
  });
  it("ignores creator-filled fields", () => {
    expect(extractRecipientFields('<span data-field="x">v</span>')).toEqual([]);
  });
});

describe("fillRecipientFields", () => {
  it("writes escaped answers into recipient chips and drops the recipient marker", () => {
    const out = fillRecipientFields(DOC, {
      freelancer: "Jo <b>Smith</b>",
      address: "12 Way",
    });
    expect(out).toContain('<span data-field="freelancer">Jo &lt;b&gt;Smith&lt;/b&gt;</span>');
    expect(out).toContain('<span data-field="address">12 Way</span>');
    expect(out).not.toContain("data-filled-by");
    // creator field untouched
    expect(out).toContain('<span data-field="company">Acme</span>');
  });
  it("leaves unanswered fields alone", () => {
    expect(fillRecipientFields(DOC, {})).toBe(DOC);
  });
});

describe("substituteSignatureFields", () => {
  it("replaces only the requested signer's chips", () => {
    const out = substituteSignatureFields(DOC, "creator", "<em>SIG</em>");
    expect(out).toContain("<p>Provider: <em>SIG</em></p>");
    expect(out).toContain('data-signer="client"');
  });
  it("round-trips both parties into an executed document", () => {
    let out = fillRecipientFields(DOC, { freelancer: "Jo", address: "12 Way" });
    out = substituteSignatureFields(
      out,
      "creator",
      signatureBlockHtml({ signature: "data:image/png;base64,AAA", signerName: "Creator" }),
    );
    out = substituteSignatureFields(
      out,
      "client",
      signatureBlockHtml({
        signature: "Jo Smith",
        signerName: "Jo Smith",
        signedAt: new Date("2026-09-04T00:00:00Z"),
      }),
    );
    expect(out).not.toContain("data-signature-field");
    expect(out).toContain('img src="data:image/png;base64,AAA"');
    expect(out).toContain("Jo Smith");
    expect(out).toContain("2026-09-04");
  });
});

describe("signatureBlockHtml", () => {
  it("renders a PNG data-URL as an image and anything else as cursive text", () => {
    expect(signatureBlockHtml({ signature: "data:image/png;base64,x", signerName: "A" })).toContain("<img");
    const typed = signatureBlockHtml({ signature: 'B "quoted"', signerName: "B <x>" });
    expect(typed).toContain("font-family:Georgia");
    expect(typed).toContain("B &quot;quoted&quot;");
    expect(typed).toContain("B &lt;x&gt;");
  });
});

describe("default templates", () => {
  it("every template carries both signature chips and valid field spans", () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      const sigs = countSignatureFields(tpl.content);
      expect(sigs.creator, tpl.key).toBeGreaterThan(0);
      expect(sigs.client, tpl.key).toBeGreaterThan(0);
      // every declared field key appears as a data-field span
      for (const key of tpl.fields) {
        expect(tpl.content, `${tpl.key}:${key}`).toContain(`data-field="${key}"`);
      }
    }
  });
});

/* ---------- multi-recipient signature routing ---------- */

import {
  countUnassignedClientChips,
  extractSignatureBubbles,
  getUniqueRecipients,
} from "@/lib/contracts";

const MULTI =
  `<p><span data-signature-field="" data-signer="creator">✍️ Your signature</span></p>` +
  `<p><span data-signature-field="" data-signer="client" data-email="a@x.com" data-signer-name="Ann">✍️ Ann</span></p>` +
  `<p><span data-email="b@y.com" data-signature-field="" data-signer="client">✍️ b</span></p>` +
  `<p><span data-signature-field="" data-signer="client" data-email="a@x.com">✍️ Ann again</span></p>` +
  `<p><span data-signature-field="" data-signer="client">✍️ Client signature</span></p>`;

describe("extractSignatureBubbles", () => {
  it("parses signer/email/name regardless of attribute order", () => {
    const bubbles = extractSignatureBubbles(MULTI);
    expect(bubbles).toHaveLength(5);
    expect(bubbles[0]).toEqual({ signer: "creator", email: null, name: null });
    expect(bubbles[1]).toEqual({ signer: "client", email: "a@x.com", name: "Ann" });
    expect(bubbles[2].email).toBe("b@y.com");
    expect(bubbles[4]).toEqual({ signer: "client", email: null, name: null });
  });
});

describe("getUniqueRecipients / countUnassignedClientChips", () => {
  it("dedupes recipients by email and counts unassigned chips", () => {
    expect(getUniqueRecipients(MULTI)).toEqual([
      { email: "a@x.com", name: "Ann" },
      { email: "b@y.com", name: "b@y.com" },
    ]);
    expect(countUnassignedClientChips(MULTI)).toBe(1);
  });
});

describe("substituteSignatureFields per recipient", () => {
  it("replaces only the addressed recipient's chips", () => {
    const out = substituteSignatureFields(MULTI, "client", "<em>ANN</em>", {
      email: "a@x.com",
    });
    expect(out.match(/<em>ANN<\/em>/g)).toHaveLength(2);
    expect(out).toContain("b@y.com"); // untouched
    expect(out).toContain("✍️ Client signature"); // unassigned untouched
  });
  it("includeUnassigned sweeps default-recipient chips", () => {
    const out = substituteSignatureFields(MULTI, "client", "<em>DEF</em>", {
      email: "c@z.com",
      includeUnassigned: true,
    });
    expect(out.match(/<em>DEF<\/em>/g)).toHaveLength(1);
  });
  it("without opts replaces every client chip (single-recipient docs)", () => {
    const out = substituteSignatureFields(MULTI, "client", "<em>ALL</em>");
    expect(out.match(/<em>ALL<\/em>/g)).toHaveLength(4);
    expect(out).toContain("data-signer=\"creator\"");
  });
});
