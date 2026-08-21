import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ACCESS_LEVELS, FEATURES, hasFeatureAccess } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";

// The workspace root lands on the first tab the visitor can actually use.
export default async function ChannelStudioIndex({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId);
  if (!access.channel || !access.authorized) notFound();
  const fa = access.featureAccess;

  const slug = hasFeatureAccess(fa, FEATURES.LIBRARY)
    ? "library"
    : hasFeatureAccess(fa, FEATURES.ANALYTICS)
      ? "analytics"
      : hasFeatureAccess(fa, FEATURES.TEAM)
        ? "team"
        : hasFeatureAccess(fa, FEATURES.SETTINGS, ACCESS_LEVELS.MANAGER)
          ? "settings"
          : null;
  if (!slug) notFound();

  redirect(`/studio/channel/${channelId}/${slug}`);
}
