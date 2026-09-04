// Transactional email over AWS SES (the Maltivas email.sender pattern):
// same NEXT_AWS_* credentials as S3, a dedicated mail domain, per-purpose
// senders. Email is best-effort everywhere — when EMAIL_DOMAIN is unset or
// SES refuses, callers carry on (links can still be copied by hand) and the
// failure is logged, never thrown.

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

// e.g. "mail.thechristian.foundation" — a verified SES identity. Unset in
// dev means email is off and senders no-op.
const EMAIL_DOMAIN = process.env.EMAIL_DOMAIN;

export const emailConfigured = (): boolean => Boolean(EMAIL_DOMAIN);

const sesClient = new SESClient({
  region: process.env.NEXT_AWS_REGION,
  credentials: {
    accessKeyId: process.env.NEXT_AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.NEXT_AWS_SECRET_ACCESS_KEY || "",
  },
});

export type Sender = "contracts" | "bookings" | "no-reply";

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  from?: Sender;
  replyTo?: string;
}): Promise<boolean> {
  if (!EMAIL_DOMAIN) return false;
  try {
    await sesClient.send(
      new SendEmailCommand({
        Source: `Christian Foundation <${input.from ?? "no-reply"}@${EMAIL_DOMAIN}>`,
        Destination: { ToAddresses: [input.to] },
        ...(input.replyTo ? { ReplyToAddresses: [input.replyTo] } : {}),
        Message: {
          Subject: { Data: input.subject, Charset: "UTF-8" },
          Body: { Html: { Data: input.html, Charset: "UTF-8" } },
        },
      }),
    );
    return true;
  } catch (err) {
    console.error(`email: send to ${input.to} failed —`, err);
    return false;
  }
}

/** CF-styled shell shared by every transactional email. */
export function emailShell(title: string, bodyHtml: string): string {
  return (
    `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#171717">` +
    `<div style="max-width:560px;margin:0 auto;padding:32px 20px">` +
    `<p style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#d97706;font-weight:600;margin:0 0 8px">Christian Foundation</p>` +
    `<h1 style="font-size:22px;margin:0 0 16px">${title}</h1>` +
    `<div style="background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:24px;font-size:15px;line-height:1.6">${bodyHtml}</div>` +
    `<p style="font-size:12px;color:#a3a3a3;margin-top:16px">In essentials, unity · In non-essentials, liberty · In all things, charity</p>` +
    `</div></body></html>`
  );
}

export function emailButton(href: string, label: string): string {
  return (
    `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;background:linear-gradient(90deg,#f59e0b,#ea580c);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:12px">${label}</a></p>` +
    `<p style="font-size:12px;color:#a3a3a3">Or copy this link: <span style="word-break:break-all">${href}</span></p>`
  );
}
