import Link from "next/link";
import { appointmentStatusLabel, appointmentWhen, canJoinNow } from "@/lib/table";
import { googleCalendarTemplateUrl } from "@/lib/google-calendar";
import type { TableAppointment } from "@/lib/table-queries";

// One booking, told from the guest's side: when it is, who it is with, and
// the single thing to do about it now. The studio card answers "what must I
// decide?"; this one answers "where do I need to be?".

function money(cents: number | null): string | null {
  if (cents === null || cents <= 0) return null;
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function AppointmentCard({ a }: { a: TableAppointment }) {
  const when = appointmentWhen(a.slot, a.serviceTimezone);
  const joinable = canJoinNow({
    slot: a.slot,
    meetingUrl: a.meetingUrl,
    state: a.state,
  });
  const closed = a.state === "CLOSED";
  const label = appointmentStatusLabel({
    kind: a.kind,
    status: a.status as never,
    state: a.state,
    paymentStatus: a.paymentStatus,
  });
  const total = money(a.amountCents);

  const calendarUrl =
    a.slot && a.state === "UPCOMING"
      ? googleCalendarTemplateUrl({
          title: `${a.serviceTitle ?? "Meeting"} with ${a.channelName}`,
          details: a.meetingUrl ?? undefined,
          ymd: a.slot.ymd,
          startMin: a.slot.startMin,
          endMin: a.slot.endMin,
          timezone: a.serviceTimezone || "UTC",
        })
      : null;

  return (
    <article
      className={`rounded-2xl border p-4 transition-colors sm:p-5 ${
        joinable
          ? "border-amber-400 bg-amber-50/60 dark:border-amber-600 dark:bg-amber-950/30"
          : "border-neutral-200 dark:border-neutral-800"
      } ${closed ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-3">
        {a.channelAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.channelAvatarUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-500 to-orange-600 text-sm font-semibold text-white">
            {a.channelName.slice(0, 1).toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p className="font-semibold">
              {a.serviceTitle ?? (a.kind === "ONLINE" ? "1:1 session" : "Booking request")}
            </p>
            <span
              className={`shrink-0 text-xs font-medium ${
                a.state === "UPCOMING"
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-neutral-500"
              }`}
            >
              {label}
            </span>
          </div>

          <p className="mt-0.5 text-sm text-neutral-500">
            with{" "}
            <Link href={`/@${a.channelHandle}`} className="hover:underline">
              {a.channelName}
            </Link>
          </p>

          {when && (
            <p className="mt-2 text-sm font-medium">
              {when}
              {a.slotCount > 1 && (
                <span className="font-normal text-neutral-500">
                  {" "}
                  · {a.slotCount} slots
                </span>
              )}
            </p>
          )}
          {!when && a.state === "AWAITING" && (
            <p className="mt-2 text-sm text-neutral-500">
              No time set yet — {a.channelName} will come back to you.
            </p>
          )}

          {a.location && (
            <p className="mt-1 text-sm text-neutral-500">{a.location}</p>
          )}

          {a.extras.length > 0 && (
            <p className="mt-1 text-xs text-neutral-500">
              Add-ons: {a.extras.map((e) => e.name).join(", ")}
            </p>
          )}

          {total && (
            <p className="mt-1 text-xs text-neutral-500">
              {total}
              {a.paymentStatus === "paid" && " · paid"}
            </p>
          )}

          {a.decisionNote && (
            <p className="mt-2 rounded-lg bg-neutral-50 p-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
              “{a.decisionNote}”
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {joinable && a.meetingUrl && (
              <a
                href={a.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-orange-500 dark:hover:text-white"
              >
                Join now
              </a>
            )}
            {!joinable && a.meetingUrl && a.state === "UPCOMING" && (
              <a
                href={a.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium hover:border-amber-500 hover:text-amber-700 dark:border-neutral-700 dark:hover:text-amber-400"
              >
                Meeting link
              </a>
            )}
            {calendarUrl && (
              <a
                href={calendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-amber-700 hover:underline dark:text-amber-400"
              >
                Add to calendar
              </a>
            )}
            {a.quoteToken && (
              <Link
                href={`/quote/${a.quoteToken}`}
                className="text-sm text-amber-700 hover:underline dark:text-amber-400"
              >
                View the quote →
              </Link>
            )}
            {a.contractId && (
              <Link
                href={`/signed/${a.contractId}`}
                className="text-sm text-amber-700 hover:underline dark:text-amber-400"
              >
                The agreement →
              </Link>
            )}
            {a.state === "UPCOMING" && !a.meetingUrl && a.kind === "ONLINE" && (
              <span className="text-sm text-neutral-500">
                A link will follow from {a.channelName}.
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
