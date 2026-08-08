import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { NotificationsBell } from "@/components/NotificationsBell";

const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const NAV = [
  { href: "/start-here", label: "Start Here" },
  { href: "/map", label: "The Map" },
  { href: "/explore", label: "Explore" },
  { href: "/search", label: "Search" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="shrink-0 font-semibold tracking-tight">
          Christian Foundation
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          {hasClerkKeys ? (
            <>
              <SignedIn>
                <Link
                  href="/feed"
                  className="rounded-lg px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                >
                  Feed
                </Link>
                <Link
                  href="/studio"
                  className="rounded-lg px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                >
                  Studio
                </Link>
                <NotificationsBell />
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="rounded-lg bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300">
                    Sign in
                  </button>
                </SignInButton>
              </SignedOut>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
