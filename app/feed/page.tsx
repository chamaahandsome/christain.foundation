import { redirect } from "next/navigation";

// The feed is now the Following room at The Table (PLAN §11.2) — the same
// stream, beside the creators it comes from.
export default function FeedRedirect() {
  redirect("/table/following");
}
