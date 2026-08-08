"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";

export function FollowButton({
  channelId,
  initialFollowing,
  initialFollowers,
}: {
  channelId: string;
  initialFollowing: boolean;
  initialFollowers: number;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [followers, setFollowers] = useState(initialFollowers);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
        setFollowers(data.followers);
      }
    } finally {
      setBusy(false);
    }
  }

  const label = following ? "Following" : "Follow";

  return (
    <span className="inline-flex items-center gap-2">
      <SignedIn>
        <button
          onClick={() => void toggle()}
          disabled={busy}
          className={
            following
              ? "rounded-lg border border-neutral-300 px-4 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
              : "rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          }
        >
          {label}
        </button>
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="rounded-lg bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900">
            Follow
          </button>
        </SignInButton>
      </SignedOut>
      <span className="text-sm text-neutral-500">{followers} followers</span>
    </span>
  );
}
