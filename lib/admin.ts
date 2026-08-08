// Interim admin identification: comma-separated Clerk user ids in
// ADMIN_USER_IDS. Replaced by a proper role system when the team-access
// port lands (PLAN.md §4).

export function isAdmin(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const ids = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return ids.includes(userId);
}
