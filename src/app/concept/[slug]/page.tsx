import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getConceptBySlug, getAllSlugs } from "@/data/concepts";
import type { ConceptData } from "@/data/concepts";
import BlufBox from "@/components/BlufBox";
import TableOfContents from "@/components/TableOfContents";
import ConceptClient from "@/components/ConceptClient";
import { findProducts } from "@/utils/productMatcher";

const SITE_NAME = "קנאפדיה";
const BASE_URL = "https://cannapedia.co.il";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const concept = getConceptBySlug(slug);
  if (!concept) return { title: `לא נמצא | ${SITE_NAME}` };

  return {
    title: `${concept.title} | ${SITE_NAME}`,
    description: concept.schema.description,
    openGraph: {
      title: `${concept.title} | ${SITE_NAME}`,
      description: concept.schema.description,
      type: "article",
      locale: "he_IL",
      siteName: SITE_NAME,
      url: `${BASE_URL}/concept/${slug}`,
    },
    alternates: {
      canonical: `${BASE_URL}/concept/${slug}`,
    },
  };
}

function buildJsonLd(concept: ConceptData) {
  const pageUrl = `${BASE_URL}/concept/${concept.slug}`;

  const medicalEntity = {
    "@type": "MedicalWebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: concept.title,
    description: concept.schema.description,
    inLanguage: "he",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${BASE_URL}/#website`,
      name: SITE_NAME,
      url: BASE_URL,
    },
    about: {
      "@type": "MedicalEntity",
      "@id": `${pageUrl}#entity`,
      name: concept.schema.medicalName,
      alternateName: concept.schema.alternateName,
      description: concept.schema.description,
      medicineSystem: concept.schema.medicineSystem
        ? { "@type": "MedicineSystem", name: concept.schema.medicineSystem }
        : undefined,
      relevantSpecialty: concept.schema.relevantSpecialty?.map((s) => ({
        "@type": "MedicalSpecialty",
        name: s,
      })),
    },
    lastReviewed: concept.bluf.lastUpdated
      ? undefined
      : new Date().toISOString().split("T")[0],
    mainContentOfPage: {
      "@type": "WebPageElement",
      cssSelector: "article",
    },
  };

  const faqPage = {
    "@type": "FAQPage",
    "@id": `${pageUrl}#faq`,
    mainEntity: concept.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  const breadcrumbList = {
    "@type": "BreadcrumbList",
    "@id": `${pageUrl}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "בית", item: BASE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: concept.category,
        item: `${BASE_URL}/category/${concept.categorySlug}`,
      },
      { "@type": "ListItem", position: 3, name: concept.title, item: pageUrl },
    ],
  };

  return { "@context": "https://schema.org", "@graph": [medicalEntity, faqPage, breadcrumbList] };
}

export default async function ConceptPage({ params }: PageProps) {
  const { slug } = await params;
  const concept = getConceptBySlug(slug);

  if (!concept) notFound();

  const jsonLd = buildJsonLd(concept);

  // Runtime product matching — always uses the latest catalog on disk
  const products = findProducts(concept.searchAliases ?? []);

  const tocItems = [
    ...concept.sections.map((s) => ({ id: s.id, label: s.heading })),
    { id: "faq", label: "שאלות נפוצות" },
    ...(concept.sources && concept.sources.length > 0
      ? [{ id: "sources", label: "מקורות וקריאה נוספת" }]
      : []),
    ...(products.length > 0
      ? [{ id: "products-israel", label: `מוצרים נבחרים עם ${concept.title}` }]
      : []),
    { id: "related", label: "מושגים קשורים" },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article>
        <header className="mb-6">
          <nav
            aria-label="breadcrumb"
            className="mb-3 text-sm text-muted-foreground"
          >
            <ol className="flex items-center gap-1.5">
              <li>
                <a href="/" className="hover:text-primary">בית</a>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <a
                  href={`/category/${concept.categorySlug}`}
                  className="hover:text-primary"
                >
                  {concept.category}
                </a>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-foreground">{concept.title}</li>
            </ol>
          </nav>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="mb-2 text-3xl font-bold leading-tight text-foreground">
                {concept.title}
              </h1>
              <p className="text-lg text-muted-foreground">
                {concept.subtitle}
              </p>
            </div>
            {concept.needsHumanReview && (
              <span className="mt-1 shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                ממתין לסקירה
              </span>
            )}
          </div>
        </header>

        <BlufBox
          points={concept.bluf.points}
          lastUpdated={concept.bluf.lastUpdated}
        />

        <TableOfContents items={tocItems} />

        <ConceptClient concept={concept} products={products} />
      </article>
    </>
  );
}
