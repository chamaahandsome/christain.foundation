import { db } from "@/lib/db";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { QuoteResponse } from "@/components/QuoteResponse";
import { BillDocument } from "@/components/BillDocument";
import { parseLineItems } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Quote", robots: { index: false } };

export default async function QuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const quote = await db.quote.findUnique({
    where: { token },
    include: { channel: { select: {
          name: true,
          businessLogoUrl: true,
          businessEmail: true,
          businessAddress: true,
        } } },
  });
  if (!quote) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-neutral-500">
        This quote doesn&apos;t exist.
      </main>
    );
  }
  if (quote.status === "sent") {
    await db.quote.update({
      where: { id: quote.id },
      data: { status: "viewed", viewedAt: new Date() },
    });
  }
  const open =
    ["sent", "viewed"].includes(quote.status) &&
    (!quote.expiresAt || quote.expiresAt.getTime() > Date.now());
  const lineItems = parseLineItems(quote.lineItems);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      {/* The document itself — the same A4 paper the studio preview shows */}
      <BillDocument
        kind="quote"
        number={quote.quoteNumber}
        title={quote.title}
        channelName={quote.channel.name}
        logoUrl={quote.channel.businessLogoUrl}
        companyEmail={quote.channel.businessEmail}
        companyAddress={quote.channel.businessAddress}
        clientName={quote.clientName}
        clientEmail={quote.clientEmail}
        issuedDate={(quote.sentAt ?? quote.createdAt).toLocaleDateString()}
        secondaryDate={quote.expiresAt?.toLocaleDateString() ?? null}
        lineItems={lineItems}
        taxBps={quote.taxBps}
        discountCents={quote.discountCents}
        amountCents={quote.amountCents}
        notes={quote.notes}
        terms={quote.terms}
        status={quote.status}
      />

      {/* Legacy rich-HTML body (quotes created before line items) */}
      {lineItems.length === 0 && quote.description && (
        <div className="mt-6 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          {quote.description.includes("<") ? (
            <div
              className="prose-reader rounded-xl bg-white text-sm leading-6 text-neutral-900"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(quote.description) }}
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {quote.description}
            </p>
          )}
        </div>
      )}

      <div className="mt-6">
        {open ? (
          <QuoteResponse token={token} channelName={quote.channel.name} />
        ) : (
          <p className="rounded-xl border border-neutral-200 p-5 text-sm text-neutral-500 dark:border-neutral-800">
            {quote.status === "accepted"
              ? "You accepted this quote — the agreement is on its way to your inbox."
              : quote.status === "declined"
                ? "You declined this quote."
                : "This quote is no longer open."}
          </p>
        )}
      </div>
    </main>
  );
}
