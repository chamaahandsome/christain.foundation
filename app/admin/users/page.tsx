import Link from "next/link";
import { notFound } from "next/navigation";
import { TransactionStatus } from "@prisma/client";
import { isAdminUser } from "@/lib/admin";
import { db } from "@/lib/db";
import { AdminNav } from "@/components/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

// Platform-level user analytics: who signed up, who creates, what they've
// published, and what it earns. Creator earnings come from the SUCCEEDED
// transaction ledger, so refunds drop out automatically.

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

export default async function AdminUsersPage() {
  if (!(await isAdminUser())) notFound();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [userCount, newUsers, channels, pendingApps, itemCount, revenue, txByChannel, recentUsers] =
    await Promise.all([
      db.user.count(),
      db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.channel.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { name: true, email: true } },
          _count: {
            select: { contentItems: true, ebooks: true, campaigns: true, followers: true },
          },
        },
      }),
      db.creatorApplication.count({ where: { status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
      db.contentItem.count(),
      db.transaction.aggregate({
        where: { status: TransactionStatus.SUCCEEDED },
        _sum: { amountCents: true, feeCents: true },
      }),
      db.transaction.groupBy({
        by: ["channelId"],
        where: { status: TransactionStatus.SUCCEEDED },
        _sum: { amountCents: true, feeCents: true },
        _count: { _all: true },
      }),
      db.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          _count: { select: { channels: true, transactions: true } },
        },
      }),
    ]);

  const revenueByChannel = new Map(txByChannel.map((r) => [r.channelId, r]));
  const grossCents = revenue._sum.amountCents ?? 0;
  const feesCents = revenue._sum.feeCents ?? 0;

  const totals = [
    { label: "Users", value: String(userCount), sub: `+${newUsers} in 30d` },
    {
      label: "Creators",
      value: String(channels.filter((c) => c.status === "APPROVED").length),
      sub: `${pendingApps} application${pendingApps === 1 ? "" : "s"} pending`,
    },
    { label: "Library items", value: itemCount.toLocaleString(), sub: "all channels" },
    {
      label: "Gross payments",
      value: money(grossCents),
      sub: `${money(feesCents)} platform fees`,
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Admin
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Users &amp; creators</h1>
      <AdminNav current="/admin/users" />

      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {totals.map((stat) => (
          <div key={stat.label}>
            <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {stat.label}
            </p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{stat.sub}</p>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Creators
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                <th className="py-2 pr-4 font-medium">Channel</th>
                <th className="py-2 pr-4 font-medium">Owner</th>
                <th className="py-2 pr-4 font-medium">Joined</th>
                <th className="py-2 pr-4 text-right font-medium">Items</th>
                <th className="py-2 pr-4 text-right font-medium">Books</th>
                <th className="py-2 pr-4 text-right font-medium">Campaigns</th>
                <th className="py-2 pr-4 text-right font-medium">Gross</th>
                <th className="py-2 text-right font-medium">CF fees</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => {
                const rev = revenueByChannel.get(c.id);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-neutral-100 dark:border-neutral-900"
                  >
                    <td className="py-2.5 pr-4">
                      <Link
                        href={`/@${c.handle}`}
                        className="font-medium hover:underline"
                      >
                        {c.name}
                      </Link>
                      <span className="ml-2 text-xs text-neutral-400">
                        {c.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="max-w-[180px] truncate py-2.5 pr-4 text-neutral-600 dark:text-neutral-400">
                      {c.owner.name ?? c.owner.email}
                    </td>
                    <td className="whitespace-nowrap py-2.5 pr-4 text-neutral-500">
                      {c.createdAt.toLocaleDateString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right">{c._count.contentItems}</td>
                    <td className="py-2.5 pr-4 text-right">{c._count.ebooks}</td>
                    <td className="py-2.5 pr-4 text-right">{c._count.campaigns}</td>
                    <td className="py-2.5 pr-4 text-right font-medium">
                      {money(rev?._sum.amountCents ?? 0)}
                    </td>
                    <td className="py-2.5 text-right text-neutral-500">
                      {money(rev?._sum.feeCents ?? 0)}
                    </td>
                  </tr>
                );
              })}
              {channels.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-neutral-500">
                    No channels yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Recent sign-ups
        </h2>
        <ul className="mt-3 divide-y divide-neutral-100 text-sm dark:divide-neutral-900">
          {recentUsers.map((u) => (
            <li key={u.id} className="flex items-baseline justify-between gap-3 py-2.5">
              <span className="min-w-0 truncate">
                <span className="font-medium">{u.name ?? "—"}</span>{" "}
                <span className="text-neutral-500">{u.email}</span>
              </span>
              <span className="shrink-0 text-xs text-neutral-500">
                {u._count.channels > 0 && "creator · "}
                {u._count.transactions > 0 && `${u._count.transactions} payments · `}
                {u.createdAt.toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
