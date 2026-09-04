import { redirect } from "next/navigation";

export default async function LegacyBookingsTab({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;
  redirect(`/studio/channel/${channelId}/business?tab=bookings`);
}
