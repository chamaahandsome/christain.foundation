import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { NotificationsBell } from "@/components/NotificationsBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isAdminUser } from "@/lib/admin";

const hasClerkKeys = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const NAV = [
  { href: "/start", label: "Start Here" },
  { href: "/map", label: "The Map" },
  { href: "/explore", label: "Explore" },
  { href: "/search", label: "Search" },
];

export async function SiteHeader() {
  const admin = hasClerkKeys ? await isAdminUser() : false;
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cf-mark.png" alt="" className="h-7 w-7" />
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
          <ThemeToggle />
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
                {admin && (
                  <Link
                    href="/admin/applications"
                    className="rounded-lg px-3 py-1.5 font-medium text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                  >
                    Admin
                  </Link>
                )}
                <NotificationsBell />
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="rounded-lg bg-neutral-900 px-3 py-1.5 font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white">
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
