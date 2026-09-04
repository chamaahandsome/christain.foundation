import { db } from "@/lib/db";
import { contractHash } from "@/lib/contracts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verify document", robots: { index: false } };

// Public integrity check (the Do-Biz verify page): confirms a contract id
// exists, its status, when it was signed by whom, and that the stored
// signed content still matches its SHA-256 — without exposing the content.
export default async function VerifyPage({
  params,
}: {
  params: Promise<{ contractId: string }>;
}) {
  const { contractId } = await params;
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: {
      channel: { select: { name: true } },
      signatures: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!contract) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-neutral-500">
        No document with that id.
      </main>
    );
  }

  const intact =
    contract.signedContent !== null &&
    contract.documentHash !== null &&
    contractHash(contract.signedContent) === contract.documentHash;

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Document verification
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        {contract.contractNumber} — {contract.title}
      </h1>
      <dl className="mt-6 space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-500">Status</dt>
          <dd className="font-medium">{contract.status}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-neutral-500">Issued by</dt>
          <dd>{contract.channel.name}</dd>
        </div>
        {contract.signatures
          .filter((s) => s.signedAt)
          .map((s) => (
            <div key={s.id} className="flex justify-between gap-3">
              <dt className="text-neutral-500">
                Signed ({s.signerRole})
              </dt>
              <dd>
                {s.signerName} · {s.signedAt!.toLocaleDateString()}
              </dd>
            </div>
          ))}
        {contract.status === "SIGNED" && (
          <>
            <div className="flex justify-between gap-3">
              <dt className="text-neutral-500">Integrity</dt>
              <dd className={intact ? "font-medium text-green-600" : "font-medium text-red-600"}>
                {intact ? "✓ content matches its hash" : "✗ HASH MISMATCH"}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-500">SHA-256</dt>
              <dd className="mt-1 break-all font-mono text-xs text-neutral-400">
                {contract.documentHash}
              </dd>
            </div>
          </>
        )}
      </dl>
      <p className="mt-8 text-xs leading-5 text-neutral-400">
        This page confirms the document&apos;s existence, signatures, and
        integrity without exposing its contents. The parties hold the full
        text.
      </p>
    </main>
  );
}
