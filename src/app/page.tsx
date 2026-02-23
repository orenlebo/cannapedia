import Link from "next/link";
import { getAllConcepts, getAllCategories, getConceptsByCategory } from "@/data/concepts";
import SearchHeroForm from "@/components/SearchHeroForm";
import HomeClient from "@/components/HomeClient";

export default function Home() {
  const concepts = getAllConcepts();
  const categories = getAllCategories().map((cat) => ({
    ...cat,
    count: getConceptsByCategory(cat.slug).length,
  }));

  const conceptCards = concepts.map((c) => ({
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    category: c.category,
    categorySlug: c.categorySlug,
    needsHumanReview: c.needsHumanReview,
  }));

  return (
    <div className="flex flex-col gap-10">
      <section className="pt-6 text-center">
        <h1 className="mb-1 text-4xl font-bold tracking-tight text-foreground">
          קנאפדיה
        </h1>
        <p className="mx-auto mb-6 max-w-md text-base leading-relaxed text-muted-foreground">
          חיפוש מידע רפואי ומדעי מבוסס ראיות על קנאביס רפואי בישראל
        </p>
        <SearchHeroForm />
      </section>

      <HomeClient categories={categories} concepts={conceptCards} />
    </div>
  );
}
