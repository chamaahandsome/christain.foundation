import { db } from "@/lib/db";
import { QuoteResponse } from "@/components/QuoteResponse";

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
    include: { channel: { select: { name: true } } },
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

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Quote · {quote.quoteNumber}
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{quote.title}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        From <span className="font-medium">{quote.channel.name}</span> to{" "}
        {quote.clientName}
      </p>

      <div className="mt-6 rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-3xl font-semibold tracking-tight">
          ${(quote.amountCents / 100).toLocaleString()}
        </p>
        {quote.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-600 dark:text-neutral-400">
            {quote.description}
          </p>
        )}
        {quote.expiresAt && (
          <p className="mt-3 text-xs text-neutral-500">
            Valid until {quote.expiresAt.toLocaleDateString()}
          </p>
        )}
      </div>

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
