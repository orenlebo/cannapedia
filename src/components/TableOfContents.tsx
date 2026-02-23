interface TocItem {
  id: string;
  label: string;
}

interface TableOfContentsProps {
  items: TocItem[];
}

export default function TableOfContents({ items }: TableOfContentsProps) {
  return (
    <nav
      aria-label="תוכן עניינים"
      className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm"
    >
      <h2 className="mb-3 text-base font-bold text-foreground">
        תוכן עניינים
      </h2>
      <ol className="flex flex-col gap-1">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:scale-[0.98]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
