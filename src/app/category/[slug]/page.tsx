import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getCategoryBySlug,
  getConceptsByCategory,
  getAllCategorySlugs,
} from "@/data/concepts";

const SITE_NAME = "קנאפדיה";
const BASE_URL = "https://cannapedia.co.il";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllCategorySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);
  if (!category) return { title: `לא נמצא | ${SITE_NAME}` };

  return {
    title: `${category.name} | ${SITE_NAME}`,
    description: category.description,
    openGraph: {
      title: `${category.name} | ${SITE_NAME}`,
      description: category.description,
      type: "website",
      locale: "he_IL",
      siteName: SITE_NAME,
      url: `${BASE_URL}/category/${slug}`,
    },
    alternates: {
      canonical: `${BASE_URL}/category/${slug}`,
    },
  };
}

function buildJsonLd(
  categoryName: string,
  categorySlug: string,
  concepts: { slug: string; title: string }[]
) {
  const pageUrl = `${BASE_URL}/category/${categorySlug}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: `${categoryName} | ${SITE_NAME}`,
        description: `כל הערכים בקטגוריית ${categoryName} בקנאפדיה`,
        inLanguage: "he",
        isPartOf: {
          "@type": "WebSite",
          "@id": `${BASE_URL}/#website`,
          name: SITE_NAME,
          url: BASE_URL,
        },
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: concepts.length,
          itemListElement: concepts.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: c.title,
            url: `${BASE_URL}/concept/${c.slug}`,
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "בית", item: BASE_URL },
          {
            "@type": "ListItem",
            position: 2,
            name: categoryName,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) notFound();

  const concepts = getConceptsByCategory(slug);
  const jsonLd = buildJsonLd(category.name, category.slug, concepts);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div>
        <nav
          aria-label="breadcrumb"
          className="mb-4 text-sm text-muted-foreground"
        >
          <ol className="flex items-center gap-1.5">
            <li>
              <Link href="/" className="hover:text-primary">בית</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href="/categories" className="hover:text-primary">קטגוריות</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground">{category.name}</li>
          </ol>
        </nav>

        <header className="mb-8">
          <div className="mb-2 flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-2xl"
              role="img"
              aria-hidden="true"
            >
              {category.icon}
            </span>
            <h1 className="text-3xl font-bold text-foreground">
              {category.name}
            </h1>
          </div>
          <p className="text-base leading-7 text-muted-foreground">
            {category.description}
          </p>
        </header>

        {concepts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <p className="mb-2 text-lg font-medium text-foreground">
              עדיין אין ערכים בקטגוריה זו
            </p>
            <p className="text-sm text-muted-foreground">
              תוכן נוסף יתווסף בקרוב. בינתיים, בדקו את הקטגוריות האחרות.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {concepts.map((concept) => (
              <Link
                key={concept.slug}
                href={`/concept/${concept.slug}`}
                className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 active:scale-[0.98] hover:border-primary/30 hover:shadow-md"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                    {concept.title}
                  </h2>
                  {concept.needsHumanReview && (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                      סקירה
                    </span>
                  )}
                </div>
                <p className="mb-3 text-sm leading-6 text-muted-foreground">
                  {concept.subtitle}
                </p>
                <p className="line-clamp-2 text-sm leading-6 text-card-foreground">
                  {concept.bluf.points[0]}
                </p>
              </Link>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {concepts.length} ערכים בקטגוריה זו
        </p>
      </div>
    </>
  );
}
