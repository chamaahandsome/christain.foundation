import { redirect } from "next/navigation";

// The shelf moved into The Table (PLAN §11.2). Old links, bookmarks and the
// purchase notification's url all still land on the books.
export default function MyBooksRedirect() {
  redirect("/table/books");
}
