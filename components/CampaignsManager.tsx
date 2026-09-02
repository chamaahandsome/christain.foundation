"use client";

// Studio crowdfunding tab (ported from Maltivas' creator campaigns, CF-styled).
// Drafts are edited freely; launch applies the §9.4 payout gate server-side.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RichEditor } from "@/components/RichEditor";
import { ImageUploadDialog } from "@/components/ImageUploadDialog";
import { progressPercent } from "@/lib/campaigns";

interface Reward {
  id: string;
  title: string;
  description: string;
  amountCents: number;
  maxBackers: number | null;
  backersCount: number;
  active: boolean;
}

interface Campaign {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  shortDescription: string;
  story: string | null;
  coverImageUrl: string | null;
  goalCents: number;
  raisedCents: number;
  backersCount: number;
  endsAt: string | null;
  deliverable: string | null;
  deliveryTimeline: string | null;
  rewards: Reward[];
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  LIVE: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  FUNDED: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  COMPLETED: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function CampaignsManager({
  channelId,
  campaigns,
  canEdit,
  payoutsReady,
}: {
  channelId: string;
  campaigns: Campaign[];
  canEdit: boolean;
  payoutsReady: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Campaigns</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Mission &amp; Creative crowdfunding — pledges pay you directly.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setCreating((v) => !v)}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
          >
            {creating ? "Close" : "New campaign"}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {creating && (
        <CreateForm
          busy={busy}
          error={error}
          channelId={channelId}
          onCreate={async (body) => {
            const ok = await call("/api/studio/campaigns", "POST", {
              channelId,
              ...body,
            });
            if (ok) setCreating(false);
          }}
        />
      )}

      <div className="mt-6 space-y-5">
        {campaigns.length === 0 && !creating && (
          <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
            No campaigns yet. Raise support for a mission trip, a book, a film —
            backers pledge, the money goes straight to your account.
          </p>
        )}
        {campaigns.map((c) => (
          <CampaignCard
            key={c.id}
            campaign={c}
            channelId={channelId}
            canEdit={canEdit}
            payoutsReady={payoutsReady}
            busy={busy}
            call={call}
          />
        ))}
      </div>
    </div>
  );
}

