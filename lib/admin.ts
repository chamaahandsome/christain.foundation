// Interim admin identification: comma-separated Clerk user ids in
// ADMIN_USER_IDS and/or email addresses in ADMIN_EMAILS. Replaced by a
// proper role system when the team-access port lands (PLAN.md §4).

import { currentUser } from "@clerk/nextjs/server";

export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const ids = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(userId);
}

/** Admin check for the signed-in user, by Clerk id or by email address.
 * Email matching only trusts addresses Clerk has verified. */
export async function isAdminUser(): Promise<boolean> {
  const user = await currentUser().catch(() => null);
  if (!user) return false;
  if (isAdmin(user.id)) return true;

  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;

  return user.emailAddresses.some(
    (entry) =>
      entry.verification?.status === "verified" &&
      allowed.includes(entry.emailAddress.toLowerCase()),
  );
}
