import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { AdminNav } from "@/components/AdminNav";
import { ShelvesAdmin } from "@/components/ShelvesAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shelves" };

export default async function AdminShelvesPage() {
  if (!(await isAdminUser())) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Editorial shelves</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Hand-curated rows shown on explore. Draft shelves are invisible until
        published.
      </p>
      <AdminNav current="/admin/shelves" />
      <ShelvesAdmin />
    </main>
  );
}