function CreateForm({
  busy,
  error,
  channelId,
  onCreate,
}: {
  busy: boolean;
  error: string | null;
  channelId: string;
  onCreate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<"MISSION" | "CREATIVE">("MISSION");
  const [goal, setGoal] = useState("1000");
  const [ends, setEnds] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [story, setStory] = useState("");
  const [deliverable, setDeliverable] = useState("");
  const [deliveryTimeline, setDeliveryTimeline] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);

  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600";

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Campaign title"
        className={input}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setCoverOpen(true)}
          className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg border border-dashed border-neutral-300 text-xs text-neutral-500 hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
        >
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            "Add cover image"
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
        <p className="text-xs text-neutral-500">16:9 — shown on cards and the campaign page.</p>
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
      <div className="flex flex-wrap gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as "MISSION" | "CREATIVE")}
          className={`${input} w-auto`}
        >
          <option value="MISSION">Mission — support a work (gift)</option>
          <option value="CREATIVE">Creative — fund a deliverable</option>
        </select>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
          <span className="text-sm text-neutral-500">Goal $</span>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            type="number"
            min={100}
            className="w-24 bg-transparent py-2 text-sm outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-neutral-300 px-3 dark:border-neutral-700">
          <span className="text-sm text-neutral-500">Ends</span>
          <input
            value={ends}
            onChange={(e) => setEnds(e.target.value)}
            type="date"
            className="bg-transparent py-2 text-sm outline-none"
          />
        </div>
      </div>
      <textarea
        value={shortDescription}
        onChange={(e) => setShortDescription(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="One-paragraph summary shown on cards and at the top of the page"
        className={input}
      />
      <RichEditor
        value={story}
        onChange={setStory}
        minHeight={140}
        channelId={channelId}
        placeholder="The full story — what this is, why it matters, what the support makes possible"
      />
      {category === "CREATIVE" && (
        <>
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
        </>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy}
          onClick={() =>
            void onCreate({
              title,
              category,
              goalCents: Math.round(Number(goal) * 100),
              shortDescription,
              ...(coverUrl ? { coverImageUrl: coverUrl } : {}),
              ...(story.trim() ? { story } : {}),
              ...(ends ? { endsAt: new Date(`${ends}T23:59:59Z`).toISOString() } : {}),
              ...(category === "CREATIVE"
                ? { deliverable, deliveryTimeline }
                : {}),
            })
          }
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          {busy ? "Creating…" : "Create draft"}
        </button>
        <p className="text-xs text-neutral-500">
          Goal $100+ · runs 3–90 days (or no end date) · description at least a
          sentence{category === "CREATIVE" ? " · deliverable required" : ""}
        </p>
      </div>
    </div>
  );
}

function CampaignCard({
  campaign: c,
  channelId,
  canEdit,
  payoutsReady,
  busy,
  call,
}: {
  campaign: Campaign;
  channelId: string;
  canEdit: boolean;
  payoutsReady: boolean;
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<boolean>;
}) {
  const [dialog, setDialog] = useState<
    "launch" | "cancel" | "delete" | "cover" | "reactivate" | null
  >(null);
  const [showRewards, setShowRewards] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const pct = progressPercent(c.raisedCents, c.goalCents);
  const base = `/api/studio/campaigns/${c.id}`;

  return (
    <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {c.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.coverImageUrl}
              alt=""
              className="hidden h-14 w-24 shrink-0 rounded-lg object-cover sm:block"
            />
          ) : (
            <div className="hidden h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-amber-100 to-orange-100 text-xl sm:flex dark:from-amber-950 dark:to-orange-950">
              {c.category === "MISSION" ? "🌍" : "🎬"}
            </div>
          )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold">{c.title}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium uppercase ${STATUS_STYLES[c.status] ?? STATUS_STYLES.DRAFT}`}
            >
              {c.status.toLowerCase()}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {c.category === "MISSION" ? "Mission" : "Creative"} ·{" "}
            <a
              href={`/campaign/${c.slug}`}
              className="text-amber-700 hover:underline dark:text-amber-400"
            >
              /campaign/{c.slug}
            </a>
          </p>
        </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {c.status !== "CANCELLED" && c.status !== "COMPLETED" && (
              <button
                onClick={() => setShowEdit((v) => !v)}
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
              >
                {showEdit ? "Close edit" : "Edit"}
              </button>
            )}
            {c.status === "DRAFT" && (
              <>
                <button
                  onClick={() => setDialog("launch")}
                  disabled={busy || !payoutsReady}
                  title={payoutsReady ? undefined : "Finish Stripe onboarding first"}
                  className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
                >
                  Launch
                </button>
                <button
                  onClick={() => setDialog("delete")}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-400 dark:border-neutral-700 dark:text-red-400"
                >
                  Delete
                </button>
              </>
            )}
            {c.status === "CANCELLED" && (
              <button
                onClick={() => setDialog("reactivate")}
                disabled={busy}
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
              >
                Reactivate
              </button>
            )}
            {(c.status === "LIVE" || c.status === "FUNDED") && (
              <>
                <button
                  onClick={() => setShowUpdate((v) => !v)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
                >
                  Post update
                </button>
                <button
                  onClick={() => setDialog("cancel")}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-400 dark:border-neutral-700 dark:text-red-400"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">
            ${(c.raisedCents / 100).toLocaleString()}{" "}
            <span className="font-normal text-neutral-500">
              of ${(c.goalCents / 100).toLocaleString()}
            </span>
          </span>
          <span className="text-xs text-neutral-500">
            {c.backersCount} backer{c.backersCount === 1 ? "" : "s"} · {pct}%
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {canEdit && (
        <button
          onClick={() => setShowRewards((v) => !v)}
          className="mt-3 text-xs font-medium text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
        >
          {showRewards ? "Hide rewards" : `Rewards (${c.rewards.length})`}
        </button>
      )}
      {showRewards && (
        <RewardsEditor campaignId={c.id} rewards={c.rewards} busy={busy} call={call} />
      )}
      {showEdit && (
        <EditForm
          campaign={c}
          channelId={channelId}
          busy={busy}
          call={call}
          onDone={() => setShowEdit(false)}
          onCover={() => setDialog("cover")}
        />
      )}
      {showUpdate && (
        <UpdateComposer
          campaignId={c.id}
          channelId={channelId}
          busy={busy}
          call={call}
          onDone={() => setShowUpdate(false)}
        />
      )}

      <ConfirmDialog
        open={dialog === "launch"}
        title="Launch this campaign?"
        body="It goes live at its public link and starts taking pledges. Goal and end date lock at launch."
        confirmLabel="Launch"
        onConfirm={() => {
          setDialog(null);
          void call(base, "PATCH", { action: "launch" });
        }}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "reactivate"}
        title="Reactivate this campaign?"
        body="It goes back to taking pledges at the same link, with its raised total intact. A campaign that never launched returns to draft."
        confirmLabel="Reactivate"
        onConfirm={() => {
          setDialog(null);
          void call(base, "PATCH", { action: "reactivate" });
        }}
        onCancel={() => setDialog(null)}
      />
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
        open={dialog === "delete"}
        title="Delete this draft?"
        body="The draft, its rewards, and its updates are removed permanently."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setDialog(null);
          void call(base, "DELETE");
        }}
        onCancel={() => setDialog(null)}
      />
      <ImageUploadDialog
        open={dialog === "cover"}
        title="Campaign cover"
        channelId={channelId}
        aspect={16 / 9}
        onCancel={() => setDialog(null)}
        onDone={(url) => {
          setDialog(null);
          void call(base, "PATCH", { action: "edit", coverImageUrl: url });
        }}
      />
    </div>
  );
}

