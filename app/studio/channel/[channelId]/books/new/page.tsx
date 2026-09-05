import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";
import { ACCESS_LEVELS, FEATURES } from "@/lib/team";
import { getChannelAccess } from "@/lib/team-authorization";
import { CreateBookForm } from "@/components/CreateBookForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "New book" };

export default async function NewBookPage({
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
    FEATURES.BOOKS,
    ACCESS_LEVELS.MANAGER,
  );
  if (!access.channel || !access.authorized) notFound();

  return <CreateBookForm channelId={channelId} />;
}
