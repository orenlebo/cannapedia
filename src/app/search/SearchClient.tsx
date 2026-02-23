"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export interface SearchableConcept {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  blufFirstPoint: string;
  blufPoints: string[];
  medicalName: string;
  alternateNames: string[];
  bodyText: string;
}

interface ScoredResult {
  concept: SearchableConcept;
  score: number;
}

// ---------------------------------------------------------------------------
// Weighted relevance scoring
// ---------------------------------------------------------------------------

const WEIGHT_EXACT_TITLE = 200;
const WEIGHT_PARTIAL_TITLE = 80;
const WEIGHT_EXACT_ALT_NAME = 150;
const WEIGHT_PARTIAL_ALT_NAME = 60;
const WEIGHT_MEDICAL_NAME = 100;
const WEIGHT_SUBTITLE = 30;
const WEIGHT_BLUF = 15;
const WEIGHT_BODY = 5;

function scoreConcept(concept: SearchableConcept, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  let score = 0;

  const titleLower = concept.title.toLowerCase();
  const medNameLower = concept.medicalName.toLowerCase();

  // P1: Title — exact match is king
  if (titleLower === q || titleLower.startsWith(q + " ") || titleLower.includes(`(${q})`)) {
    score += WEIGHT_EXACT_TITLE;
  } else if (titleLower.includes(q)) {
    score += WEIGHT_PARTIAL_TITLE;
  }

  // P1: Medical name
  if (medNameLower === q) {
    score += WEIGHT_MEDICAL_NAME;
  } else if (medNameLower.includes(q)) {
    score += WEIGHT_MEDICAL_NAME * 0.6;
  }

  // P1: Alternate names
  for (const alt of concept.alternateNames) {
    const altLower = alt.toLowerCase();
    if (altLower === q) {
      score += WEIGHT_EXACT_ALT_NAME;
      break;
    } else if (altLower.includes(q)) {
      score += WEIGHT_PARTIAL_ALT_NAME;
      break;
    }
  }

  // P2: Subtitle
  if (concept.subtitle.toLowerCase().includes(q)) {
    score += WEIGHT_SUBTITLE;
  }

  // P2b: BLUF points
  const blufMatches = concept.blufPoints.filter((p) =>
    p.toLowerCase().includes(q)
  ).length;
  score += blufMatches * WEIGHT_BLUF;

  // P3: Body content (sections + FAQs)
  if (score === 0 || concept.bodyText.toLowerCase().includes(q)) {
    const bodyLower = concept.bodyText.toLowerCase();
    // Count occurrences (capped at 5 to prevent keyword-stuffed pages from gaming)
    const occurrences = Math.min(bodyLower.split(q).length - 1, 5);
    score += occurrences * WEIGHT_BODY;
  }

  return score;
}

function searchConcepts(
  concepts: SearchableConcept[],
  query: string
): ScoredResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return concepts
    .map((concept) => ({ concept, score: scoreConcept(concept, q) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  concepts: SearchableConcept[];
}

export default function SearchClient({ concepts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const results = useMemo(
    () => searchConcepts(concepts, query),
    [concepts, query]
  );
  const hasQuery = query.trim().length > 0;

  useEffect(() => {
    const q = query.trim();
    const url = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    router.replace(url, { scroll: false });
  }, [query, router]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mb-4 text-2xl font-bold text-foreground">חיפוש</h1>
        <div className="relative" role="search" aria-label="חיפוש באנציקלופדיה">
          <label htmlFor="search-input" className="sr-only">חיפוש באנציקלופדיה</label>
          <input
            id="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="הקלידו מושג, תרכובת או מצב רפואי..."
            autoFocus
            className="w-full rounded-2xl border border-border bg-card pe-5 ps-12 py-4 text-base text-foreground shadow-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>
      </header>

      {!hasQuery && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="mb-1 text-lg font-medium text-foreground">
            מה תרצו למצוא?
          </p>
          <p className="text-sm text-muted-foreground">
            חפשו לפי שם מושג, תרכובת כימית או מצב רפואי
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {["CBD", "THC", "CBG", "כאב כרוני", "טרפנים"].map(
              (suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="min-h-[40px] rounded-full border border-border bg-muted px-4 py-2 text-sm font-medium text-secondary-foreground transition-all duration-150 hover:bg-accent hover:text-accent-foreground active:scale-95"
                >
                  {suggestion}
                </button>
              )
            )}
          </div>
        </div>
      )}

      {hasQuery && results.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="mb-1 text-lg font-medium text-foreground">
            לא נמצאו תוצאות
          </p>
          <p className="text-sm text-muted-foreground">
            נסו לחפש במילים אחרות או לבדוק את האיות
          </p>
        </div>
      )}

      {hasQuery && results.length > 0 && (
        <div>
          <p className="mb-3 text-sm text-muted-foreground">
            {results.length} תוצאות עבור &quot;{query.trim()}&quot;
          </p>
          <div className="flex flex-col gap-3">
            {results.map(({ concept, score }) => (
              <Link
                key={concept.slug}
                href={`/concept/${concept.slug}`}
                className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 active:scale-[0.98] hover:border-primary/30 hover:shadow-md"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground transition-colors group-hover:text-primary">
                    {concept.title}
                  </h2>
                  <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    {concept.category}
                  </span>
                </div>
                <p className="mb-2 text-sm leading-6 text-muted-foreground">
                  {concept.subtitle}
                </p>
                <p className="line-clamp-2 text-sm leading-6 text-card-foreground">
                  {concept.blufFirstPoint}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
