"use client";

// The Maltivas campaign workspace (CampaignEditTabs), CF-skinned:
// Overview | Rewards | Updates | Backers | Edit | Settings.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ImageUploadDialog } from "@/components/ImageUploadDialog";
import { RichEditor } from "@/components/RichEditor";
import { CampaignLivePreviewCF } from "@/components/CampaignLivePreviewCF";
import { progressPercent } from "@/lib/campaigns";

interface Reward {
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
interface Backer {
  id: string;
  name: string;
  amountCents: number;
  rewardTitle: string | null;
  message: string | null;
  anonymous: boolean;
  shipping: string | null;
  date: string;
  refundable: boolean;
}
interface UpdateRow {
  id: string;
  title: string;
  backersOnly: boolean;
  date: string;
}
export interface StudioCampaign {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  shortDescription: string;
  story: string | null;
  coverImageUrl: string | null;
  videoUrl: string | null;
  goalCents: number;
  raisedCents: number;
  backersCount: number;
  endsAt: string | null;
  endsAtDate: string | null; // yyyy-mm-dd for inputs
  deliverable: string | null;
  deliveryTimeline: string | null;
  publishedAt: string | null;
  rewards: Reward[];
  backers: Backer[];
  updates: UpdateRow[];
}

const BADGE: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  LIVE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  FUNDED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  COMPLETED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const money = (cents: number) => `$${(cents / 100).toLocaleString()}`;

export function CampaignStudio({
  channelId,
  campaign: c,
  payoutsReady,
  isOwner,
}: {
  channelId: string;
  campaign: StudioCampaign;
  payoutsReady: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams?.get("tab") ?? "overview";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = `/api/studio/campaigns/${c.id}`;

  const setTab = (t: string) => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    if (t === "overview") next.delete("tab");
    else next.set("tab", t);
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return null;
      }
      router.refresh();
      return data as Record<string, unknown>;
    } finally {
      setBusy(false);
    }
  }

  const pct = progressPercent(c.raisedCents, c.goalCents);
  const TABS = [
    ["overview", "Overview"],
    ["rewards", `Rewards (${c.rewards.length})`],
    ["updates", `Updates (${c.updates.length})`],
    ["backers", `Backers (${c.backers.length})`],
    ["edit", "Edit"],
    ["settings", "Settings"],
  ] as const;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/studio/channel/${channelId}/campaigns`}
            className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            ←
          </Link>
          <h1 className="truncate text-xl font-semibold">{c.title}</h1>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase ${BADGE[c.status] ?? BADGE.DRAFT}`}
          >
            {c.status.toLowerCase()}
          </span>
        </div>
        {(c.status === "LIVE" || c.status === "FUNDED") && (
          <Link
            href={`/campaign/${c.slug}`}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
          >
            View public page ↗
          </Link>
        )}
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-1 dark:border-neutral-800 dark:bg-neutral-900">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? "bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-sm"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {tab === "overview" && (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Raised", value: money(c.raisedCents) },
              { label: "Goal", value: money(c.goalCents) },
              { label: "Backers", value: String(c.backersCount) },
              { label: "Progress", value: `${pct}%` },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
              >
                <p className="text-2xl font-semibold">{s.value}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
              style={{ width: `${pct}%` }}
            />
          </div>
          {c.status === "DRAFT" && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/30">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                Ready to launch?
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-amber-900/90 dark:text-amber-200/90">
                <li>{c.coverImageUrl ? "✓" : "○"} Cover image</li>
                <li>{c.story ? "✓" : "○"} Full story</li>
                <li>{c.rewards.length > 0 ? "✓" : "○"} Rewards (optional)</li>
                <li>{payoutsReady ? "✓" : "○"} Stripe payouts ready</li>
              </ul>
              <button
                disabled={busy || !payoutsReady}
                onClick={() => void call(base, "PATCH", { action: "launch" })}
                title={payoutsReady ? undefined : "Finish Stripe onboarding first"}
                className="mt-4 rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
              >
                {busy ? "Launching…" : "🚀 Launch campaign"}
              </button>
              <p className="mt-2 text-xs text-amber-800/70 dark:text-amber-300/70">
                Goal and end date lock at launch. By launching you commit to
                delivering what the campaign and its rewards promise.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "rewards" && (
        <RewardsTab campaignId={c.id} channelId={channelId} rewards={c.rewards} busy={busy} call={call} />
      )}

      {tab === "updates" && (
        <UpdatesTab campaignId={c.id} channelId={channelId} updates={c.updates} busy={busy} call={call} />
      )}

      {tab === "backers" && (
        <div className="mt-6 space-y-2">
          {c.backers.length === 0 && (
            <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
              No backers yet.
            </p>
          )}
          {c.backers.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
            >
              <div className="min-w-0">
                <span className="font-medium">{b.anonymous ? "Anonymous" : b.name}</span>{" "}
                <span className="text-neutral-500">
                  · {money(b.amountCents)}
                  {b.rewardTitle && ` · ${b.rewardTitle}`} · {b.date}
                </span>
                {b.message && (
                  <p className="mt-0.5 text-xs italic text-neutral-500">“{b.message}”</p>
                )}
                {b.shipping && (
                  <p className="mt-0.5 whitespace-pre-line text-xs text-neutral-500">
                    📦 {b.shipping}
                  </p>
                )}
              </div>
              {isOwner && b.refundable && (
                <RefundButton campaignId={c.id} backer={b} busy={busy} call={call} />
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "edit" && <EditTab channelId={channelId} campaign={c} busy={busy} call={call} />}

      {tab === "settings" && (
        <SettingsTab campaign={c} channelId={channelId} busy={busy} call={call} />
      )}
    </div>
  );
}

/* ───────── Rewards tab (the AddRewardForm shape) ───────── */

function RewardsTab({
  campaignId,
  channelId,
  rewards,
  busy,
  call,
}: {
  campaignId: string;
  channelId: string;
  rewards: Reward[];
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<Record<string, unknown> | null>;
}) {
  const [adding, setAdding] = useState(rewards.length === 0);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [max, setMax] = useState("");
  const [physical, setPhysical] = useState(false);
  const [imageFor, setImageFor] = useState<string | null>(null);
  const base = `/api/studio/campaigns/${campaignId}/rewards`;
  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Reward tiers — what backers receive at each level.
        </p>
        <button
          onClick={() => setAdding((v) => !v)}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          {adding ? "Close" : "Add reward"}
        </button>
      </div>

      {adding && (
        <div className="space-y-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. “One Bible placed”, “Signed first edition”"
              className={input}
            />
            <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
              <span className="text-sm text-neutral-500">Pledge $</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                min={1}
                placeholder="25"
                className="w-full bg-transparent py-2 text-sm outline-none"
              />
              <span className="text-xs text-neutral-500">or more</span>
            </div>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Describe what backers receive at this level — be specific about what's included."
            className={input}
          />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
              <input
                value={max}
                onChange={(e) => setMax(e.target.value)}
                type="number"
                min={1}
                placeholder="Limit"
                title="Leave empty for unlimited"
                className="w-24 bg-transparent py-2 text-sm outline-none"
              />
              <span className="text-xs text-neutral-500">backers max</span>
            </div>
            <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={physical}
                onChange={(e) => setPhysical(e.target.checked)}
                className="h-4 w-4 accent-amber-600"
              />
              📦 Physical — collects a mailing address at checkout
            </label>
          </div>
          <button
            disabled={busy || !title.trim() || description.trim().length < 10 || !amount}
            onClick={() => {
              void call(base, "POST", {
                title,
                description,
                amountCents: Math.round(Number(amount) * 100),
                deliveryType: physical ? "physical" : "digital",
                ...(max ? { maxBackers: Number(max) } : {}),
              }).then((ok) => {
                if (ok) {
                  setAdding(false);
                  setTitle("");
                  setDescription("");
                  setAmount("");
                  setMax("");
                  setPhysical(false);
                }
              });
            }}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            Add reward
          </button>
        </div>
      )}

      {rewards.map((r) => (
        <div
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <div className="flex min-w-0 items-center gap-3">
            {r.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-lg dark:bg-neutral-800">
                🎁
              </div>
            )}
            <div className="min-w-0">
              <p className={r.active ? "text-sm font-medium" : "text-sm font-medium line-through opacity-60"}>
                {money(r.amountCents)}+ — {r.title}
              </p>
              <p className="line-clamp-1 text-xs text-neutral-500">{r.description}</p>
              <p className="text-xs text-neutral-400">
                {r.backersCount}
                {r.maxBackers ? `/${r.maxBackers}` : ""} claimed
                {r.deliveryType === "physical" && " · 📦 ships"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 text-xs">
            <button
              disabled={busy}
              onClick={() => setImageFor(r.id)}
              className="text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
            >
              {r.imageUrl ? "Image ✓" : "Image"}
            </button>
            <button
              disabled={busy}
              onClick={() => void call(base, "PATCH", { rewardId: r.id, active: !r.active })}
              className="text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
            >
              {r.active ? "Deactivate" : "Activate"}
            </button>
            {r.backersCount === 0 && (
              <button
                disabled={busy}
                onClick={() => void call(base, "DELETE", { rewardId: r.id })}
                className="text-red-600 hover:underline dark:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}

      <ImageUploadDialog
        open={imageFor !== null}
        title="Reward image"
        channelId={channelId}
        aspect={1}
        onCancel={() => setImageFor(null)}
        onDone={(url) => {
          const rewardId = imageFor;
          setImageFor(null);
          if (rewardId) void call(base, "PATCH", { rewardId, imageUrl: url });
        }}
      />
    </div>
  );
}

/* ───────── Updates tab ───────── */

function UpdatesTab({
  campaignId,
  channelId,
  updates,
  busy,
  call,
}: {
  campaignId: string;
  channelId: string;
  updates: UpdateRow[];
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<Record<string, unknown> | null>;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [backersOnly, setBackersOnly] = useState(false);

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Update title"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <RichEditor
          value={body}
          onChange={setBody}
          minHeight={120}
          channelId={channelId}
          placeholder="What's happened, what's next"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
            <input
              type="checkbox"
              checked={backersOnly}
              onChange={(e) => setBackersOnly(e.target.checked)}
              className="h-3.5 w-3.5 accent-amber-600"
            />
            Backers only
          </label>
          <button
            disabled={busy || !title.trim() || !body.trim()}
            onClick={() => {
              void call(`/api/studio/campaigns/${campaignId}/updates`, "POST", {
                title,
                body,
                backersOnly,
              }).then((ok) => {
                if (ok) {
                  setTitle("");
                  setBody("");
                }
              });
            }}
            className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            Post &amp; notify backers
          </button>
        </div>
      </div>
      {updates.map((u) => (
        <div
          key={u.id}
          className="flex items-baseline justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-sm dark:border-neutral-800"
        >
          <span className="min-w-0 truncate font-medium">{u.title}</span>
          <span className="shrink-0 text-xs text-neutral-500">
            {u.backersOnly && "backers only · "}
            {u.date}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ───────── Edit tab (mirrors the create form + live preview) ───────── */

function EditTab({
  channelId,
  campaign: c,
  busy,
  call,
}: {
  channelId: string;
  campaign: StudioCampaign;
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<Record<string, unknown> | null>;
}) {
  const draft = c.status === "DRAFT";
  const [title, setTitle] = useState(c.title);
  const [shortDescription, setShortDescription] = useState(c.shortDescription);
  const [story, setStory] = useState(c.story ?? "");
  const [goal, setGoal] = useState(String(c.goalCents / 100));
  const [endDate, setEndDate] = useState(c.endsAtDate ?? "");
  const [deliverable, setDeliverable] = useState(c.deliverable ?? "");
  const [deliveryTimeline, setDeliveryTimeline] = useState(c.deliveryTimeline ?? "");
  const [videoUrl, setVideoUrl] = useState(c.videoUrl ?? "");
  const [coverOpen, setCoverOpen] = useState(false);
  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={input} />
        <textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          maxLength={2000}
          className={input}
        />
        <RichEditor
          value={story}
          onChange={setStory}
          minHeight={200}
          channelId={channelId}
          placeholder="The full story"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setCoverOpen(true)}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
          >
            {c.coverImageUrl ? "Change cover" : "Add cover"}
          </button>
          {draft ? (
            <>
              <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                <span className="text-sm text-neutral-500">Goal $</span>
                <input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  type="number"
                  min={100}
                  className="w-24 bg-transparent py-1.5 text-sm outline-none"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                <span className="text-sm text-neutral-500">Ends</span>
                <input
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  type="date"
                  className="bg-transparent py-1.5 text-sm outline-none"
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-neutral-500">
              Goal and end date are locked while live.
            </p>
          )}
        </div>
        {c.category === "CREATIVE" && (
          <>
            <textarea
              value={deliverable}
              onChange={(e) => setDeliverable(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="The deliverable backers are funding"
              className={input}
            />
            <input
              value={deliveryTimeline}
              onChange={(e) => setDeliveryTimeline(e.target.value)}
              maxLength={200}
              placeholder="Timeline"
              className={input}
            />
          </>
        )}
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="YouTube video URL (optional)"
          className={input}
        />
        <button
          disabled={busy}
          onClick={() => {
            void call(`/api/studio/campaigns/${c.id}`, "PATCH", {
              action: "edit",
              title,
              shortDescription,
              story: story.trim() || null,
              videoUrl: videoUrl.trim() || null,
              ...(draft
                ? {
                    goalCents: Math.round(Number(goal) * 100),
                    endsAt: endDate
                      ? new Date(`${endDate}T23:59:59Z`).toISOString()
                      : null,
                  }
                : {}),
              ...(c.category === "CREATIVE"
                ? {
                    deliverable: deliverable.trim() || null,
                    deliveryTimeline: deliveryTimeline.trim() || null,
                  }
                : {}),
            });
          }}
          className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-24">
          <CampaignLivePreviewCF
            title={title}
            shortDescription={shortDescription}
            category={c.category}
            goal={goal}
            endDate={endDate}
            coverImageUrl={c.coverImageUrl}
            raisedCents={c.raisedCents}
            backersCount={c.backersCount}
          />
        </div>
      </div>

      <ImageUploadDialog
        open={coverOpen}
        title="Campaign cover"
        channelId={channelId}
        aspect={16 / 9}
        onCancel={() => setCoverOpen(false)}
        onDone={(url) => {
          setCoverOpen(false);
          void call(`/api/studio/campaigns/${c.id}`, "PATCH", {
            action: "edit",
            coverImageUrl: url,
          });
        }}
      />
    </div>
  );
}

/* ───────── Settings tab (status toggle) ───────── */

function SettingsTab({
  campaign: c,
  channelId,
  busy,
  call,
}: {
  campaign: StudioCampaign;
  channelId: string;
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<Record<string, unknown> | null>;
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"cancel" | "delete" | "reactivate" | null>(null);
  const base = `/api/studio/campaigns/${c.id}`;

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-neutral-200 p-5 text-sm dark:border-neutral-800">
        <p>
          <span className="text-neutral-500">Public link:</span>{" "}
          <span className="font-mono text-xs">/campaign/{c.slug}</span>
        </p>
        <p className="mt-1">
          <span className="text-neutral-500">Category:</span>{" "}
          {c.category === "MISSION" ? "Mission (gift-shaped)" : "Creative (deliverable)"}
        </p>
        {c.publishedAt && (
          <p className="mt-1">
            <span className="text-neutral-500">Launched:</span> {c.publishedAt}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {(c.status === "LIVE" || c.status === "FUNDED") && (
          <button
            disabled={busy}
            onClick={() => setDialog("cancel")}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Cancel campaign
          </button>
        )}
        {c.status === "CANCELLED" && (
          <button
            disabled={busy}
            onClick={() => setDialog("reactivate")}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            Reactivate
          </button>
        )}
        {c.status === "DRAFT" && (
          <button
            disabled={busy}
            onClick={() => setDialog("delete")}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            Delete draft
          </button>
        )}
      </div>

      <ConfirmDialog
        open={dialog === "cancel"}
        title="Cancel this campaign?"
        body="It stops taking pledges immediately. Money already pledged stays with you — tell your backers what happens next."
        confirmLabel="Cancel campaign"
        destructive
        onConfirm={() => {
          setDialog(null);
          void call(base, "PATCH", { action: "cancel" });
        }}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "reactivate"}
        title="Reactivate this campaign?"
        body="It goes back to taking pledges at the same link, with its raised total intact."
        confirmLabel="Reactivate"
        onConfirm={() => {
          setDialog(null);
          void call(base, "PATCH", { action: "reactivate" });
        }}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Delete this draft?"
        body="The draft, its rewards, and its updates are removed permanently."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setDialog(null);
          void fetch(base, { method: "DELETE" }).then(() =>
            router.push(`/studio/channel/${channelId}/campaigns`),
          );
        }}
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}

/* ───────── Refund button (backers tab) ───────── */

function RefundButton({
  campaignId,
  backer,
  busy,
  call,
}: {
  campaignId: string;
  backer: Backer;
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<Record<string, unknown> | null>;
}) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <button
        disabled={busy}
        onClick={() => setConfirm(true)}
        className="shrink-0 text-xs text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
      >
        Refund
      </button>
      <ConfirmDialog
        open={confirm}
        title={`Refund ${backer.anonymous ? "this backer" : backer.name}?`}
        body={`$${(backer.amountCents / 100).toFixed(2)} goes back in full, your platform fee is returned, and the campaign total steps down. This can't be undone.`}
        confirmLabel="Refund pledge"
        destructive
        onConfirm={() => {
          setConfirm(false);
          void call(`/api/studio/campaigns/${campaignId}/refund`, "POST", {
            pledgeId: backer.id,
          });
        }}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
