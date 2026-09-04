import Link from "next/link";

const LINKS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/applications", label: "Applications" },
  { href: "/admin/invites", label: "Invites" },
  { href: "/admin/doctrine", label: "Doctrine" },
  { href: "/admin/curation", label: "Curation" },
  { href: "/admin/shelves", label: "Shelves" },
  { href: "/admin/moderation", label: "Moderation" },
];

/** Shared admin navigation; `current` hides the self-link. */
export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="mt-1 flex flex-wrap gap-4">
      {LINKS.filter((link) => link.href !== current).map((link) => (
        <Link key={link.href} href={link.href} className="text-sm underline">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
