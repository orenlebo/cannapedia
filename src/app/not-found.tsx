import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "הדף לא נמצא",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="mb-4 text-6xl" aria-hidden="true">🔍</span>
      <h1 className="mb-2 text-3xl font-bold text-foreground">
        הדף לא נמצא
      </h1>
      <p className="mb-8 max-w-md text-base text-muted-foreground">
        לא מצאנו את הדף שחיפשת. ייתכן שהכתובת שגויה או שהתוכן הועבר למקום אחר.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.97]"
        >
          חזרה לדף הבית
        </Link>
        <Link
          href="/search"
          className="rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.97]"
        >
          חיפוש באנציקלופדיה
        </Link>
      </div>
    </div>
  );
}
