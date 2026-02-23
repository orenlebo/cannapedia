import type { Metadata } from "next";
import { Suspense } from "react";
import { getAllConcepts } from "@/data/concepts";
import SearchClient from "./SearchClient";
import type { SearchableConcept } from "./SearchClient";

export const metadata: Metadata = {
  title: "חיפוש",
  description: "חיפוש מידע רפואי ומדעי על קנאביס רפואי בישראל",
  openGraph: {
    title: "חיפוש | קנאפדיה",
    description: "חיפוש מידע רפואי ומדעי על קנאביס רפואי בישראל",
    type: "website",
    locale: "he_IL",
    siteName: "קנאפדיה",
    url: "https://cannapedia.co.il/search",
  },
  alternates: {
    canonical: "https://cannapedia.co.il/search",
  },
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  const concepts = getAllConcepts();

  const searchableConcepts: SearchableConcept[] = concepts.map((c) => {
    const bodyParts: string[] = [];
    for (const s of c.sections) {
      if (s.content) bodyParts.push(s.content);
      for (const sub of s.subsections ?? []) {
        if (sub.content) bodyParts.push(sub.content);
      }
    }
    for (const faq of c.faqs) {
      bodyParts.push(faq.question, faq.answer);
    }

    return {
      slug: c.slug,
      title: c.title,
      subtitle: c.subtitle,
      category: c.category,
      blufFirstPoint: c.bluf.points[0] ?? "",
      blufPoints: c.bluf.points,
      medicalName: c.schema.medicalName,
      alternateNames: c.schema.alternateName ?? [],
      bodyText: bodyParts.join(" "),
    };
  });

  return (
    <Suspense fallback={<div className="p-6 text-center text-muted-foreground">טוען חיפוש...</div>}>
      <SearchClient concepts={searchableConcepts} />
    </Suspense>
  );
}
