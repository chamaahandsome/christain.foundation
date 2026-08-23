import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getChannelAccess } from "@/lib/team-authorization";
import { PaymentsCard } from "@/components/PaymentsCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };

// Stripe Connect status + onboarding. Owner-only: money never delegates.
export default async function PaymentsTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId);
  if (!access.channel || !access.isOwner) notFound();

  const channel = await db.channel.findUniqueOrThrow({
    where: { id: channelId },
    select: {
      stripeAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeOnboardedAt: true,
    },
  });

  return (
    <section className="mt-6">
      <p className="text-sm text-neutral-500">
        Payouts run on Stripe. Commerce charges carry CF's platform fee;
        partner giving (when it launches) goes directly to your account — you
        are the merchant of record, never CF.
      </p>
      <PaymentsCard
        channelId={channelId}
        connected={Boolean(channel.stripeAccountId)}
        chargesEnabled={channel.stripeChargesEnabled}
        payoutsEnabled={channel.stripePayoutsEnabled}
        onboardedAt={channel.stripeOnboardedAt?.toISOString() ?? null}
      />
    </section>
  );
}
