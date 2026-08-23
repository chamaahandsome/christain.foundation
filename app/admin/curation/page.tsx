import { notFound } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import { AdminNav } from "@/components/AdminNav";
import { CurationTool } from "@/components/CurationTool";

export const dynamic = "force-dynamic";
export const metadata = { title: "Curation" };

export default async function AdminCurationPage() {
  if (!(await isAdminUser())) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Map curation</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Place library teaching onto the map — a topic, a question, or a
        position on a disputed question. This is the founding-cohort indexing
        work: the map is only as good as what's placed on it.
      </p>
      <AdminNav current="/admin/curation" />
      <CurationTool />
    </main>
  );
}
