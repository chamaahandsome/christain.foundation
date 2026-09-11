import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AppointmentCard } from "@/components/AppointmentCard";
import { primaryEmail } from "@/lib/viewer";
import { myAppointmentRooms } from "@/lib/table-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appointments" };

// Every booking this person has made — sessions, hire requests, and the
// ones they booked as a guest before signing up (matched on their verified
// address, PLAN §11.4 C).
export default async function AppointmentsRoom() {
  const { userId } = await auth();
  if (!userId) redirect("/signin?redirect_url=/table/appointments");
  const email = primaryEmail(await currentUser());
  const { upcoming, awaiting, past } = await myAppointmentRooms(userId, email);
  const nothing = upcoming.length + awaiting.length + past.length === 0;

  return (
    <div className="py-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">
        Your table
      </p>
      <h1 className="mt-2 text-2xl font-semibold">Appointments</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Time you&apos;ve booked with creators, and where it stands.
      </p>

      {nothing ? (
        <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 p-10 text-center dark:border-neutral-700">
          <p className="text-4xl">📅</p>
          <p className="mt-3 font-medium">Nothing booked yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            Creators who take bookings carry a{" "}
            <span className="font-medium">Book Me</span> tab on their page —
            for a 1:1 conversation or to have them come and speak.
          </p>
          <Link
            href="/explore"
            className="mt-4 inline-block text-sm text-amber-700 hover:underline dark:text-amber-400"
          >
            Find creators →
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <Group title="Coming up" rows={upcoming} />
          <Group
            title="Waiting on a reply"
            rows={awaiting}
            note="Requests you've sent that nobody has settled yet."
          />
          <Group title="Past" rows={past} />
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  rows,
  note,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof myAppointmentRooms>>["upcoming"];
  note?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
        <span className="ml-2 font-normal normal-case tracking-normal text-neutral-400">
          {rows.length}
        </span>
      </h2>
      {note && <p className="mt-1 text-sm text-neutral-500">{note}</p>}
      <div className="mt-3 space-y-3">
        {rows.map((a) => (
          <AppointmentCard key={a.id} a={a} />
        ))}
      </div>
    </section>
  );
}
