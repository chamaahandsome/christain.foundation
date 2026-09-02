import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ACCESS_LEVELS, FEATURES, hasFeatureAccess } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { StudioTabs, type StudioTab } from "@/components/StudioTabs";

export const dynamic = "force-dynamic";

// The channel workspace: one header, persistent tabs, each tab a real URL.
// Tabs the visitor can't use aren't shown; every tab page still enforces its
// own access server-side.
export default async function ChannelStudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ channelId: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/signin");

  const { channelId } = await params;
  const access = await getChannelAccess(userId, channelId);
  if (!access.channel || !access.authorized) notFound();
  const fa = access.featureAccess;

  // Analytics, Team, and Payments live as sub-tabs under Settings.
  const settingsChildren: StudioTab[] = [
    hasFeatureAccess(fa, FEATURES.SETTINGS, ACCESS_LEVELS.MANAGER) && {
      slug: "settings",
      label: "General",
    },
    hasFeatureAccess(fa, FEATURES.ANALYTICS) && { slug: "analytics", label: "Analytics" },
    hasFeatureAccess(fa, FEATURES.TEAM) && { slug: "team", label: "Team" },
    // Money is owner-only — delegated staff never see payouts.
    access.isOwner && { slug: "payments", label: "Payments" },
  ].filter((tab): tab is StudioTab => Boolean(tab));

  const tabs: StudioTab[] = [
    hasFeatureAccess(fa, FEATURES.LIBRARY) && { slug: "library", label: "Library" },
    hasFeatureAccess(fa, FEATURES.LIBRARY) && { slug: "books", label: "Books" },
    hasFeatureAccess(fa, FEATURES.LIBRARY) && { slug: "campaigns", label: "Campaigns" },
    settingsChildren.length > 0 && {
      slug: settingsChildren[0].slug,
      label: "Settings",
      children: settingsChildren,
    },
  ].filter((tab): tab is StudioTab => Boolean(tab));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Creator studio
      </p>
      <h1 className="mt-2 text-2xl font-semibold">{access.channel.name}</h1>
      <p className="mt-1 text-sm text-neutral-500">
        @{access.channel.handle} · {access.channel.status.toLowerCase()}
        {!access.isOwner && " · you help manage this channel"}
      </p>
      <StudioTabs channelId={channelId} tabs={tabs} />
      {children}
    </main>
  );
}
