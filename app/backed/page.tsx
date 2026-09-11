import { redirect } from "next/navigation";

// Backed campaigns became a room at The Table (PLAN §11.2).
export default function BackedRedirect() {
  redirect("/table/backing");
}
