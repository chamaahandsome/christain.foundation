import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { InviteCodesAdmin } from "@/components/InviteCodesAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invite codes" };

export default async function AdminInvitesPage() {
  if (!(await isAdminUser())) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Admin
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Founding-cohort invitations</h1>
        <span className="flex gap-4">
          <Link href="/admin/applications" className="text-sm underline">
            Applications queue
          </Link>
          <Link href="/admin/doctrine" className="text-sm underline">
            Doctrine queue
          </Link>
        </span>
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
