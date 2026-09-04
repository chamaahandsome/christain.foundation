"use client";

// Public campaign page interior (the Maltivas /campaigns/[id] layout):
// left — media + Story | Updates | Backers tabs; right — sticky sidebar
// with the raised figure, stat grid, Support button (opens the pledge
// modal), and reward tiers.

import { useState } from "react";
import { PledgeCard } from "@/components/PledgeCard";

interface UpdateView {
  id: string;
  title: string;
  bodyHtml: string;
  date: string;
  backersOnly: boolean;
}
interface BackerView {
  id: string;
  name: string;
  amountCents: number;
  date: string;
}
interface RewardView {
  id: string;
  title: string;
  description: string;
  amountCents: number;
  maxBackers: number | null;
  backersCount: number;
  active: boolean;
  imageUrl: string | null;
  deliveryType: string;
}

export function CampaignDetail(props: {
  campaignId: string;
  category: string;
  channelName: string;
  signedIn: boolean;
  tricklEnabled: boolean;
  open: boolean;
  storyHtml: string | null;
  videoId: string | null;
  coverImageUrl: string | null;
  raisedCents: number;
  goalCents: number;
  backersCount: number;
  daysLeft: number | null;
  updates: UpdateView[];
  backers: BackerView[];
  rewards: RewardView[];
}) {
  const [tab, setTab] = useState<"story" | "updates" | "backers">("story");
  const [pledgeOpen, setPledgeOpen] = useState(false);
  const pct =
    props.goalCents > 0
      ? Math.min(100, Math.floor((props.raisedCents / props.goalCents) * 100))
      : 0;

  const pill = (active: boolean) =>
    `flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      active
        ? "bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-sm"
        : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
    }`;

  return (
    <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-3">
      {/* Left — media + tabs */}
      <div className="space-y-6 lg:col-span-2">
        {props.videoId ? (
          <div className="overflow-hidden rounded-2xl">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${props.videoId}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full border-0"
              title="Campaign video"
            />
          </div>
        ) : (
          props.coverImageUrl && (
            <div className="overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={props.coverImageUrl} alt="" className="w-full object-cover" />
            </div>
          )
        )}

        <div className="flex gap-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
          <button onClick={() => setTab("story")} className={pill(tab === "story")}>
            Story
          </button>
          <button onClick={() => setTab("updates")} className={pill(tab === "updates")}>
            Updates ({props.updates.length})
          </button>
          <button onClick={() => setTab("backers")} className={pill(tab === "backers")}>
            Backers ({props.backersCount})
          </button>
        </div>

        {tab === "story" &&
          (props.storyHtml ? (
            <div
              className="prose-reader text-[15px] leading-7 text-neutral-700 dark:text-neutral-300"
              dangerouslySetInnerHTML={{ __html: props.storyHtml }}
            />
          ) : (
            <p className="text-sm text-neutral-500">
              The full story hasn&apos;t been written yet.
            </p>
          ))}

        {tab === "updates" &&
          (props.updates.length > 0 ? (
            <div className="space-y-5">
              {props.updates.map((u) => (
                <article
                  key={u.id}
                  className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-medium">{u.title}</h3>
                    <time className="shrink-0 text-xs text-neutral-500">{u.date}</time>
                  </div>
                  <div
                    className="prose-reader mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400"
                    dangerouslySetInnerHTML={{ __html: u.bodyHtml }}
                  />
                  {u.backersOnly && (
                    <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-amber-600">
                      Backers only
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              No updates yet — backers will hear here first.
            </p>
          ))}

        {tab === "backers" &&
          (props.backers.length > 0 ? (
            <ul className="space-y-2">
              {props.backers.map((b) => (
                <li
                  key={b.id}
                  className="flex items-baseline justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
                >
                  <span className="font-medium">{b.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500">
                    ${(b.amountCents / 100).toLocaleString()} · {b.date}
                  </span>
                </li>
              ))}
              {props.backersCount > props.backers.length && (
                <li className="text-center text-xs text-neutral-400">
                  and {props.backersCount - props.backers.length} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">
              No backers yet — be the first to stand behind this.
            </p>
          ))}
      </div>

      {/* Right — sticky sidebar */}
      <div className="h-fit space-y-6 lg:sticky lg:top-20">
        <div className="rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800">
          <p className="text-3xl font-semibold tracking-tight">
            ${(props.raisedCents / 100).toLocaleString()}
          </p>
          <p className="text-sm text-neutral-500">
            raised of ${(props.goalCents / 100).toLocaleString()}
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xl font-semibold">{props.backersCount}</p>
              <p className="text-xs text-neutral-500">
                supporter{props.backersCount === 1 ? "" : "s"}
              </p>
            </div>
            <div>
              <p className="text-xl font-semibold">
                {props.daysLeft !== null ? props.daysLeft : "∞"}
              </p>
              <p className="text-xs text-neutral-500">
                {props.daysLeft !== null ? "days to go" : "open-ended"}
              </p>
            </div>
          </div>
          {props.open ? (
            <button
              onClick={() => setPledgeOpen(true)}
              className="mt-5 w-full rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500"
            >
              🤝 Back this campaign
            </button>
          ) : (
            <p className="mt-5 rounded-xl border border-neutral-200 p-4 text-center text-sm text-neutral-500 dark:border-neutral-800">
              This campaign has ended.
            </p>
          )}
        </div>

        {props.rewards.filter((r) => r.active).length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Rewards
            </h3>
            {props.rewards
              .filter((r) => r.active)
              .map((r) => (
                <button
                  key={r.id}
                  onClick={() => props.open && setPledgeOpen(true)}
                  className="block w-full rounded-2xl border border-neutral-200 p-4 text-left transition-colors hover:border-amber-400 dark:border-neutral-800 dark:hover:border-amber-600"
                >
                  <div className="flex items-start gap-3">
                    {r.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.imageUrl}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        ${(r.amountCents / 100).toFixed(0)}+ — {r.title}
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-neutral-500">
                        {r.description}
                      </p>
                      <p className="mt-1 text-[11px] text-neutral-400">
                        {r.maxBackers
                          ? `${Math.max(0, r.maxBackers - r.backersCount)} left`
                          : `${r.backersCount} claimed`}
                        {r.deliveryType === "physical" && " · 📦 ships to you"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Pledge modal (the PledgeFormWrapper flow) */}
      {pledgeOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPledgeOpen(false);
          }}
        >
          <div className="w-full max-w-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Back {props.channelName}
              </h3>
              <button
                onClick={() => setPledgeOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="rounded-2xl bg-white dark:bg-neutral-900">
              <PledgeCard
                campaignId={props.campaignId}
                category={props.category}
                channelName={props.channelName}
                signedIn={props.signedIn}
                tricklEnabled={props.tricklEnabled}
                rewards={props.rewards}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
