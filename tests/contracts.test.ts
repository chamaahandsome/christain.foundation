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
    expect(typed).toContain("--font-signature");
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

/* ---------- multi-client drafts ---------- */

import { parseContractRecipients } from "@/lib/contracts";

describe("parseContractRecipients", () => {
  it("keeps valid rows, lowercases emails, drops junk", () => {
    expect(
      parseContractRecipients([
        { name: "Ann", email: "Ann@X.com", company: "Acme" },
        { name: "", email: "b@y.com" },
        { name: "NoEmail", email: "nope" },
        "junk",
      ]),
    ).toEqual([
      { name: "Ann", email: "ann@x.com", company: "Acme" },
      { name: "b@y.com", email: "b@y.com", company: null },
    ]);
    expect(parseContractRecipients(null)).toEqual([]);
  });
});

describe("validateContractDraft — multi-recipient sends", () => {
  const body =
    "<p>This agreement covers a speaking engagement at the spring conference, including travel.</p>";
  const chipFor = (email: string | null) =>
    `<span data-signature-field="" data-signer="client"${email ? ` data-email="${email}"` : ""}>x</span>`;

  it("chips fully assigned → no client card needed (just click send)", () => {
    expect(
      validateContractDraft({
        title: "Speaking engagement",
        clientName: "",
        clientEmail: "",
        content: body + chipFor("a@x.com") + chipFor("b@y.com"),
      }),
    ).toBeNull();
  });
  it("extra clients alone are enough", () => {
    expect(
      validateContractDraft({
        title: "Speaking engagement",
        clientName: "",
        clientEmail: "",
        content: body,
        recipients: [{ name: "Ann", email: "a@x.com" }],
      }),
    ).toBeNull();
  });
  it("unassigned chips demand a client email even with other recipients", () => {
    expect(
      validateContractDraft({
        title: "Speaking engagement",
        clientName: "",
        clientEmail: "",
        content: body + chipFor("a@x.com") + chipFor(null),
      }),
    ).toMatch(/no email/);
  });
  it("no signers anywhere → blocked", () => {
    expect(
      validateContractDraft({
        title: "Speaking engagement",
        clientName: "",
        clientEmail: "",
        content: body,
      }),
    ).toMatch(/at least one signer/);
  });
});

import { findUnfilledCreatorFields } from "@/lib/contracts";

describe("findUnfilledCreatorFields", () => {
  it("flags placeholder-looking creator fields, skips filled and recipient ones", () => {
    const html =
      `<span data-field="effectiveDate">Effective Date</span>` + // label = key → unfilled
      `<span data-field="company">Grace Chapel Media</span>` + // filled
      `<span data-field="scope">Describe the work to be performed</span>` + // prompt → unfilled
      `<span data-field="cancellationDays">number</span>` + // prompt word → unfilled
      `<span data-field="hostAddress" data-filled-by="recipient">Host address</span>`; // signer's
    const found = findUnfilledCreatorFields(html);
    expect(found.map((f) => f.key)).toEqual(["effectiveDate", "scope", "cancellationDays"]);
    expect(found[0].label).toBe("Effective Date");
  });
  it("dedupes repeated keys", () => {
    const html =
      `<span data-field="eventDate">Event Date</span>` +
      `<span data-field="eventDate">Event Date</span>`;
    expect(findUnfilledCreatorFields(html)).toHaveLength(1);
  });
});

import { prepareSigningHtml } from "@/lib/contracts";

describe("prepareSigningHtml", () => {
  const doc =
    `<p>Between <span data-field="company">Acme</span> and ` +
    `<span data-field="addr" data-filled-by="recipient">Your address</span>.</p>` +
    `<p><span data-signature-field="" data-signer="client" data-email="me@x.com" data-signer-name="Me">✍️ Me</span></p>` +
    `<p><span data-signature-field="" data-signer="client" data-email="other@y.com" data-signer-name="Other">✍️ Other</span></p>` +
    `<p><span data-signature-field="" data-signer="client">✍️ Client signature</span></p>`;

  it("flattens creator fields, marks my inputs and chips, inerts others", () => {
    const v = prepareSigningHtml(doc, { signerEmail: "me@x.com", isDefaultRecipient: false });
    expect(v.html).toContain("Between Acme and"); // unwrapped to plain text
    expect(v.html).not.toContain('data-field="company"');
    expect(v.html).toContain('data-sign-input="addr"');
    expect(v.html).toContain('data-sign-here="1"');
    expect(v.html.match(/data-sign-pending/g)).toHaveLength(2); // other + unassigned
    expect(v.myChips).toBe(1);
    expect(v.othersPending).toBe(2);
  });
  it("default recipient owns unassigned chips", () => {
    const v = prepareSigningHtml(doc, { signerEmail: "default@z.com", isDefaultRecipient: true });
    expect(v.myChips).toBe(1); // the unassigned one
    expect(v.othersPending).toBe(2);
  });
  it("leaves creator chips alone (substituted upstream)", () => {
    const v = prepareSigningHtml(
      `<span data-signature-field="" data-signer="creator">✍️ Your signature</span>`,
      { signerEmail: "a@b.c", isDefaultRecipient: true },
    );
    expect(v.html).toContain('data-signer="creator"');
    expect(v.myChips).toBe(0);
  });
});

import { recipientFieldsFor } from "@/lib/contracts";

describe("assigned recipient fields", () => {
  const doc =
    `<span data-field="addr" data-filled-by="recipient" data-assignee="ann@x.com">Ann's address</span>` +
    `<span data-field="title" data-filled-by="recipient">Anyone's title</span>`;

  it("recipientFieldsFor scopes to the signer (assigned + unassigned)", () => {
    expect(recipientFieldsFor(doc, "Ann@X.com").map((f) => f.key)).toEqual([
      "addr",
      "title",
    ]);
    expect(recipientFieldsFor(doc, "bob@y.com").map((f) => f.key)).toEqual(["title"]);
  });
  it("prepareSigningHtml inerts co-signers' assigned fields", () => {
    const mine = prepareSigningHtml(doc, { signerEmail: "ann@x.com", isDefaultRecipient: false });
    expect(mine.html.match(/data-sign-input/g)).toHaveLength(2);
    const other = prepareSigningHtml(doc, { signerEmail: "bob@y.com", isDefaultRecipient: false });
    expect(other.html.match(/data-sign-input/g)).toHaveLength(1);
    expect(other.html).toContain("Ann's address — ann@x.com fills this");
  });
});

import { flattenCreatorFields } from "@/lib/contracts";

describe("flattenCreatorFields", () => {
  it("unwraps creator chips, keeps recipient chips and signatures", () => {
    const html =
      `<p>Between <span data-field="company">Acme</span> and ` +
      `<span data-field="who" data-filled-by="recipient">Client</span>.</p>` +
      `<p><span data-signature-field="" data-signer="client">x</span></p>`;
    const out = flattenCreatorFields(html);
    expect(out).toContain("Between Acme and");
    expect(out).not.toContain('data-field="company"');
    expect(out).toContain('data-filled-by="recipient"');
    expect(out).toContain("data-signature-field");
  });
});
