import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { AdminNav } from "@/components/AdminNav";
import { ModerationQueue } from "@/components/ModerationQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Moderation" };

export default async function AdminModerationPage() {
  if (!(await isAdminUser())) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Comment moderation</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Safety and abuse on published comments. Doctrinal concerns about
        teaching belong in the doctrine queue — this one is about conduct.
      </p>
      <AdminNav current="/admin/moderation" />
      <ModerationQueue />
    </main>
  );
}
