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
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

export default function TopHeader() {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-nav-bg/95 px-4 backdrop-blur-sm">
      <Link href="/" className="flex items-center gap-2">
        <span className="text-xl font-bold text-primary">קנאפדיה</span>
      </Link>
      <Link
        href="/search"
        aria-label="חיפוש"
        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <SearchIcon className="h-6 w-6" />
      </Link>
    </header>
  );
}
