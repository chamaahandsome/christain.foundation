// Who is reading. The Table matches guest rows on email (PLAN §11.4 C), so
// this is the one place that decides which address may do the claiming.

export interface ViewerEmailAddress {
  id: string;
  emailAddress: string;
  verification?: { status?: string | null } | null;
}

export interface ViewerIdentity {
  primaryEmailAddressId?: string | null;
  emailAddresses?: ViewerEmailAddress[];
}

/**
 * The signed-in person's primary address, and only when Clerk has verified
 * it. An unverified address must never claim anything: booking is open to
 * anyone with the link, so an address alone would otherwise be enough to
 * read a stranger's appointments.
 */
export function primaryEmail(user: ViewerIdentity | null | undefined): string | null {
  if (!user) return null;
  const addresses = user.emailAddresses ?? [];
  const primary =
    addresses.find((a) => a.id === user.primaryEmailAddressId) ?? addresses[0];
  if (!primary || primary.verification?.status !== "verified") return null;
  const email = primary.emailAddress?.trim();
  return email ? email : null;
}
