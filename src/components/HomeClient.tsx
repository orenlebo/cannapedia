"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface CategoryCard {
  slug: string;
  name: string;
  description: string;
  icon: string;
  count: number;
}

interface ConceptCard {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  categorySlug: string;
  needsHumanReview?: boolean;
}

interface Props {
  categories: CategoryCard[];
  concepts: ConceptCard[];
  totalConcepts: number;
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

export default function HomeClient({ categories, concepts, totalConcepts }: Props) {
  return (
    <>
      <section>
        <h2 className="mb-4 text-xl font-bold text-foreground">
          קטגוריות מרכזיות
        </h2>
        <motion.div
          className="grid grid-cols-2 gap-3"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {categories.map((cat) => (
            <motion.div key={cat.slug} variants={fadeUp}>
              <Link
                href={`/category/${cat.slug}`}
                className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-center shadow-sm transition-all duration-200 active:scale-[0.96] hover:border-primary/30 hover:shadow-md"
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-2xl"
                  role="img"
                  aria-hidden="true"
                >
                  {cat.icon}
                </span>
                <span className="text-base font-semibold text-foreground">
                  {cat.name}
                </span>
                <span className="text-sm text-muted-foreground">
                  {cat.count} ערכים
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-bold text-foreground">
            מושגים נבחרים
          </h2>
          <span className="text-sm text-muted-foreground">
            {totalConcepts} ערכים באנציקלופדיה
          </span>
        </div>
        <motion.div
          className="flex flex-col gap-3"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {concepts.map((concept) => (
            <motion.div key={concept.slug} variants={fadeUp}>
              <Link
                href={`/concept/${concept.slug}`}
                title={concept.title}
                className="group block rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 active:scale-[0.98] hover:border-primary/30 hover:shadow-md"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                    {concept.title}
                  </h3>
                  <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {concept.category}
                  </span>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {concept.subtitle}
                </p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
        <div className="mt-6 text-center">
          <Link
            href="/search"
            title="חיפוש בכל הערכים"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-primary shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.97]"
          >
            חיפוש בכל {totalConcepts} הערכים
            <span aria-hidden="true">←</span>
          </Link>
        </div>
      </section>
    </>
  );
}
