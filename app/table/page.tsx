import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppointmentCard } from "@/components/AppointmentCard";
import { VideoCard } from "@/components/VideoCard";
import { primaryEmail } from "@/lib/viewer";
import { tableIsEmpty } from "@/lib/table";
import {
  latestFromFollowed,
  myAppointmentRooms,
  myBacked,
  myBooks,
  myFollowing,
  myTableCounts,
} from "@/lib/table-queries";
import { progressPercent } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const metadata = { title: "Your table" };

// The hub (PLAN §11.2): a slice of every room, and one thing to do next.
//
// Order matters here more than anything else on the page. The tab bar above
// already lists every room and its count, so repeating them as full sections
// only means someone who has followed one creator is told three times over
// what they have not done before they reach the eight videos they have. So:
// what you have comes first, at whatever size it deserves, and the rooms you
// have not opened gather into a single invitation at the foot.
export default async function TablePage() {
  const { userId } = await auth();
  if (!userId) redirect("/signin?redirect_url=/table");
  const user = await currentUser();
  const email = primaryEmail(user);

  const [counts, appointments, books, backed, following, videos] = await Promise.all([
    myTableCounts(userId, email),
    myAppointmentRooms(userId, email),
    myBooks(userId, 6),
    myBacked(userId, 2),
    myFollowing(userId, 12),
    latestFromFollowed(userId, 8),
  ]);

  const firstName = user?.firstName?.trim();
  const next = appointments.upcoming[0] ?? null;
  // Everything ahead that isn't already the "Next up" card.
  const alsoAhead = [
    ...appointments.upcoming.slice(next ? 1 : 0, next ? 3 : 2),
    ...appointments.awaiting.slice(0, 2),
  ];

  // A room nobody has opened yet becomes an invitation, not a section.
  const unopened = [
    {
      key: "appointments",
      title: "Book a conversation",
      line: "Sit down with someone who teaches here.",
      href: "/explore",
      open: counts.appointments > 0,
    },
    {
      key: "books",
      title: "Find a book",
      line: "Written by the people you're learning from.",
      href: "/ebooks",
      open: counts.books > 0,
    },
    {
      key: "backed",
      title: "Back a campaign",
      line: "Help get something made.",
      href: "/campaigns",
      open: counts.backed > 0,
    },
    {
      key: "following",
      title: "Follow a creator",
      line: "Their newest teaching lands here.",
      href: "/explore",
      open: counts.following > 0,
    },
  ].filter((room) => !room.open);

  return (
    <div className="py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
        Your table
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">
        {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        What you&apos;ve booked, bought, backed, and who you&apos;re walking with.
      </p>

      {tableIsEmpty(counts) ? (
        <Welcome />
      ) : (
        <div className="mt-8 space-y-12">
          {next && (
            <section>
              <SectionHead title="Next up" />
              <AppointmentCard a={next} />
              {alsoAhead.length > 0 && (
                <div className="mt-3 space-y-3">
                  {alsoAhead.map((a) => (
                    <AppointmentCard key={a.id} a={a} />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Nothing agreed, but something asked for — still worth surfacing. */}
          {!next && alsoAhead.length > 0 && (
            <section>
              <SectionHead
                title="Waiting to hear back"
                count={counts.appointments}
                href="/table/appointments"
              />
              <div className="space-y-3">
                {alsoAhead.map((a) => (
                  <AppointmentCard key={a.id} a={a} />
                ))}
              </div>
            </section>
          )}

          {/* The page's centre of gravity: what the people you follow just put
              out. It leads because it is the only part that changes daily. */}
          {counts.following > 0 && (
            <section>
              <SectionHead
                title={videos.length > 0 ? "Latest from the table" : "Following"}
                href="/table/following"
                lead
              />
              <ul className="flex flex-wrap gap-2">
                {following.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/@${c.handle}`}
                      className="flex items-center gap-2 rounded-full border border-neutral-200 py-1 pl-1 pr-3 text-sm transition-colors hover:border-amber-400 dark:border-neutral-800 dark:hover:border-amber-600"
                    >
                      {c.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.avatarUrl}
                          alt=""
                          className="h-7 w-7 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 text-xs font-semibold text-white">
                          {c.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>

              {videos.length > 0 ? (
                <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                  {videos.map((item) => (
                    <li key={item.id}>
                      <VideoCard item={item} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-neutral-500">
                  Nothing new from them yet —{" "}
                  <Link
                    href="/explore"
                    className="text-amber-700 hover:underline dark:text-amber-400"
                  >
                    follow a few more
                  </Link>{" "}
                  and this fills up.
                </p>
              )}
            </section>
          )}

          {counts.books > 0 && (
            <section>
              <SectionHead
                title="Your eBooks"
                count={counts.books}
                href="/table/books"
              />
              <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                {books.map((book) => (
                  <li key={book.id}>
                    <Link href={`/read/${book.id}`} className="group block">
                      {book.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.coverImageUrl}
                          alt=""
                          className="aspect-5/7 w-full rounded-lg object-cover shadow-sm transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex aspect-5/7 w-full items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600 p-2 text-center text-xs font-semibold text-white shadow-sm">
                          {book.title}
                        </div>
                      )}
                      <p className="mt-2 line-clamp-2 text-xs font-medium group-hover:underline">
                        {book.title}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {counts.backed > 0 && (
            <section>
              <SectionHead
                title="You're backing"
                count={counts.backed}
                href="/table/backing"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {backed.map((pl) => (
                  <Link
                    key={pl.id}
                    href={`/campaign/${pl.campaign.slug}`}
                    className="block rounded-2xl border border-neutral-200 p-4 transition-colors hover:border-amber-400 dark:border-neutral-800 dark:hover:border-amber-600"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate font-medium">{pl.campaign.title}</p>
                      <span className="shrink-0 text-xs text-neutral-500">
                        You gave ${(pl.amountCents / 100).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
                        style={{
                          width: `${progressPercent(
                            pl.campaign.raisedCents,
                            pl.campaign.goalCents,
                          )}%`,
                        }}
                      />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* One invitation instead of three refusals. */}
          {unopened.length > 0 && (
            <section className="border-t border-neutral-200 pt-8 dark:border-neutral-800">
              <h2 className="font-semibold">Room at the table</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Whatever you take up lands here.
              </p>
              <div
                className={`mt-4 grid gap-3 sm:grid-cols-2 ${
                  unopened.length > 2 ? "lg:grid-cols-3" : ""
                }`}
              >
                {unopened.map((room) => (
                  <Link
                    key={room.key}
                    href={room.href}
                    className="group rounded-xl border border-neutral-200 p-4 transition-colors hover:border-amber-400 dark:border-neutral-800 dark:hover:border-amber-600"
                  >
                    <p className="font-medium">
                      {room.title}
                      <span className="ml-1 inline-block text-amber-600 transition-transform group-hover:translate-x-0.5 dark:text-amber-400">
                        →
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-neutral-500">{room.line}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHead({
  title,
  count,
  href,
  lead,
}: {
  title: string;
  count?: number;
  href?: string;
  /** the section carrying the page — given its own weight */
  lead?: boolean;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2
        className={
          lead
            ? "text-lg font-semibold tracking-tight"
            : "text-sm font-semibold uppercase tracking-wide text-neutral-500"
        }
      >
        {title}
        {typeof count === "number" && count > 0 && (
          <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
            {count}
          </span>
        )}
      </h2>
      {href && (
        <Link
          href={href}
          className="shrink-0 text-sm text-amber-700 hover:underline dark:text-amber-400"
        >
          See all →
        </Link>
      )}
    </div>
  );
}

function Welcome() {
  const cards = [
    {
      href: "/start",
      title: "Start Here",
      line: "The path through the essentials, one step at a time.",
    },
    {
      href: "/explore",
      title: "Explore the library",
      line: "Teaching from every creator, indexed and placed on the map.",
    },
    {
      href: "/ebooks",
      title: "The bookstore",
      line: "Books written by the people you're learning from.",
    },
  ];
  return (
    <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
      <p className="text-4xl">🍽️</p>
      <p className="mt-3 font-medium">Your table is set, and empty</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">
        Follow a creator, sit down with a book, book a conversation — whatever
        you take up will be waiting here.
      </p>
      <div className="mt-6 grid gap-3 text-left sm:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-xl border border-neutral-200 p-4 transition-colors hover:border-amber-400 dark:border-neutral-800 dark:hover:border-amber-600"
          >
            <p className="font-medium">{c.title}</p>
            <p className="mt-1 text-sm text-neutral-500">{c.line}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
