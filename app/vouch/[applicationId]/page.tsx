import { auth } from "@clerk/nextjs/server";
import { SignedOut, SignInButton } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { affirmationComplete } from "@/lib/gate";
import { VouchForm } from "@/components/VouchForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vouch for an applicant" };

// The voucher-facing side of the creator gate (concept §5.3): an applicant
// shares this link with an approved creator who knows their ministry. Trust
// compounds; it doesn't scale by committee.
export default async function VouchPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { userId } = await auth();

  const application = await db.creatorApplication.findUnique({
    where: { id: applicationId },
    include: {
      user: { select: { name: true } },
      vouches: {
        include: { voucherChannel: { select: { handle: true, name: true } } },
      },
    },
  });
  if (!application) notFound();
  const open =
    application.status === "DRAFT" || application.status === "SUBMITTED";

  // Affirmation state — a voucher should see whether the statement is signed.
  const statement = await db.statementVersion.findFirst({
    where: { publishedAt: { not: null } },
    orderBy: { version: "desc" },
    include: { clauses: { select: { key: true } } },
  });
  const affirmations = statement
    ? await db.affirmationRecord.findMany({
        where: { userId: application.userId, statementVersionId: statement.id },
        select: { clause: { select: { key: true } } },
      })
    : [];
  const affirmation = statement
    ? affirmationComplete(
        statement.clauses.map((c) => c.key),
        affirmations.map((a) => a.clause.key),
      )
    : { complete: false, missing: [] };

  // The signed-in visitor's approved channels — the credential to vouch with.
  const voucherChannels = userId
    ? await db.channel.findMany({
        where: { ownerId: userId, status: "APPROVED" },
        select: { id: true, handle: true, name: true },
      })
    : [];

  const alreadyVouched = new Set(
    application.vouches.map((v) => v.voucherChannel.handle),
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        The creator gate
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Vouch for {application.proposedName}</h1>
      <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        {application.user.name ?? "An applicant"} is applying to publish on
        Christian Foundation as{" "}
        <span className="font-medium">@{application.proposedHandle}</span> (
        {application.proposedKind.toLowerCase()}). A vouch says: I know this
        person or their ministry, and I put my name behind them.
      </p>

      <section className="mt-6 rounded-xl border border-neutral-200 p-6 dark:border-neutral-800">
        <p className="text-sm font-medium">
          Doctrinal statement:{" "}
          {affirmation.complete ? (
            <span className="text-green-600 dark:text-green-400">
              affirmed in full
            </span>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              not yet fully affirmed
            </span>
          )}
        </p>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {application.ministryStatement}
        </p>
        {application.vouches.length > 0 && (
          <p className="mt-3 text-xs text-neutral-500">
            Already vouched by:{" "}
            {application.vouches.map((v) => `@${v.voucherChannel.handle}`).join(", ")}
          </p>
        )}
      </section>

      <div className="mt-8">
        {!open ? (
          <p className="text-sm text-neutral-500">
            This application is no longer open for vouching.
          </p>
        ) : !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <p className="text-sm text-neutral-500">
            Vouching requires sign-in, which isn't configured yet.
          </p>
        ) : (
          <>
            <SignedOut>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Sign in to vouch. Only approved creators can vouch.
              </p>
              <SignInButton mode="modal">
                <button className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
                  Sign in
                </button>
              </SignInButton>
            </SignedOut>
            {userId &&
              (voucherChannels.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  Vouching is reserved for approved creators — you don't have an
                  approved channel yet.
                </p>
              ) : (
                <VouchForm
                  applicationId={application.id}
                  channels={voucherChannels.filter(
                    (c) => !alreadyVouched.has(c.handle),
                  )}
                  alreadyVouchedAll={voucherChannels.every((c) =>
                    alreadyVouched.has(c.handle),
                  )}
                />
              ))}
          </>
        )}
      </div>
    </main>
  );
}
