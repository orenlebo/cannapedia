import Link from "next/link";

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

const desktopLinks = [
  { href: "/categories", label: "קטגוריות" },
  { href: "/category/cannabinoids", label: "קנבינואידים" },
  { href: "/category/medical-indications", label: "התוויות רפואיות" },
  { href: "/category/terpenes", label: "טרפנים" },
  { href: "/about", label: "אודות" },
];

export default function TopHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-nav-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2" title="קנאפדיה — דף הבית">
            <span className="text-xl font-bold text-primary">קנאפדיה</span>
          </Link>

          <nav aria-label="ניווט ראשי" className="hidden items-center gap-1 md:flex">
            {desktopLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                title={link.label}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <Link
          href="/search"
          aria-label="חיפוש"
          title="חיפוש באנציקלופדיה"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <SearchIcon className="h-6 w-6" />
        </Link>
      </div>
    </header>
  );
}
