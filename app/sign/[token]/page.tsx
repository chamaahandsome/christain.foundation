import { db } from "@/lib/db";
import { CONTRACT_CONSENT_TEXT, tokenUsable } from "@/lib/contracts";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { SignContract } from "@/components/SignContract";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign agreement", robots: { index: false } };

// The counterparty's page: the whole agreement, then the signing panel.
// Opening the link marks the contract VIEWED — the sender sees movement.
export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await db.contractSignToken.findUnique({
    where: { token },
    include: {
      contract: {
        include: {
          channel: { select: { name: true, handle: true } },
          signatures: { where: { signerRole: "creator" } },
        },
      },
    },
  });

  if (!row) {
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-neutral-500">
        This signing link doesn&apos;t exist.
      </main>
    );
  }

  const contract = row.contract;
  const usable = tokenUsable(row, contract.status);

  if (usable === "ok" && contract.status === "SENT") {
    await db.contract.update({
      where: { id: contract.id },
      data: {
        status: "VIEWED",
        viewedAt: new Date(),
        activities: {
          create: { type: "viewed", description: `${row.signerName} opened the contract` },
        },
      },
    });
  }

  const creatorSig = contract.signatures[0];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Agreement · {contract.contractNumber}
      </p>
      <h1 className="mt-2 text-3xl font-semibold leading-tight">{contract.title}</h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        Between <span className="font-medium">{contract.channel.name}</span> and{" "}
        <span className="font-medium">{contract.clientName}</span>
        {contract.clientCompany && ` (${contract.clientCompany})`}
        {contract.amountCents !== null &&
          ` · $${(contract.amountCents / 100).toLocaleString()}`}
      </p>

      <div
        className="prose-reader mt-8 rounded-2xl border border-neutral-200 p-6 text-[15px] leading-7 dark:border-neutral-800"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(contract.content) }}
      />

      {creatorSig?.signedAt && (
        <div className="mt-4 text-sm text-neutral-500">
          Signed for {contract.channel.name} on{" "}
          {creatorSig.signedAt.toLocaleDateString()}:
          {creatorSig.signature?.startsWith("data:image") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={creatorSig.signature}
              alt={creatorSig.signerName}
              className="mt-1 h-14 rounded-lg border border-neutral-200 bg-white px-3 dark:border-neutral-700"
            />
          ) : (
            <span className="ml-1 font-serif text-base italic">
              {creatorSig.signerName}
            </span>
          )}
        </div>
      )}

      <div className="mt-8">
        {usable === "ok" ? (
          <SignContract
            token={token}
            signerName={row.signerName}
            consentText={CONTRACT_CONSENT_TEXT}
          />
        ) : (
          <p className="rounded-2xl border border-neutral-200 p-6 text-sm text-neutral-500 dark:border-neutral-800">
            {usable === "used" && contract.status === "SIGNED"
              ? "This agreement is fully signed. Keep the verification link for your records."
              : usable === "used"
                ? "This signing link was already used."
                : usable === "expired"
                  ? "This signing link has expired — ask the sender for a fresh one."
                  : "This contract is no longer open for signing."}
          </p>
        )}
      </div>

      <p className="mt-6 text-xs text-neutral-400">
        Anyone can verify this document&apos;s integrity at{" "}
        <a href={`/verify/${contract.id}`} className="underline">
          /verify/{contract.id}
        </a>
        .
      </p>
    </main>
  );
}
