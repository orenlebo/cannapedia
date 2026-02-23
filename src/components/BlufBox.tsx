interface BlufBoxProps {
  title?: string;
  points: string[];
  lastUpdated?: string;
}

export default function BlufBox({
  title = "בקצרה",
  points,
  lastUpdated,
}: BlufBoxProps) {
  return (
    <section
      aria-label="סיכום מהיר"
      className="mb-8 rounded-2xl border border-bluf-border/40 bg-bluf-bg px-5 py-5 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
          TL
        </span>
        <h2 className="text-lg font-bold text-secondary-foreground">
          {title}
        </h2>
      </div>
      <ul className="flex flex-col gap-3">
        {points.map((point, i) => (
          <li key={i} className="flex items-start gap-3 text-base leading-7">
            <span
              aria-hidden="true"
              className="mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-primary/70"
            />
            <span>{point}</span>
          </li>
        ))}
      </ul>
      {lastUpdated && (
        <p className="mt-4 text-sm text-muted-foreground">
          עודכן לאחרונה: {lastUpdated}
        </p>
      )}
    </section>
  );
}
