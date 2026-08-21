import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import type { ChannelLinks } from "@/lib/channel-settings";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { ChannelSettingsForm } from "@/components/ChannelSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Channel settings" };

export default async function SettingsTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(
    userId,
    channelId,
    FEATURES.SETTINGS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel || !access.authorized) notFound();

  const channel = await db.channel.findUniqueOrThrow({
    where: { id: channelId },
    select: { id: true, name: true, bio: true, links: true, youtubeChannelId: true },
  });

  return (
    <section className="mt-6">
      <p className="text-sm text-neutral-500">
        The handle itself is fixed — it's a public identity.
      </p>
      <ChannelSettingsForm
        channelId={channel.id}
        initial={{
          name: channel.name,
          bio: channel.bio ?? "",
          links: (channel.links as ChannelLinks | null) ?? {},
          youtubeChannelId: channel.youtubeChannelId ?? "",
        }}
      />
    </section>
  );
}
