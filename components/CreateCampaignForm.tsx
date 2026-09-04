"use client";

// The Maltivas campaign builder, CF-skinned: rules card up top, sectioned
// form (About → Category → Funding → Media), sticky live preview beside it.
// Creating lands in the campaign workspace to add rewards and launch.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImageUploadDialog } from "@/components/ImageUploadDialog";
import { RichEditor } from "@/components/RichEditor";
import { CampaignLivePreviewCF } from "@/components/CampaignLivePreviewCF";

const RULES = [
  "A campaign must fund real, stated work — a mission, a book, a film, a need the church can see.",
  "It must be honest and clearly presented; what backers are told is what happens.",
  "You are personally responsible for delivering what it promises — including every reward.",
];

export function CreateCampaignForm({ channelId }: { channelId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"MISSION" | "CREATIVE">("MISSION");
  const [shortDescription, setShortDescription] = useState("");
  const [story, setStory] = useState("");
  const [goal, setGoal] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [deliveryTimeline, setDeliveryTimeline] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [coverOpen, setCoverOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600";
  const section = "rounded-2xl border border-neutral-200 p-6 dark:border-neutral-800";

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channelId,
          title,
          category,
          shortDescription,
          goalCents: Math.round(Number(goal) * 100),
          ...(story.trim() ? { story } : {}),
          ...(endDate
            ? { endsAt: new Date(`${endDate}T23:59:59Z`).toISOString() }
            : {}),
          ...(category === "CREATIVE" ? { deliverable, deliveryTimeline } : {}),
          ...(coverUrl ? { coverImageUrl: coverUrl } : {}),
          ...(videoUrl.trim() ? { videoUrl: videoUrl.trim() } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      const campaign = data.campaign as { id: string };
      router.push(`/studio/channel/${channelId}/campaigns/${campaign.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        New campaign
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Start a campaign</h1>
      <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-400">
        Invite people to stand behind your work directly. Pledges settle to
        your payout account at the time of giving — no holds, no waiting.
      </p>

      {/* Campaign rules */}
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/30">
        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
          Every Christian Foundation campaign follows these rules
        </h3>
        <ul className="mt-3 space-y-2">
          {RULES.map((rule, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-6 text-amber-900/90 dark:text-amber-200/90">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                {i + 1}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-amber-800/70 dark:text-amber-300/70">
          Christian Foundation is a payment facilitator only — you own reward
          delivery and any refunds to your supporters. Campaigns that
          don&apos;t deliver lead to removal from the platform.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Form */}
        <div className="space-y-6 lg:col-span-2">
          <div className={section}>
            <h3 className="text-lg font-semibold">About your campaign</h3>
            <div className="mt-4 space-y-3">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="A compelling title for your campaign"
                className={input}
              />
              <textarea
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="A brief description that captures the heart of it"
                className={input}
              />
              <RichEditor
                value={story}
                onChange={setStory}
                minHeight={200}
                channelId={channelId}
                placeholder="Tell the full story. What is this? Why does it matter? How will the support be used? Use formatting, images, and video to make the case."
              />
            </div>
          </div>

          <div className={section}>
            <h3 className="text-lg font-semibold">Category</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["MISSION", "Mission", "Support for a work — a gift, §9-shaped"],
                  ["CREATIVE", "Creative", "Fund a deliverable — a book, film, album"],
                ] as const
              ).map(([key, label, hint]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                    category === key
                      ? "border-amber-500 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30"
                      : "border-neutral-200 hover:border-amber-300 dark:border-neutral-700"
                  }`}
                >
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-neutral-500">{hint}</p>
                </button>
              ))}
            </div>
            {category === "CREATIVE" && (
              <div className="mt-3 space-y-3">
                <textarea
                  value={deliverable}
                  onChange={(e) => setDeliverable(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="The deliverable backers are funding (required for Creative)"
                  className={input}
                />
                <input
                  value={deliveryTimeline}
                  onChange={(e) => setDeliveryTimeline(e.target.value)}
                  maxLength={200}
                  placeholder="Timeline, e.g. “Manuscript to backers by June 2027”"
                  className={input}
                />
              </div>
            )}
          </div>

          <div className={section}>
            <h3 className="text-lg font-semibold">Funding details</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                <span className="text-sm text-neutral-500">Goal $</span>
                <input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  type="number"
                  min={100}
                  placeholder="5000"
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
                <span className="text-sm text-neutral-500">Ends</span>
                <input
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  type="date"
                  className="w-full bg-transparent py-2 text-sm outline-none"
                />
              </div>
            </div>
            <p className="mt-2 text-xs leading-5 text-neutral-500">
              Dated campaigns run 3–90 days; leave the date blank for an
              open-ended campaign. Every pledge settles to you immediately —
              you keep what you raise either way.
            </p>
          </div>

          <div className={section}>
            <h3 className="text-lg font-semibold">Media</h3>
            <div className="mt-4 flex items-center gap-4">
              <button
                type="button"
                onClick={() => setCoverOpen(true)}
                className="relative h-24 w-44 shrink-0 overflow-hidden rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-500 hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  "Add cover image (required to launch)"
                )}
              </button>
              {coverUrl && (
                <button
                  type="button"
                  onClick={() => setCoverUrl(null)}
                  className="text-xs text-neutral-500 hover:text-red-600 dark:hover:text-red-400"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="YouTube video URL (optional — plays atop the story)"
              className={`${input} mt-3`}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              disabled={busy}
              className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium hover:border-neutral-400 dark:border-neutral-700"
            >
              Cancel
            </button>
            <button
              onClick={() => void create()}
              disabled={busy}
              className="rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-amber-400 hover:to-orange-500 disabled:opacity-50"
            >
              {busy ? "Creating…" : "Create campaign"}
            </button>
          </div>
        </div>

        {/* Sticky live preview */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <CampaignLivePreviewCF
              title={title}
              shortDescription={shortDescription}
              category={category}
              goal={goal}
              endDate={endDate}
              coverImageUrl={coverUrl}
            />
          </div>
        </div>
      </div>

      <ImageUploadDialog
        open={coverOpen}
        title="Campaign cover"
        channelId={channelId}
        aspect={16 / 9}
        allowRemove={false}
        onCancel={() => setCoverOpen(false)}
        onDone={(url) => {
          setCoverOpen(false);
          if (url) setCoverUrl(url);
        }}
      />
    </div>
  );
}
