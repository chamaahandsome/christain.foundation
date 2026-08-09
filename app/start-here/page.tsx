import { redirect } from "next/navigation";

// The Start Here pathway lives at /start (JSON-curated feature).
// This route survives for old links.
export default function StartHereRedirect() {
  redirect("/start");
}
