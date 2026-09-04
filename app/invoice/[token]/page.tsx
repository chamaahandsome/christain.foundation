import { db } from "@/lib/db";

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
    include: { channel: { select: { name: true } } },
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

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
          Invoice · {invoice.invoiceNumber}
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium uppercase ${
            invoice.status === "paid"
              ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
              : invoice.status === "void"
                ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {invoice.status}
        </span>
      </div>
      <h1 className="mt-2 text-2xl font-semibold">{invoice.title}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        From <span className="font-medium">{invoice.channel.name}</span> to{" "}
        {invoice.clientName}
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-3xl font-semibold tracking-tight">
          ${(invoice.amountCents / 100).toLocaleString()}
        </p>
        {invoice.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {invoice.description}
          </p>
        )}
        <div className="mt-3 space-y-0.5 text-xs text-neutral-500">
          <p>Issued {invoice.createdAt.toLocaleDateString()}</p>
          {invoice.dueAt && <p>Due {invoice.dueAt.toLocaleDateString()}</p>}
          {invoice.paidAt && <p>Paid {invoice.paidAt.toLocaleDateString()}</p>}
        </div>
      </div>

      {invoice.status !== "paid" && invoice.status !== "void" && (
        <p className="mt-4 text-xs leading-5 text-neutral-500">
          Payment is arranged directly with {invoice.channel.name}; they mark
          this invoice paid on receipt. Online payment is coming.
        </p>
      )}
    </main>
  );
}
