"use client";

import { motion } from "framer-motion";
import type { ConceptData } from "@/data/concepts";
import type { MatchedProduct } from "@/utils/productMatcher";
import ReportError from "./ReportError";

interface Props {
  concept: ConceptData;
  products: MatchedProduct[];
}

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const ATTRIBUTE_LABELS: Record<string, string> = {
  "pa_product-type": "סוג מוצר",
  "pa_indica-sativa": "סיווג",
  "pa_strength": "עוצמה",
  "pa_dosage": "מינון",
  "pa_thc_level": "THC",
  "pa_thc-level": "THC",
  "pa_cbd_level": "CBD",
  "pa_cbd-level": "CBD",
  "pa_grower": "מגדל",
  "pa_terpenes": "טרפנים",
  "pa_genetics": "גנטיקה",
  "pa_flavor": "טעם",
  "pa_aroma": "ארומה",
  "pa_effect": "אפקט",
  "pa_origin": "מקור",
};

function formatAttributeKey(raw: string): string {
  if (ATTRIBUTE_LABELS[raw]) return ATTRIBUTE_LABELS[raw];
  const stripped = raw.replace(/^pa_/, "").replace(/[-_]/g, " ");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export default function ConceptClient({ concept, products }: Props) {
  return (
    <motion.div
      className="flex flex-col gap-10"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {concept.sections.map((section) => (
        <motion.section key={section.id} id={section.id} variants={fadeIn}>
          <h2 className="mb-3 text-2xl font-bold text-foreground">
            {section.heading}
          </h2>
          {section.content && (
            <p className="mb-4 text-base leading-8 text-card-foreground">
              {section.content}
            </p>
          )}
          {section.subsections?.map((sub, i) => (
            <div
              key={i}
              className="mb-4 rounded-lg border-s-2 border-accent bg-muted/30 py-3 pe-4 ps-4"
            >
              <h3 className="mb-1.5 text-lg font-semibold text-foreground">
                {sub.heading}
              </h3>
              <p className="text-base leading-7 text-card-foreground">
                {sub.content}
              </p>
            </div>
          ))}
        </motion.section>
      ))}

      <motion.section id="faq" variants={fadeIn}>
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          שאלות נפוצות
        </h2>
        <div className="flex flex-col gap-3">
          {concept.faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-border bg-card shadow-sm"
            >
              <summary className="flex min-h-[48px] cursor-pointer items-center justify-between px-5 py-4 text-base font-semibold text-foreground">
                {faq.question}
                <span className="ms-2 shrink-0 text-sm text-muted-foreground transition-transform duration-200 group-open:rotate-180">
                  ▼
                </span>
              </summary>
              <div className="border-t border-border px-5 py-4 text-base leading-7 text-card-foreground">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      </motion.section>

      {concept.sources && concept.sources.length > 0 && (
        <motion.section id="sources" variants={fadeIn}>
          <h2 className="mb-4 text-2xl font-bold text-foreground">
            מקורות וקריאה נוספת
          </h2>
          <div className="flex flex-col gap-2">
            {concept.sources.map((src, i) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener"
                className="group flex min-h-[48px] items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all duration-200 hover:border-primary/30 hover:shadow-sm active:scale-[0.98]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-secondary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {src.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(src.date).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  ←
                </span>
              </a>
            ))}
          </div>
        </motion.section>
      )}

      <motion.div variants={fadeIn}>
        <ReportError
          conceptSlug={concept.slug}
          conceptTitle={concept.title}
        />
      </motion.div>

      {products.length > 0 && (
        <motion.section id="products-israel" variants={fadeIn}>
          <h2 className="mb-2 text-2xl font-bold text-foreground">
            מוצרים נבחרים עם {concept.title}
          </h2>
          <p className="mb-5 text-sm text-muted-foreground">
            מוצרי קנאביס רפואי זמינים במלאי המקושרים ל{concept.title}.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {products.slice(0, 4).map((product) => (
              <div
                key={product.slug ?? product.name}
                className="flex flex-col rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="flex flex-col gap-3 p-4 pb-3">
                  <h3 className="text-base font-bold text-foreground leading-snug">
                    {product.name}
                  </h3>

                  {(product.tags?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {product.attributes &&
                    Object.keys(product.attributes).length > 0 && (
                      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                        {Object.entries(product.attributes)
                          .filter(([, val]) => val)
                          .slice(0, 4)
                          .map(([key, val]) => (
                            <div key={key} className="flex flex-col">
                              <dt className="font-semibold text-secondary-foreground">
                                {formatAttributeKey(key)}
                              </dt>
                              <dd className="text-muted-foreground">{val}</dd>
                            </div>
                          ))}
                      </dl>
                    )}
                </div>

                {product.link && (
                  <a
                    href={product.link}
                    target="_blank"
                    rel="noopener"
                    className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-b-2xl border-t border-border bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary transition-colors duration-200 hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
                  >
                    לפרטי המוצר ←
                  </a>
                )}
              </div>
            ))}
          </div>
        </motion.section>
      )}

      <motion.aside
        id="related"
        variants={fadeIn}
        className="rounded-2xl border border-border bg-card p-5 shadow-sm"
      >
        <h2 className="mb-3 text-lg font-bold text-foreground">
          מושגים קשורים
        </h2>
        <div className="flex flex-wrap gap-2">
          {concept.relatedConcepts.map((related) => (
            <a
              key={related.slug}
              href={`/concept/${related.slug}`}
              className="inline-flex min-h-[40px] items-center rounded-full border border-border bg-muted px-4 py-2 text-sm font-medium text-secondary-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground active:scale-95"
            >
              {related.label}
            </a>
          ))}
        </div>
      </motion.aside>
    </motion.div>
  );
}
