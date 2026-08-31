import Link from "next/link";

// Public book card: cover (amber CF tile fallback), title, price.
export function BookCard({
  book,
  className = "w-full",
}: {
  className?: string;
  book: {
    id: string;
    title: string;
    author?: string | null;
    coverImageUrl: string | null;
    priceCents: number;
  };
}) {
  return (
    <Link href={`/book/${book.id}`} className={`group block ${className}`}>
      {book.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={book.coverImageUrl}
          alt=""
          className="aspect-[5/7] w-full rounded-lg object-cover shadow-sm transition-transform duration-200 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="flex aspect-[5/7] w-full items-center justify-center rounded-lg bg-linear-to-br from-amber-500 to-orange-600 p-3 text-center text-sm font-semibold text-white shadow-sm transition-transform duration-200 group-hover:scale-[1.03]">
          {book.title}
        </div>
      )}
      <p className="mt-2 line-clamp-2 text-sm group-hover:underline">{book.title}</p>
      <p className="text-xs text-neutral-500">
        {book.author && <>{book.author} · </>}
        {book.priceCents === 0 ? "Free" : `$${(book.priceCents / 100).toFixed(2)}`}
      </p>
    </Link>
  );
}
