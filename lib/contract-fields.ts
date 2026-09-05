// Document field bubbles (pure, tested — and browser-safe: no node
// imports, since client components use these too).
//
// Editors place <span data-field="key"> fill-ins (data-filled-by="recipient"
// means the signer supplies the value on the signing page) and
// <span data-signature-field data-signer="creator|client"> chips that the
// matching party's signature replaces.

const SIGNATURE_SPAN_RE =
  /<span\b[^>]*data-signature-field[^>]*>[\s\S]*?<\/span>/gi;

const attrOf = (span: string, name: string): string | null => {
  const m = span.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return m ? m[1] : null;
};

export interface SignatureBubble {
  signer: "creator" | "client";
  email: string | null;
  name: string | null;
}

/** Every signature chip in document order, with its assignment. */
export function extractSignatureBubbles(html: string): SignatureBubble[] {
  const bubbles: SignatureBubble[] = [];
  for (const m of html.matchAll(SIGNATURE_SPAN_RE)) {
    const signer = attrOf(m[0], "data-signer") === "creator" ? "creator" : "client";
    bubbles.push({
      signer,
      email: attrOf(m[0], "data-email")?.trim().toLowerCase() || null,
      name: attrOf(m[0], "data-signer-name")?.trim() || null,
    });
  }
  return bubbles;
}

/** Unique client-chip recipients that carry an email — each gets their own
 * signing token at send. */
export function getUniqueRecipients(html: string): { email: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const b of extractSignatureBubbles(html)) {
    if (b.signer === "client" && b.email && !seen.has(b.email)) {
      seen.set(b.email, b.name ?? b.email);
    }
  }
  return [...seen.entries()].map(([email, name]) => ({ email, name }));
}

/** Client chips with no email assigned — they fall to the default client
 * recipient (clientEmail), or block send when there is none. */
export function countUnassignedClientChips(html: string): number {
  return extractSignatureBubbles(html).filter(
    (b) => b.signer === "client" && !b.email,
  ).length;
}
const RECIPIENT_FIELD_RE =
  /<span\b(?=[^>]*data-filled-by="recipient")[^>]*data-field="([^"]+)"[^>]*>([\s\S]*?)<\/span>/gi;

export function countSignatureFields(html: string): { creator: number; client: number } {
  const counts = { creator: 0, client: 0 };
  for (const b of extractSignatureBubbles(html)) counts[b.signer] += 1;
  return counts;
}

export function extractRecipientFields(html: string): { key: string; label: string }[] {
  const seen = new Set<string>();
  const fields: { key: string; label: string }[] = [];
  for (const m of html.matchAll(RECIPIENT_FIELD_RE)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    fields.push({ key: m[1], label: m[2].replace(/<[^>]*>/g, "").trim() || m[1] });
  }
  return fields;
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** The signer's answers land in place of their fill-in chips; the chip
 * becomes ordinary (creator-style) filled text in the frozen document. */
export function fillRecipientFields(
  html: string,
  values: Record<string, string>,
): string {
  return html.replace(RECIPIENT_FIELD_RE, (whole, key: string) => {
    const value = values[key]?.trim();
    if (!value) return whole;
    return `<span data-field="${escapeHtml(key)}">${escapeHtml(value)}</span>`;
  });
}

/** An inline signature block: the image (or cursive name) with the signer's
 * name and date beneath — what replaces a signature chip. */
export function signatureBlockHtml(sig: {
  signature: string;
  signerName: string;
  signedAt?: Date | null;
}): string {
  const image = sig.signature.startsWith("data:image/png")
    ? `<img src="${sig.signature}" alt="${escapeHtml(sig.signerName)}" style="height:56px;display:inline-block" />`
    : `<span style="font-family:Georgia,serif;font-style:italic;font-size:1.4em">${escapeHtml(sig.signature)}</span>`;
  const when = sig.signedAt
    ? `<span style="color:#737373"> · ${sig.signedAt.toISOString().slice(0, 10)}</span>`
    : "";
  return (
    `<span style="display:inline-block;vertical-align:bottom">${image}<br />` +
    `<span style="font-size:0.8em;color:#525252">${escapeHtml(sig.signerName)}${when}</span></span>`
  );
}

/** Replace signature chips with a real signature block. Creator: all
 * creator chips. Client with `opts.email`: only chips assigned that email
 * (plus unassigned chips when `opts.includeUnassigned` — the default
 * clientEmail recipient owns those). Client without opts: every client
 * chip (single-recipient contracts). */
export function substituteSignatureFields(
  html: string,
  signer: "creator" | "client",
  replacementHtml: string,
  opts?: { email?: string | null; includeUnassigned?: boolean },
): string {
  return html.replace(SIGNATURE_SPAN_RE, (whole) => {
    const who = attrOf(whole, "data-signer") === "creator" ? "creator" : "client";
    if (who !== signer) return whole;
    if (signer === "client" && opts?.email !== undefined) {
      const chipEmail = attrOf(whole, "data-email")?.trim().toLowerCase() || null;
      const mine =
        (opts.email !== null && chipEmail === opts.email) ||
        (chipEmail === null && (opts.includeUnassigned ?? false));
      if (!mine) return whole;
    }
    return replacementHtml;
  });
}
