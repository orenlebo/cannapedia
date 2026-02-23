import Link from "next/link";
import type { Metadata } from "next";
import { getAllConcepts, getAllCategories, getConceptsByCategory } from "@/data/concepts";
import SearchHeroForm from "@/components/SearchHeroForm";
import HomeClient from "@/components/HomeClient";

const BASE_URL = "https://cannapedia.co.il";

export const metadata: Metadata = {
  alternates: {
    canonical: BASE_URL,
    languages: { "he-IL": BASE_URL },
  },
};

function buildHomepageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${BASE_URL}/#website`,
        url: BASE_URL,
        name: "קנאפדיה",
        alternateName: "Cannapedia",
        description:
          "מאגר הידע המקיף והמהימן ביותר בישראל בנושא קנאביס רפואי",
        inLanguage: "he",
        publisher: { "@id": `${BASE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": `${BASE_URL}/#organization`,
        name: "קנאפדיה",
        alternateName: "Cannapedia",
        url: BASE_URL,
        description:
          "אנציקלופדיית הקנאביס הרפואי המובילה בישראל — מידע מבוסס מחקר, אובייקטיבי ועדכני",
      },
      {
        "@type": "WebPage",
        "@id": `${BASE_URL}/#homepage`,
        url: BASE_URL,
        name: "קנאפדיה - אנציקלופדיית הקנאביס הרפואי של ישראל",
        description:
          "מאגר הידע המקיף והמהימן ביותר בישראל בנושא קנאביס רפואי. מידע מבוסס מחקר על זנים, קנבינואידים, מינון ושימושים רפואיים.",
        inLanguage: "he",
        isPartOf: { "@id": `${BASE_URL}/#website` },
      },
    ],
  };
}

const FEATURED_SLUGS = [
  "thc",
  "cbd",
  "cbg",
  "cbn",
  "endocannabinoid-system",
  "terpenes",
  "indica-vs-sativa",
  "entourage-effect",
  "chronic-pain",
  "medical-cannabis-license-israel",
  "vaporization",
  "myrcene",
];

export default function Home() {
  const allConcepts = getAllConcepts();
  const categories = getAllCategories().map((cat) => ({
    ...cat,
    count: getConceptsByCategory(cat.slug).length,
  }));

  const slugSet = new Set(FEATURED_SLUGS);
  const featured = FEATURED_SLUGS
    .map((slug) => allConcepts.find((c) => c.slug === slug))
    .filter(Boolean);

  if (featured.length < 12) {
    for (const c of allConcepts) {
      if (featured.length >= 12) break;
      if (!slugSet.has(c.slug) && !c.needsHumanReview) {
        featured.push(c);
        slugSet.add(c.slug);
      }
    }
  }

  const conceptCards = featured.map((c) => ({
    slug: c!.slug,
    title: c!.title,
    subtitle: c!.subtitle,
    category: c!.category,
    categorySlug: c!.categorySlug,
    needsHumanReview: c!.needsHumanReview,
  }));

  const jsonLd = buildHomepageJsonLd();

  return (
    <div className="flex flex-col gap-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="pt-6 text-center">
        <h1 className="mb-1 text-4xl font-bold tracking-tight text-foreground">
          קנאפדיה
        </h1>
        <p className="mx-auto mb-6 max-w-md text-base leading-relaxed text-muted-foreground">
          חיפוש מידע רפואי ומדעי מבוסס ראיות על קנאביס רפואי בישראל
        </p>
        <SearchHeroForm />
      </section>

      <HomeClient categories={categories} concepts={conceptCards} totalConcepts={allConcepts.length} />
    </div>
  );
}
