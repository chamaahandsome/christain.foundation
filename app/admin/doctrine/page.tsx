import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { DoctrineQueue } from "@/components/DoctrineQueue";

export const dynamic = "force-dynamic";
export const metadata = { title: "Doctrine review" };

export default async function AdminDoctrinePage() {
  const { userId } = await auth();
  if (!isAdmin(userId)) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Admin
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Doctrine review queue</h1>
        <Link href="/admin/applications" className="text-sm underline">
          Applications queue
        </Link>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        The signature is the gate; the body of work is the audit (§5.4).
        Review the cited teaching, not the person. Every outcome carries a
        note; upheld decisions can be appealed.
      </p>
      <DoctrineQueue />
    </main>
  );
}
