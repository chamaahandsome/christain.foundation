import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { InviteCodesAdmin } from "@/components/InviteCodesAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invite codes" };

export default async function AdminInvitesPage() {
  const { userId } = await auth();
  if (!isAdmin(userId)) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Founding-cohort invitations</h1>
        <Link href="/admin/applications" className="text-sm underline">
          Applications queue
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        An applicant who redeems a code may submit without vouches — there is
        no one to vouch for the first cohort. Codes are read aloud and retyped,
        so the alphabet skips 0/O and 1/I/L.
      </p>
      <InviteCodesAdmin />
    </main>
  );
}
