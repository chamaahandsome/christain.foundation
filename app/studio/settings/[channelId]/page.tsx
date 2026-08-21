import { redirect } from "next/navigation";

// Moved into the tabbed channel workspace.
export default async function Page({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  redirect(`/studio/channel/${channelId}/settings`);
}
