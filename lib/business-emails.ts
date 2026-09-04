// Do-Biz transactional emails (the Maltivas contract-email-service shape,
// CF-styled, English-only): contract signing links, signed confirmations,
// booking requests and decisions. All best-effort via lib/email.

import { emailButton, emailShell, sendEmail } from "@/lib/email";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendContractSigningEmail(input: {
  to: string;
  clientName: string;
  channelName: string;
  contractTitle: string;
  contractNumber: string;
  signingUrl: string;
  replyTo?: string;
}): Promise<boolean> {
  return sendEmail({
    from: "contracts",
    to: input.to,
    replyTo: input.replyTo,
    subject: `${input.channelName} sent you an agreement to sign — ${input.contractNumber}`,
    html: emailShell(
      "An agreement awaits your signature",
      `<p>Hi ${esc(input.clientName)},</p>` +
        `<p><strong>${esc(input.channelName)}</strong> has signed and sent you ` +
        `<strong>${esc(input.contractTitle)}</strong> (${input.contractNumber}). ` +
        `Review it and sign online — typed or drawn, it takes a minute.</p>` +
        emailButton(input.signingUrl, "Review & sign") +
        `<p style="font-size:13px;color:#737373">This link is personal to you and expires. ` +
        `If you weren't expecting this agreement, you can ignore this email or decline on the page.</p>`,
    ),
  });
}

export async function sendContractSignedEmails(input: {
  clientEmail: string;
  clientName: string;
  creatorEmail: string | null;
  channelName: string;
  contractTitle: string;
  contractNumber: string;
  verifyUrl: string;
}): Promise<void> {
  const body = (name: string) =>
    emailShell(
      "Fully executed",
      `<p>Hi ${esc(name)},</p>` +
        `<p><strong>${esc(input.contractTitle)}</strong> (${input.contractNumber}) ` +
        `between ${esc(input.channelName)} and ${esc(input.clientName)} is now signed by both parties.</p>` +
        emailButton(input.verifyUrl, "Verify the document") +
        `<p style="font-size:13px;color:#737373">The verification page confirms the signatures and the document's integrity hash at any time.</p>`,
    );
  await sendEmail({
    from: "contracts",
    to: input.clientEmail,
    subject: `Signed: ${input.contractTitle} (${input.contractNumber})`,
    html: body(input.clientName),
  });
  if (input.creatorEmail) {
    await sendEmail({
      from: "contracts",
      to: input.creatorEmail,
      subject: `Signed: ${input.contractTitle} (${input.contractNumber})`,
      html: body(input.channelName),
    });
  }
}

export async function sendBookingRequestEmail(input: {
  to: string;
  channelName: string;
  requesterName: string;
  organization: string | null;
  eventDate: Date | null;
  location: string | null;
  budgetCents: number | null;
  message: string;
  studioUrl: string;
  replyTo?: string;
}): Promise<boolean> {
  const facts = [
    input.organization && `<strong>Organization:</strong> ${esc(input.organization)}`,
    input.eventDate && `<strong>Date:</strong> ${input.eventDate.toLocaleDateString()}`,
    input.location && `<strong>Location:</strong> ${esc(input.location)}`,
    input.budgetCents !== null &&
      `<strong>Budget:</strong> $${(input.budgetCents / 100).toLocaleString()}`,
  ]
    .filter(Boolean)
    .join("<br/>");
  return sendEmail({
    from: "bookings",
    to: input.to,
    replyTo: input.replyTo,
    subject: `📅 Booking request from ${input.requesterName}`,
    html: emailShell(
      "New booking request",
      `<p>${esc(input.requesterName)} wants to book ${esc(input.channelName)}.</p>` +
        (facts ? `<p>${facts}</p>` : "") +
        `<blockquote style="margin:16px 0;padding-left:14px;border-left:3px solid #f59e0b;color:#525252">${esc(input.message)}</blockquote>` +
        emailButton(input.studioUrl, "Review in the studio"),
    ),
  });
}

export async function sendBookingDecisionEmail(input: {
  to: string;
  requesterName: string;
  channelName: string;
  accepted: boolean;
  note: string | null;
}): Promise<boolean> {
  return sendEmail({
    from: "bookings",
    to: input.to,
    subject: input.accepted
      ? `🎉 ${input.channelName} accepted your booking request`
      : `Your booking request to ${input.channelName}`,
    html: emailShell(
      input.accepted ? "Booking accepted" : "Booking declined",
      `<p>Hi ${esc(input.requesterName)},</p>` +
        (input.accepted
          ? `<p><strong>${esc(input.channelName)}</strong> accepted your request and is drafting the agreement — a signing link will reach this inbox shortly.</p>`
          : `<p><strong>${esc(input.channelName)}</strong> can't take this booking.</p>`) +
        (input.note
          ? `<blockquote style="margin:16px 0;padding-left:14px;border-left:3px solid #e5e5e5;color:#525252">${esc(input.note)}</blockquote>`
          : ""),
    ),
  });
}

export async function sendQuoteEmail(input: {
  to: string;
  clientName: string;
  channelName: string;
  quoteNumber: string;
  title: string;
  amountCents: number;
  quoteUrl: string;
  replyTo?: string;
}): Promise<boolean> {
  return sendEmail({
    from: "contracts",
    to: input.to,
    replyTo: input.replyTo,
    subject: `Quote from ${input.channelName} — ${input.quoteNumber}`,
    html: emailShell(
      "You have a quote",
      `<p>Hi ${esc(input.clientName)},</p>` +
        `<p><strong>${esc(input.channelName)}</strong> sent you a quote for ` +
        `<strong>${esc(input.title)}</strong>: $${(input.amountCents / 100).toLocaleString()}.</p>` +
        emailButton(input.quoteUrl, "View & respond") +
        `<p style="font-size:13px;color:#737373">Accepting turns the quote into an agreement for signature.</p>`,
    ),
  });
}

export async function sendInvoiceEmail(input: {
  to: string;
  clientName: string;
  channelName: string;
  invoiceNumber: string;
  title: string;
  amountCents: number;
  dueAt: Date | null;
  invoiceUrl: string;
  replyTo?: string;
}): Promise<boolean> {
  return sendEmail({
    from: "contracts",
    to: input.to,
    replyTo: input.replyTo,
    subject: `Invoice ${input.invoiceNumber} from ${input.channelName}`,
    html: emailShell(
      "Invoice",
      `<p>Hi ${esc(input.clientName)},</p>` +
        `<p><strong>${esc(input.channelName)}</strong> issued invoice ` +
        `<strong>${input.invoiceNumber}</strong> — ${esc(input.title)}: ` +
        `$${(input.amountCents / 100).toLocaleString()}` +
        (input.dueAt ? `, due ${input.dueAt.toLocaleDateString()}` : "") +
        `.</p>` +
        emailButton(input.invoiceUrl, "View the invoice"),
    ),
  });
}
