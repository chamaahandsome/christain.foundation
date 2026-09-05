import { db } from "@/lib/db";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { BillDocument } from "@/components/BillDocument";
import { parseLineItems } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invoice", robots: { index: false } };

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invoice = await db.invoice.findUnique({
    where: { token },
    include: { channel: { select: {
          name: true,
          businessLogoUrl: true,
          businessEmail: true,
          businessAddress: true,
        } } },
  });
  if (!invoice) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-neutral-500">
        This invoice doesn&apos;t exist.
      </main>
    );
  }
  if (invoice.status === "sent" && !invoice.viewedAt) {
    await db.invoice.update({
      where: { id: invoice.id },
      data: { viewedAt: new Date() },
    });
  }

  const lineItems = parseLineItems(invoice.lineItems);

  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      {/* The document itself — the same A4 paper the studio preview shows */}
      <BillDocument
        kind="invoice"
        number={invoice.invoiceNumber}
        title={invoice.title}
        channelName={invoice.channel.name}
        logoUrl={invoice.channel.businessLogoUrl}
        companyEmail={invoice.channel.businessEmail}
        companyAddress={invoice.channel.businessAddress}
        clientName={invoice.clientName}
        clientEmail={invoice.clientEmail}
        issuedDate={(invoice.sentAt ?? invoice.createdAt).toLocaleDateString()}
        secondaryDate={invoice.dueAt?.toLocaleDateString() ?? null}
        lineItems={lineItems}
        taxBps={invoice.taxBps}
        discountCents={invoice.discountCents}
        amountCents={invoice.amountCents}
        notes={invoice.notes}
        terms={invoice.terms}
        status={invoice.status}
      />
      {invoice.paidAt && (
        <p className="mt-3 text-center text-sm font-medium text-green-600 dark:text-green-400">
          ✓ Paid {invoice.paidAt.toLocaleDateString()}
        </p>
      )}

      {/* Legacy rich-HTML body (invoices created before line items) */}
      {lineItems.length === 0 && invoice.description && (
        <div className="mt-6 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          {invoice.description.includes("<") ? (
            <div
              className="prose-reader rounded-xl bg-white text-sm leading-6 text-neutral-900"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(invoice.description) }}
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-600 dark:text-neutral-400">
              {invoice.description}
            </p>
          )}
        </div>
      )}

      {invoice.status !== "paid" && invoice.status !== "void" && (
        <p className="mt-4 text-xs leading-5 text-neutral-500">
          Payment is arranged directly with {invoice.channel.name}; they mark
          this invoice paid on receipt. Online payment is coming.
        </p>
      )}
    </main>
  );
}