function RewardsEditor({
  campaignId,
  rewards,
  busy,
  call,
}: {
  campaignId: string;
  rewards: Reward[];
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("25");
  const [max, setMax] = useState("");
  const base = `/api/studio/campaigns/${campaignId}/rewards`;
  const input =
    "rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="mt-2 space-y-2 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900/60">
      {rewards.map((r) => (
        <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
          <div className="min-w-0">
            <span className={r.active ? "" : "line-through opacity-60"}>
              <span className="font-medium">${(r.amountCents / 100).toFixed(0)}</span> —{" "}
              {r.title}
            </span>
            <span className="ml-2 text-xs text-neutral-500">
              {r.backersCount}
              {r.maxBackers ? `/${r.maxBackers}` : ""} claimed
            </span>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              disabled={busy}
              onClick={() => void call(base, "PATCH", { rewardId: r.id, active: !r.active })}
              className="text-xs text-neutral-500 hover:text-amber-700 dark:hover:text-amber-400"
            >
              {r.active ? "Deactivate" : "Activate"}
            </button>
            {r.backersCount === 0 && (
              <button
                disabled={busy}
                onClick={() => void call(base, "DELETE", { rewardId: r.id })}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Reward title"
          className={`${input} w-40`}
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What backers get"
          className={`${input} min-w-0 flex-1`}
        />
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-500">$</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            min={1}
            className={`${input} w-20`}
          />
        </div>
        <input
          value={max}
          onChange={(e) => setMax(e.target.value)}
          type="number"
          min={1}
          placeholder="limit"
          title="Max backers (blank = unlimited)"
          className={`${input} w-20`}
        />
        <button
          disabled={busy || !title.trim() || !description.trim()}
          onClick={() => {
            void call(base, "POST", {
              title,
              description,
              amountCents: Math.round(Number(amount) * 100),
              ...(max ? { maxBackers: Number(max) } : {}),
            }).then((ok) => {
              if (ok) {
                setTitle("");
                setDescription("");
                setMax("");
              }
            });
          }}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          Add reward
        </button>
      </div>
    </div>
  );
}

function EditForm({
  campaign: c,
  channelId,
  busy,
  call,
  onDone,
  onCover,
}: {
  campaign: Campaign;
  channelId: string;
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<boolean>;
  onDone: () => void;
  onCover: () => void;
}) {
  const draft = c.status === "DRAFT";
  const [title, setTitle] = useState(c.title);
  const [shortDescription, setShortDescription] = useState(c.shortDescription);
  const [story, setStory] = useState(c.story ?? "");
  const [goal, setGoal] = useState(String(c.goalCents / 100));
  const [ends, setEnds] = useState(c.endsAt ? c.endsAt.slice(0, 10) : "");
  const [deliverable, setDeliverable] = useState(c.deliverable ?? "");
  const [deliveryTimeline, setDeliveryTimeline] = useState(c.deliveryTimeline ?? "");
  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-amber-600";

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900/60">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Campaign title"
        className={input}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onCover}
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
                value={ends}
                onChange={(e) => setEnds(e.target.value)}
                type="date"
                className="bg-transparent py-1.5 text-sm outline-none"
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-neutral-500">
            Goal and end date are locked while the campaign is live.
          </p>
        )}
      </div>
      <textarea
        value={shortDescription}
        onChange={(e) => setShortDescription(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="One-paragraph summary"
        className={input}
      />
      <RichEditor
        value={story}
        onChange={setStory}
        minHeight={140}
        channelId={channelId}
        placeholder="The full story"
      />
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
      <button
        disabled={busy}
        onClick={() => {
          void call(`/api/studio/campaigns/${c.id}`, "PATCH", {
            action: "edit",
            title,
            shortDescription,
            story: story.trim() || null,
            ...(draft
              ? {
                  goalCents: Math.round(Number(goal) * 100),
                  endsAt: ends ? new Date(`${ends}T23:59:59Z`).toISOString() : null,
                }
              : {}),
            ...(c.category === "CREATIVE"
              ? { deliverable: deliverable.trim() || null, deliveryTimeline: deliveryTimeline.trim() || null }
              : {}),
          }).then((ok) => ok && onDone());
        }}
        className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function UpdateComposer({
  campaignId,
  channelId,
  busy,
  call,
  onDone,
}: {
  campaignId: string;
  channelId: string;
  busy: boolean;
  call: (url: string, method: string, body?: unknown) => Promise<boolean>;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [backersOnly, setBackersOnly] = useState(false);
  const input =
    "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-amber-500 dark:border-neutral-700 dark:bg-neutral-900";

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900/60">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Update title"
        className={input}
      />
      <RichEditor
        value={body}
        onChange={setBody}
        minHeight={110}
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
            }).then((ok) => ok && onDone());
          }}
          className="rounded-lg bg-neutral-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-orange-600 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
        >
          Post &amp; notify backers
        </button>
      </div>
    </div>
  );
}
