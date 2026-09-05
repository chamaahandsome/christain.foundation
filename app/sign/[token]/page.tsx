import { db } from "@/lib/db";
import {
  CONTRACT_CONSENT_TEXT,
  extractRecipientFields,
  signatureBlockHtml,
  substituteSignatureFields,
  tokenUsable,
} from "@/lib/contracts";
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
          signatures: true,
          signTokens: { orderBy: { createdAt: "asc" } },
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
    // (partially-signed contracts keep their status on view)
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

  const creatorSig = contract.signatures.find((s) => s.signerRole === "creator");
  const clientSigs = contract.signatures.filter(
    (s) => s.signerRole === "client" && s.signedAt,
  );
  // One roster row per signing token (each recipient has their own link),
  // matched against recorded signatures — who signed, who hasn't.
  const roster = contract.signTokens.map((tk) => {
    const sig = clientSigs.find(
      (s) => s.signerEmail.toLowerCase() === tk.signerEmail.toLowerCase(),
    );
    return {
      email: tk.signerEmail,
      name: sig?.signerName ?? tk.signerName,
      signedAt: sig?.signedAt ?? null,
      isYou: tk.token === token,
    };
  });
  // The creator's chip renders as their real signature; the client's chip
  // stays visible as the "sign here" marker. Recipient fill-ins become the
  // form in the signing panel.
  let displayHtml = sanitizeRichHtml(
    contract.status === "SIGNED" && contract.signedContent
      ? contract.signedContent
      : contract.content,
  );
  if (creatorSig?.signature) {
    displayHtml = substituteSignatureFields(
      displayHtml,
      "creator",
      signatureBlockHtml({
        signature: creatorSig.signature,
        signerName: creatorSig.signerName,
        signedAt: creatorSig.signedAt,
      }),
    );
  }
  // Co-signers who already signed render in place; the current signer's
  // chips stay visible as their sign-here markers.
  for (const sig of clientSigs) {
    displayHtml = substituteSignatureFields(
      displayHtml,
      "client",
      signatureBlockHtml({
        signature: sig.signature!,
        signerName: sig.signerName,
        signedAt: sig.signedAt,
      }),
      {
        email: sig.signerEmail.toLowerCase(),
        includeUnassigned:
          sig.signerEmail.toLowerCase() === contract.clientEmail.toLowerCase(),
      },
    );
  }
  const recipientFields = extractRecipientFields(displayHtml);

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

      {/* Who has signed, who hasn't — the chips in the document mark where
          each signature lands. */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div
          className={`flex items-center gap-3 rounded-xl border p-3 ${
            creatorSig?.signedAt
              ? "border-green-300 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30"
              : "border-neutral-200 dark:border-neutral-800"
          }`}
        >
          <span className="text-lg">{creatorSig?.signedAt ? "✅" : "⏳"}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {creatorSig?.signerName ?? contract.channel.name}
              <span className="ml-1.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:bg-neutral-800">
                sender
              </span>
            </p>
            <p className="text-xs text-neutral-500">
              {creatorSig?.signedAt
                ? `Signed ${creatorSig.signedAt.toLocaleDateString()}`
                : "Awaiting signature"}
            </p>
          </div>
        </div>
        {roster.map((r) => (
          <div
            key={r.email}
            className={`flex items-center gap-3 rounded-xl border p-3 ${
              r.signedAt
                ? "border-green-300 bg-green-50/60 dark:border-green-900 dark:bg-green-950/30"
                : r.isYou
                  ? "border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"
                  : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <span className="text-lg">{r.signedAt ? "✅" : r.isYou ? "✍️" : "⏳"}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {r.name}
                {r.isYou && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    you
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-neutral-500">
                {r.signedAt
                  ? `Signed ${r.signedAt.toLocaleDateString()}`
                  : r.isYou
                    ? `Your turn — sign below (${r.email})`
                    : `Pending · ${r.email}`}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[3px] border border-neutral-300/80 bg-white px-6 py-8 text-neutral-900 shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_32px_rgba(0,0,0,0.12)] sm:px-10 dark:border-neutral-600">
        {contract.logoUrl && (
          <div className="border-b-2 border-neutral-200 pb-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={contract.logoUrl} alt="" className="mx-auto h-20 object-contain" />
          </div>
        )}
        <div
          className="prose-reader text-[15px] leading-7"
          dangerouslySetInnerHTML={{ __html: displayHtml }}
        />
      </div>

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
            fields={recipientFields}
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
