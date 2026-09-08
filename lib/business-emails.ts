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
  /** a reply that isn't yet a decision */
  responded?: boolean;
}): Promise<boolean> {
  const quoted = input.note
    ? `<blockquote style="margin:16px 0;padding-left:14px;border-left:3px solid #e5e5e5;color:#525252">${esc(input.note)}</blockquote>`
    : "";
  if (input.responded) {
    return sendEmail({
      from: "bookings",
      to: input.to,
      subject: `${input.channelName} replied to your booking request`,
      html: emailShell(
        "A reply to your request",
        `<p>Hi ${esc(input.requesterName)},</p>` +
          `<p><strong>${esc(input.channelName)}</strong> has replied about your booking request:</p>` +
          quoted,
      ),
    });
  }
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
        quoted,
    ),
  });
}

/** Confirmation to the requester the moment their request lands. */
export async function sendBookingReceivedEmail(input: {
  to: string;
  requesterName: string;
  channelName: string;
  serviceTitle: string | null;
  eventDate: Date | null;
}): Promise<boolean> {
  return sendEmail({
    from: "bookings",
    to: input.to,
    subject: `We received your booking request — ${input.channelName}`,
    html: emailShell(
      "Request received",
      `<p>Hi ${esc(input.requesterName)},</p>` +
        `<p>Your request reached <strong>${esc(input.channelName)}</strong>` +
        (input.serviceTitle ? ` for <strong>${esc(input.serviceTitle)}</strong>` : "") +
        (input.eventDate
          ? ` on ${esc(input.eventDate.toLocaleDateString())}`
          : "") +
        `.</p>` +
        `<p>They'll come back to you by email. If it's a fit, you'll receive a quote or an agreement to sign right here.</p>`,
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

/* ─────────────── online 1:1 sessions (the bagel-break leg) ─────────────── */

/** The meeting block both confirmation emails share. */
function sessionDetails(input: {
  sessionTitle: string;
  when: string;
  meetingUrl: string | null;
  addToCalendarUrl: string;
}): string {
  return (
    `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">` +
    `<tr><td style="padding:6px 0;color:#737373;width:110px">Session</td>` +
    `<td style="padding:6px 0"><strong>${esc(input.sessionTitle)}</strong></td></tr>` +
    `<tr><td style="padding:6px 0;color:#737373">When</td>` +
    `<td style="padding:6px 0">${esc(input.when)}</td></tr>` +
    `</table>` +
    (input.meetingUrl
      ? emailButton(input.meetingUrl, "Join the meeting")
      : `<p style="font-size:13px;color:#737373">The meeting link will follow by email before the session.</p>`) +
    `<p style="font-size:13px;color:#737373">` +
    `<a href="${input.addToCalendarUrl}" style="color:#d97706">Add it to your calendar</a></p>`
  );
}

/** To the guest: their 1:1 is confirmed, here's how to join. */
export async function sendSessionConfirmedEmail(input: {
  to: string;
  guestName: string;
  channelName: string;
  sessionTitle: string;
  when: string;
  meetingUrl: string | null;
  addToCalendarUrl: string;
  amountCents: number | null;
  replyTo?: string;
}): Promise<boolean> {
  return sendEmail({
    from: "bookings",
    to: input.to,
    replyTo: input.replyTo,
    subject: `Confirmed: your 1:1 with ${input.channelName}`,
    html: emailShell(
      "Your session is booked",
      `<p>Hi ${esc(input.guestName)},</p>` +
        `<p>Your one-to-one with <strong>${esc(input.channelName)}</strong> is confirmed` +
        (input.amountCents && input.amountCents > 0
          ? ` — payment of $${(input.amountCents / 100).toLocaleString()} received`
          : "") +
        `.</p>` +
        sessionDetails(input) +
        `<p style="font-size:13px;color:#737373">Need to change it? Reply to this email — ` +
        `it reaches ${esc(input.channelName)} directly.</p>`,
    ),
  });
}

/** To the creator: someone booked a slot. */
export async function sendSessionBookedEmail(input: {
  to: string;
  channelName: string;
  guestName: string;
  guestEmail: string;
  sessionTitle: string;
  when: string;
  meetingUrl: string | null;
  addToCalendarUrl: string;
  amountCents: number | null;
  message: string | null;
  studioUrl: string;
}): Promise<boolean> {
  return sendEmail({
    from: "bookings",
    to: input.to,
    replyTo: input.guestEmail,
    subject: `New 1:1 booking — ${input.guestName}`,
    html: emailShell(
      "A session was booked",
      `<p><strong>${esc(input.guestName)}</strong> (${esc(input.guestEmail)}) booked a ` +
        `one-to-one with ${esc(input.channelName)}` +
        (input.amountCents && input.amountCents > 0
          ? ` and paid $${(input.amountCents / 100).toLocaleString()}`
          : " (free session)") +
        `.</p>` +
        sessionDetails(input) +
        (input.message
          ? `<p style="border-left:3px solid #f59e0b;padding-left:12px;color:#525252">${esc(
              input.message,
            )}</p>`
          : "") +
        emailButton(input.studioUrl, "Open your bookings"),
    ),
  });
}

/** To the guest: the creator called the session off. */
export async function sendSessionCancelledEmail(input: {
  to: string;
  guestName: string;
  channelName: string;
  sessionTitle: string;
  when: string;
  note: string | null;
  refundNote: string | null;
}): Promise<boolean> {
  return sendEmail({
    from: "bookings",
    to: input.to,
    subject: `Cancelled: your 1:1 with ${input.channelName}`,
    html: emailShell(
      "Your session was cancelled",
      `<p>Hi ${esc(input.guestName)},</p>` +
        `<p><strong>${esc(input.channelName)}</strong> had to cancel ` +
        `<strong>${esc(input.sessionTitle)}</strong> — ${esc(input.when)}.</p>` +
        (input.note
          ? `<p style="border-left:3px solid #f59e0b;padding-left:12px;color:#525252">${esc(
              input.note,
            )}</p>`
          : "") +
        (input.refundNote
          ? `<p style="font-size:13px;color:#737373">${esc(input.refundNote)}</p>`
          : "") +
        `<p>The slot is free again, and you're welcome to book another time.</p>`,
    ),
  });
}
