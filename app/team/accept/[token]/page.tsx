import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { FEATURE_LIST, parseFeatureAccess } from "@/lib/team";
import { AcceptInviteButton } from "@/components/AcceptInviteButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team invitation" };

// Team-invitation landing page. The token in the URL identifies the invite;
// accepting requires signing in with the invited email (enforced server-side).
export default async function TeamAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const member = await db.teamMember.findUnique({
    where: { inviteToken: token },
    include: { channel: { select: { name: true, handle: true } } },
  });

  const expired =
    !member ||
    member.status !== "PENDING" ||
    !member.inviteExpiresAt ||
    member.inviteExpiresAt.getTime() < Date.now();

  if (expired) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">This invitation isn't available</h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          The link may have expired or been replaced. Ask the channel owner to
          send a new invitation.
        </p>
      </main>
    );
  }

  const access = parseFeatureAccess(member.featureAccess);
  const granted = FEATURE_LIST.filter((f) => access[f] && access[f] !== "none");

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Team invitation
      </p>
      <h1 className="mt-2 text-2xl font-semibold">
        Join the team of {member.channel.name}
      </h1>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        You've been invited to help manage{" "}
        <span className="font-medium">@{member.channel.handle}</span> as{" "}
        {member.email}.
      </p>
      <ul className="mt-6 space-y-2">
        {granted.map((feature) => (
          <li
            key={feature}
            className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
          >
            <span className="capitalize">{feature}</span>
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {access[feature]}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        {!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
          <p className="text-sm text-neutral-500">
            Accepting requires sign-in, which isn't configured yet.
          </p>
        ) : (
          <ClerkGateContent token={token} email={member.email} />
        )}
      </div>
    </main>
  );
}

function ClerkGateContent({ token, email }: { token: string; email: string }) {
  return (
    <>
      <SignedOut>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Sign in with {email} to accept.
        </p>
        <SignInButton mode="modal">
          <button className="mt-3 rounded-lg bg-neutral-900 hover:bg-orange-600 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <AcceptInviteButton token={token} />
      </SignedIn>
    </>
  );
}
