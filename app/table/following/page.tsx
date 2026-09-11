import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { VideoCard } from "@/components/VideoCard";
import { latestFromFollowed, myFollowing } from "@/lib/table-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Following" };

// The follow loop, both halves in one room: who you follow, and what they
// have put out since. The library is embedded YouTube (PLAN §2, Layer 1) —
// their teaching, watched inside CF's chrome.
export default async function FollowingRoom() {
  const { userId } = await auth();
  if (!userId) redirect("/signin?redirect_url=/table/following");
  const [channels, videos] = await Promise.all([
    myFollowing(userId),
    latestFromFollowed(userId, 48),
  ]);

  return (
    <div className="py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Your table
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Following</h1>
      <p className="mt-1 text-sm text-neutral-500">
        The people you&apos;re learning from, and their latest teaching.
      </p>

      {channels.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
          <p className="text-4xl">👥</p>
          <p className="mt-3 font-medium">You&apos;re not following anyone yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            Follow a creator and everything they publish lands here.
          </p>
          <Link
            href="/explore"
            className="mt-4 inline-block text-sm text-amber-700 hover:underline dark:text-amber-400"
          >
            Explore the library →
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Creators
              <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
                {channels.length}
              </span>
            </h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {channels.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/@${c.handle}`}
                    className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3 transition-colors hover:border-amber-400 dark:border-neutral-800 dark:hover:border-amber-600"
                  >
                    {c.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.avatarUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 font-semibold text-white">
                        {c.name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {c.name}
                      </span>
                      <span className="block truncate text-xs text-neutral-500">
                        {c._count.contentItems} videos ·{" "}
                        {c.kind.charAt(0) + c.kind.slice(1).toLowerCase()}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Latest from them
            </h2>
            {videos.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Nothing published yet from the creators you follow.
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {videos.map((item) => (
                  <li key={item.id}>
                    <VideoCard item={item} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
