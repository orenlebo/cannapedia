import type { Metadata } from "next";
import Link from "next/link";
import { getAllCategories, getConceptsByCategory } from "@/data/concepts";

const SITE_NAME = "קנאפדיה";
const BASE_URL = "https://cannapedia.co.il";

export const metadata: Metadata = {
  title: "קטגוריות",
  description:
    "כל הקטגוריות באנציקלופדיית קנאפדיה — קנבינואידים, מצבים רפואיים, זנים, דרכי מתן ועוד.",
  openGraph: {
    title: `קטגוריות | ${SITE_NAME}`,
    description:
      "כל הקטגוריות באנציקלופדיית קנאפדיה — קנבינואידים, מצבים רפואיים, זנים, דרכי מתן ועוד.",
    type: "website",
    locale: "he_IL",
    siteName: SITE_NAME,
    url: `${BASE_URL}/categories`,
  },
  twitter: {
    card: "summary",
    title: `קטגוריות | ${SITE_NAME}`,
    description:
      "כל הקטגוריות באנציקלופדיית קנאפדיה — קנבינואידים, מצבים רפואיים, זנים, דרכי מתן ועוד.",
  },
  alternates: {
    canonical: `${BASE_URL}/categories`,
    languages: { "he-IL": `${BASE_URL}/categories` },
  },
};

export default function CategoriesPage() {
  const categories = getAllCategories();

  return (
    <div>
      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">קטגוריות</h1>
        <p className="text-base text-muted-foreground">
          גלו את כל תחומי הידע באנציקלופדיית הקנאביס הרפואי
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {categories.map((cat) => {
          const conceptCount = getConceptsByCategory(cat.slug).length;
          return (
            <Link
              key={cat.slug}
              href={`/category/${cat.slug}`}
              className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 active:scale-[0.98] hover:border-primary/30 hover:shadow-md"
            >
              <span
                className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl transition-transform duration-200 group-hover:scale-110"
                role="img"
                aria-hidden="true"
              >
                {cat.icon}
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="mb-1 text-lg font-semibold text-foreground">
                  {cat.name}
                </h2>
                <p className="mb-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {cat.description}
                </p>
                <span className="text-xs font-medium text-primary">
                  {conceptCount} ערכים
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
