import type { Metadata } from "next";
import { getAllConcepts } from "@/data/concepts";
import SearchClient from "./SearchClient";
import type { SearchableConcept } from "./SearchClient";

export const metadata: Metadata = {
  title: "חיפוש | קנאפדיה",
  description: "חיפוש מידע רפואי ומדעי על קנאביס רפואי בישראל",
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

  return <SearchClient concepts={searchableConcepts} />;
}
