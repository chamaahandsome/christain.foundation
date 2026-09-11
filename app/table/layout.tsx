import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { TableTabs, type TableRoom } from "@/components/TableTabs";
import { myTableCounts } from "@/lib/table-queries";
import { primaryEmail } from "@/lib/viewer";

export const dynamic = "force-dynamic";

// The Table (PLAN §11.2) — the audience's own place. The Studio is where a
// creator works; this is where everyone else keeps what they have: what
// they have booked, bought, backed, and who they follow.
export default async function TableLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect("/");
  const { userId } = await auth();
  if (!userId) redirect("/signin?redirect_url=/table");

  const email = primaryEmail(await currentUser());
  const counts = await myTableCounts(userId, email);

  const rooms: TableRoom[] = [
    { slug: "", label: "Overview" },
    { slug: "appointments", label: "Appointments", count: counts.appointments },
    { slug: "books", label: "eBooks", count: counts.books },
    { slug: "backing", label: "Backing", count: counts.backed },
    { slug: "following", label: "Following", count: counts.following },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16">
      <TableTabs rooms={rooms} />
      {children}
    </main>
  );
}
