import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { ApplicationsQueue } from "@/components/ApplicationsQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Applications" };

export default async function AdminApplicationsPage() {
  if (!(await isAdminUser())) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Admin
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Creator applications</h1>
        <Link href="/admin/invites" className="text-sm underline">
          Invite codes
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Review the teaching, not the paperwork. Rejections require a note —
        they are never arbitrary.
      </p>
      <ApplicationsQueue />
    </main>
  );
}
