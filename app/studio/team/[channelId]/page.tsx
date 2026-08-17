import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { getChannelAccess } from "@/lib/team-authorization";
import { TeamManager } from "@/components/TeamManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Team" };

// Channel team roster (PLAN §4: ministry staff manage a teacher's channel).
// The owner manages; team members with "team" access may view.
export default async function StudioTeamPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId, "team");
  if (!access.channel) notFound();
  if (!access.isOwner && !access.authorized) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold">
        Team — {access.channel.name}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Ministry staff can run the channel with per-feature access: the library
        without the team, viewing without editing.
        {access.isOwner
          ? " Invitations are links — copy one and send it to the person yourself."
          : " Only the channel owner can change the roster."}
      </p>
      <TeamManager channelId={channelId} />
    </main>
  );
}
