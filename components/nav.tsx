import Link from "next/link";

const LINKS = [
  { href: "/inbox", label: "Inbox" },
  { href: "/calendar", label: "Calendar" },
  { href: "/settings", label: "Settings" },
];

export default function Nav({ active }: { active: string }) {
  return (
    <nav className="sticky top-0 z-10 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4">
        <span className="mr-3 py-3 text-sm font-bold tracking-tight">
          Creator CMS
        </span>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`btn !min-w-0 !rounded-lg !px-4 !py-2 text-sm ${
              active === l.href
                ? "bg-neutral-900 text-white"
                : "text-neutral-600 active:bg-neutral-100"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
