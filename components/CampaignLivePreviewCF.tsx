"use client";

// Faithful compact preview of the public campaign page (the Maltivas
// CampaignLivePreview): updates as the creator types, placeholders keep the
// layout standing while fields are empty.

export function extractYouTubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return m?.[1] ?? null;
}

export function CampaignLivePreviewCF(props: {
  title: string;
  shortDescription: string;
  category: string;
  goal: string;
  endDate: string;
  coverImageUrl: string | null;
  raisedCents?: number;
  backersCount?: number;
}) {
  const goalNumber = Number(props.goal) || 0;
  const raised = (props.raisedCents ?? 0) / 100;
  const pct = goalNumber > 0 ? Math.min((raised / goalNumber) * 100, 100) : 0;
  const daysLeft = props.endDate
    ? Math.max(
        0,
        Math.ceil((new Date(props.endDate).getTime() - Date.now()) / 86_400_000),
      )
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800">
      <div className="flex items-center gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 dark:border-neutral-900 dark:bg-neutral-900">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <div>
          <p className="text-xs font-semibold">Live preview</p>
          <p className="text-[11px] text-neutral-500">
            Updates as you edit — what supporters will see.
          </p>
        </div>
      </div>

      {/* Hero */}
      <div className="relative aspect-video bg-neutral-100 dark:bg-neutral-800">
        {props.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-amber-100 to-orange-100 text-4xl dark:from-amber-950 dark:to-orange-950">
            {props.category === "MISSION" ? "🌍" : "🎬"}
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
          {props.category === "MISSION" ? "Mission campaign" : "Creative campaign"}
        </p>
        <h3 className="text-lg font-semibold leading-snug">
          {props.title || (
            <span className="text-neutral-400">Your campaign title appears here</span>
          )}
        </h3>
        <p className="text-sm leading-6 text-neutral-600 dark:text-neutral-400">
          {props.shortDescription || (
            <span className="text-neutral-400">
              A short description that captures the heart of it…
            </span>
          )}
        </p>

        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">
              ${raised.toLocaleString()}{" "}
              <span className="font-normal text-neutral-500">raised</span>
            </span>
            <span className="text-xs text-neutral-500">
              {props.backersCount ?? 0} supporter{(props.backersCount ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-600"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-neutral-500">
            <span>
              of{" "}
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {goalNumber > 0 ? `$${goalNumber.toLocaleString()}` : "$—"}
              </span>{" "}
              goal
            </span>
            {daysLeft !== null && <span>{daysLeft} days to go</span>}
          </div>
        </div>

        <button
          type="button"
          disabled
          className="w-full cursor-default rounded-xl bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white opacity-90"
        >
          🤝 Back this campaign
        </button>
      </div>
    </div>
  );
}
