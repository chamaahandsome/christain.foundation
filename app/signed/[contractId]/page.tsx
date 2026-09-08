import Link from "next/link";
import { db } from "@/lib/db";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { flattenCreatorFields } from "@/lib/contract-fields";

export const dynamic = "force-dynamic";
export const metadata = { title: "Signed contract", robots: { index: false } };

// The executed-copy page (the Maltivas /signed view): a SIGNED header card
// with the parties and completion date, then the frozen document — every
// signature substituted in place.
export default async function SignedContractPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: {
      channel: { select: { name: true, handle: true } },
      signatures: { where: { signedAt: { not: null } } },
    },
  });

  if (!contract || contract.status !== "SIGNED" || !contract.signedContent) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-neutral-500">
        This contract isn&apos;t fully signed yet — the executed copy appears
        here once every party has signed.
      </main>
    );
  }

  const clients = contract.signatures.filter((s) => s.signerRole === "client");

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* Header card */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8 dark:border-neutral-800 dark:bg-neutral-900">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-700 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          Signed
        </span>
        <h1 className="mt-3 text-3xl font-bold leading-tight">{contract.title}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
          ✓ Completed on {contract.signedAt?.toLocaleDateString()}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-5 sm:grid-cols-3 dark:border-neutral-800">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Creator
            </p>
            <p className="mt-1 font-medium">{contract.channel.name}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              {clients.length > 1 ? "Clients" : "Client"}
            </p>
            <p className="mt-1 font-medium">
              {clients.map((s) => s.signerName).join(", ") || contract.clientName}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              Reference
            </p>
            <p className="mt-1 font-mono text-sm">{contract.contractNumber}</p>
          </div>
        </div>
      </div>

      {/* The executed document */}
      <div className="mt-6 rounded-[3px] border border-neutral-300/80 bg-white px-6 py-8 text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.12)] sm:px-10 dark:border-neutral-600">
        {contract.logoUrl && (
          <div className="border-b-2 border-neutral-200 pb-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={contract.logoUrl} alt="" className="mx-auto h-20 object-contain" />
          </div>
        )}
        <div
          className="prose-reader text-[15px] leading-7"
          dangerouslySetInnerHTML={{
            __html: flattenCreatorFields(sanitizeRichHtml(contract.signedContent)),
          }}
        />
      </div>

      <p className="mt-6 text-center text-xs text-neutral-400">
        Anyone can verify this document&apos;s integrity at{" "}
        <Link href={`/verify/${contract.id}`} className="underline">
          /verify/{contract.id}
        </Link>
        .
      </p>
    </main>
  );
}
