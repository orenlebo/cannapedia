import * as fs from "node:fs";
import * as path from "node:path";

export interface ConceptSection {
  id: string;
  heading: string;
  content: string;
  subsections?: { heading: string; content: string }[];
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface RelatedConcept {
  slug: string;
  label: string;
}

export interface SourceArticle {
  title: string;
  url: string;
  date: string;
}

export interface ConceptData {
  slug: string;
  title: string;
  subtitle: string;
  category: string;
  categorySlug: string;
  bluf: {
    points: string[];
    lastUpdated: string;
  };
  sections: ConceptSection[];
  faqs: FaqItem[];
  relatedConcepts: RelatedConcept[];
  sources?: SourceArticle[];
  searchAliases?: string[];
  needsHumanReview?: boolean;
  sourceType?: "rag" | "global_ai" | "manual";
  schema: {
    medicalName: string;
    alternateName?: string[];
    description: string;
    medicineSystem?: string;
    relevantSpecialty?: string[];
  };
}

export interface CategoryData {
  slug: string;
  name: string;
  description: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// File-based content — O(1) direct reads, O(n) for listings
// ---------------------------------------------------------------------------

const CONTENT_DIR = path.join(process.cwd(), "src/data/content");

/**
 * Direct file read by slug. O(1). Used by getConceptBySlug and
 * generateStaticParams. This is the canonical way to resolve a slug.
 */
function readConceptFile(slug: string): ConceptData | undefined {
  const filePath = path.join(CONTENT_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const concept = JSON.parse(raw) as ConceptData;
    concept.slug = slug; // filename is source of truth
    return concept;
  } catch {
    return undefined;
  }
}

/**
 * Returns all slugs by reading filenames directly from disk.
 * No JSON parsing — just strip .json extensions.
 */
function readAllSlugsFromDisk(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .map((f) => f.replace(/\.json$/, ""));
}

function loadAllConceptFiles(): ConceptData[] {
  const slugs = readAllSlugsFromDisk();
  const results: ConceptData[] = [];

  for (const slug of slugs) {
    const concept = readConceptFile(slug);
    if (concept) results.push(concept);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const categories: CategoryData[] = [
  {
    slug: "cannabinoids",
    name: "קנבינואידים",
    description:
      "תרכובות כימיות ייחודיות לצמח הקנאביס הפועלות על מערכת האנדוקנבינואידים בגוף. כוללים THC, CBD ולמעלה ממאה קנבינואידים נוספים.",
    icon: "🧬",
  },
  {
    slug: "medical-indications",
    name: "התוויות רפואיות",
    description:
      "מצבים רפואיים ותסמונות שבהם קנאביס רפואי עשוי לסייע, בהתאם למחקרים קליניים ולהנחיות משרד הבריאות.",
    icon: "🩺",
  },
  {
    slug: "terpenes",
    name: "טרפנים",
    description:
      "תרכובות ארומטיות הנמצאות בצמח הקנאביס, בעלות השפעות טיפוליות עצמאיות ותפקיד מרכזי באפקט הפמליה.",
    icon: "🌸",
  },
  {
    slug: "cultivars-and-chemotypes",
    name: "זנים וכימוטיפים",
    description:
      "סוגי קנאביס שונים (אינדיקה, סאטיבה, היברידי) עם פרופילים ייחודיים של קנבינואידים וטרפנים.",
    icon: "🌿",
  },
  {
    slug: "routes-of-administration",
    name: "דרכי מתן וצורות צריכה",
    description:
      "שיטות השימוש השונות בקנאביס רפואי – אידוי, שמנים, קפסולות, משחות ועוד – והשפעתן על ספיגה ויעילות.",
    icon: "💊",
  },
  {
    slug: "endocannabinoid-system",
    name: "המערכת האנדוקנבינואידית",
    description:
      "מערכת ביולוגית מורכבת של קולטנים, אנדוקנבינואידים ואנזימים המווסתת תהליכים חיוניים בגוף האדם.",
    icon: "🧠",
  },
  {
    slug: "regulation-in-israel",
    name: "רגולציה ואסדרה בישראל",
    description:
      "החוקים, הנהלים והגופים הממשלתיים המסדירים את השימוש בקנאביס רפואי בישראל.",
    icon: "⚖️",
  },
  {
    slug: "research-and-development",
    name: "מחקר ופיתוח",
    description:
      "שיטות מחקר, ניסויים קליניים וגילויים מדעיים בתחום הקנאביס הרפואי.",
    icon: "🔬",
  },
  {
    slug: "side-effects-and-risks",
    name: "תופעות לוואי וסיכונים",
    description:
      "תופעות לוואי, סיכונים ואמצעי זהירות הקשורים לשימוש בקנאביס רפואי.",
    icon: "⚠️",
  },
  {
    slug: "drug-drug-interactions",
    name: "אינטראקציות בין-תרופתיות",
    description:
      "השפעות הדדיות בין קנבינואידים לתרופות קונבנציונליות, מנגנוני אינטראקציה וניהול סיכונים.",
    icon: "💉",
  },
];

const categoriesBySlug = new Map(categories.map((c) => [c.slug, c]));

// ---------------------------------------------------------------------------
// Public API — concepts
// ---------------------------------------------------------------------------

export function getConceptBySlug(slug: string): ConceptData | undefined {
  return readConceptFile(slug);
}

export function getAllConcepts(): ConceptData[] {
  return loadAllConceptFiles();
}

export function getAllSlugs(): string[] {
  return readAllSlugsFromDisk();
}

export function getConceptsByCategory(categorySlug: string): ConceptData[] {
  return loadAllConceptFiles().filter((c) => c.categorySlug === categorySlug);
}

// ---------------------------------------------------------------------------
// Public API — categories
// ---------------------------------------------------------------------------

export function getCategoryBySlug(slug: string): CategoryData | undefined {
  return categoriesBySlug.get(slug);
}

export function getAllCategories(): CategoryData[] {
  return categories;
}

export function getAllCategorySlugs(): string[] {
  return categories.map((c) => c.slug);
}
