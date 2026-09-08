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

export function extractRecipientFields(
  html: string,
): { key: string; label: string; assignee: string | null }[] {
  const seen = new Set<string>();
  const fields: { key: string; label: string; assignee: string | null }[] = [];
  for (const m of html.matchAll(RECIPIENT_FIELD_RE)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    fields.push({
      key: m[1],
      label: m[2].replace(/<[^>]*>/g, "").trim() || m[1],
      assignee: attrOf(m[0], "data-assignee")?.trim().toLowerCase() || null,
    });
  }
  return fields;
}

/** The recipient fields THIS signer must fill: assigned to them, or
 * unassigned (first signer to open takes those). */
export function recipientFieldsFor(
  html: string,
  signerEmail: string,
): { key: string; label: string; assignee: string | null }[] {
  const email = signerEmail.trim().toLowerCase();
  return extractRecipientFields(html).filter(
    (f) => !f.assignee || f.assignee === email,
  );
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

/** A signed-section card (the Maltivas highlight): the signature — drawn
 * image or Hurricane-script name — in a green-tinted card with the
 * signer's name, date, and a check beneath. Replaces a signature chip. */
export function signatureBlockHtml(sig: {
  signature: string;
  signerName: string;
  signedAt?: Date | null;
}): string {
  const image = sig.signature.startsWith("data:image/png")
    ? `<img src="${sig.signature}" alt="${escapeHtml(sig.signerName)}" style="height:64px;display:block;margin:0 auto" />`
    : `<span style="display:block;text-align:center;font-family:var(--font-signature),'Snell Roundhand','Segoe Script',cursive;font-size:2.4em;line-height:1.15;color:#171717">${escapeHtml(sig.signature)}</span>`;
  const when = sig.signedAt
    ? ` · ${sig.signedAt.toISOString().slice(0, 10)}`
    : "";
  return (
    `<span style="display:inline-block;vertical-align:bottom;min-width:240px;max-width:100%;padding:14px 22px 10px;border:1.5px solid #bbf7d0;border-radius:14px;background:linear-gradient(180deg,#f0fdf4,#ffffff)">` +
    image +
    `<span style="display:block;margin-top:8px;padding-top:6px;border-top:1px solid #d1fae5;font-size:0.72em;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#15803d">${escapeHtml(sig.signerName)}${when} <span style="float:right">✓</span></span>` +
    `</span>`
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

export interface ContractRecipient {
  name: string;
  email: string;
  company: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parse the stored additional-clients JSON, dropping malformed rows. */
export function parseContractRecipients(raw: unknown): ContractRecipient[] {
  if (!Array.isArray(raw)) return [];
  const out: ContractRecipient[] = [];
  for (const row of raw.slice(0, 20)) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    const email =
      typeof r.email === "string" ? r.email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(email)) continue;
    out.push({
      name:
        typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 200) : email,
      email: email.slice(0, 320),
      company:
        typeof r.company === "string" && r.company.trim()
          ? r.company.trim().slice(0, 200)
          : null,
    });
  }
  return out;
}

const CREATOR_FIELD_RE =
  /<span\b(?![^>]*data-filled-by="recipient")[^>]*data-field="([^"]+)"[^>]*>([\s\S]*?)<\/span>/gi;

const normalize = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Creator-filled fields whose text still reads like the template's
 * placeholder (it normalizes to the field key, or looks like a prompt) —
 * the Maltivas pre-send "N fields look unfilled" check. */
export function findUnfilledCreatorFields(
  html: string,
): { key: string; label: string }[] {
  const seen = new Set<string>();
  const out: { key: string; label: string }[] = [];
  for (const m of html.matchAll(CREATOR_FIELD_RE)) {
    const key = m[1];
    if (seen.has(key)) continue;
    const text = m[2].replace(/<[^>]*>/g, "").trim();
    // camelCase keys compare word-wise: effectiveDate ~ "Effective Date"
    const keyWords = normalize(key.replace(/([a-z])([A-Z])/g, "$1 $2"));
    const looksUnfilled =
      normalize(text) === keyWords ||
      // prompt-style placeholders: "Describe the work…", "who books and pays"
      /^(describe|who|what|where|which|how|number|amount)\b/i.test(text) ||
      text.includes("…");
    if (looksUnfilled) {
      seen.add(key);
      out.push({
        key,
        label: key
          .replace(/[-_]/g, " ")
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .replace(/\b\w/g, (c) => c.toUpperCase()),
      });
    }
  }
  return out;
}

/* ---------- the signing view ----------
 * What the signer's page renders: everything that isn't theirs becomes
 * ordinary text; only their own inputs stay interactive. Creator-filled
 * fields unwrap to plain prose, recipient fill-ins become
 * data-sign-input chips, the signer's signature chips become
 * data-sign-here markers, and co-signers' pending chips become inert
 * grey markers. (Creator + already-signed substitutions happen before
 * this pass.) */

/** Unwrap creator-filled chips to plain prose — used wherever the
 * document is final (locked editor view, preview, signed & verified
 * copies): the chips are authoring affordances, not part of the
 * agreement. Recipient chips and signature blocks are left intact. */
export function flattenCreatorFields(html: string): string {
  return html.replace(CREATOR_FIELD_RE, (_m, _key: string, inner: string) => inner);
}

export function prepareSigningHtml(
  html: string,
  opts: { signerEmail: string; isDefaultRecipient: boolean },
): { html: string; myChips: number; othersPending: number } {
  let out = html;

  // Creator-filled fields → plain text (keep the value, drop the chip)
  out = out.replace(CREATOR_FIELD_RE, (_m, _key: string, inner: string) => inner);

  // Recipient fill-ins → the signer's input chips; fields assigned to a
  // co-signer render inert until that signer fills them.
  out = out.replace(RECIPIENT_FIELD_RE, (whole, key: string, inner: string) => {
    const assignee = attrOf(whole, "data-assignee")?.trim().toLowerCase() || null;
    if (assignee && assignee !== opts.signerEmail) {
      const label = inner.replace(/<[^>]*>/g, "").trim() || key;
      return `<span data-sign-pending="">${label} — ${assignee} fills this</span>`;
    }
    return `<span data-sign-input="${key}">${inner}</span>`;
  });

  // Signature chips: mine become sign-here markers; others go inert
  let myChips = 0;
  let othersPending = 0;
  out = out.replace(SIGNATURE_SPAN_RE, (whole) => {
    if (attrOf(whole, "data-signer") === "creator") return whole; // substituted earlier
    const email = attrOf(whole, "data-email")?.trim().toLowerCase() || null;
    const name = attrOf(whole, "data-signer-name")?.trim() || null;
    const mine =
      (email !== null && email === opts.signerEmail) ||
      (email === null && opts.isDefaultRecipient);
    if (mine) {
      myChips += 1;
      return `<span data-sign-here="${myChips}">▼ Click here to sign ▼</span>`;
    }
    othersPending += 1;
    return `<span data-sign-pending="">${name ?? email ?? "Co-signer"} — pending</span>`;
  });

  return { html: out, myChips, othersPending };
}
