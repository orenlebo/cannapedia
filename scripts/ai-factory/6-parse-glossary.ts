/**
 * Cannabis Magazine Glossary Parser
 *
 * Fetches the static glossary page from Cannabis Magazine's WordPress site,
 * cleans the HTML, and extracts individual glossary terms as potential new
 * concepts. Saves to glossary-review.json for manual human filtering before
 * feeding into the content generation pipeline.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/6-parse-glossary.ts
 *
 * Output:
 *   scripts/ai-factory/glossary-review.json
 */

import * as fs from "node:fs";
import * as path from "node:path";
import striptags from "striptags";

const WP_API_BASE = "https://www.xn--4dbcyzi5a.com/wp-json/wp/v2/pages";
const GLOSSARY_SLUG =
  "מילון-מושגי-הקנאביס-השלם-מא-ועד-ת";
const OUTPUT_PATH = path.join(__dirname, "glossary-review.json");
const EXISTING_CONTENT_DIR = path.join(__dirname, "../../src/data/content");
const TAXONOMY_PATH = path.join(__dirname, "taxonomy-draft.json");

interface GlossaryTerm {
  term: string;
  definition: string;
  existsInTaxonomy: boolean;
  existsAsContent: boolean;
  suggestedSlug: string;
  suggestedCategory: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cleanHtml(html: string): string {
  let text = html;
  text = text.replace(/\[\/?\w+[^\]]*\]/g, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = striptags(text);
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "");
  text = text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();
  return text;
}

function slugify(text: string): string {
  const ascii = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim();
  if (ascii.length > 2) {
    return ascii.replace(/\s+/g, "-").replace(/-+/g, "-");
  }
  return text
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function suggestCategory(term: string, definition: string): string {
  const combined = `${term} ${definition}`.toLowerCase();

  if (/קנבינואיד|thc|cbd|cbn|cbg|cbc|thca|cbda/.test(combined))
    return "cannabinoids";
  if (/טרפן|לימונן|מירצן|פינן|לינלול|caryophyllene/.test(combined))
    return "terpenes";
  if (/אינדיקה|סאטיבה|היברידי|זן|כימוטיפ|גנטיקה/.test(combined))
    return "cultivars-and-chemotypes";
  if (/cb1|cb2|אנדוקנבינואיד|אננדאמיד|2-ag|ecs/.test(combined))
    return "endocannabinoid-system";
  if (/אידוי|שמן|קפסול|סובלינגו|טופיקלי|מתן|צריכה/.test(combined))
    return "routes-of-administration";
  if (/רגולציה|חוק|רישיון|יק"ר|imca|yakar|נוהל/.test(combined))
    return "regulation-in-israel";
  if (/מחקר|ניסוי|קליני|rct|פרה-קליני/.test(combined))
    return "research-and-development";
  if (/תופעת לוואי|סיכון|התמכרות|toleran/.test(combined))
    return "side-effects-and-risks";
  if (/אינטראקצי|cyp450|תרופ/.test(combined))
    return "drug-drug-interactions";
  if (/כאב|פטסד|ptsd|אפילפסיה|טרשת|בחילה|הקאה/.test(combined))
    return "medical-indications";

  return "uncategorized";
}

// ---------------------------------------------------------------------------
// Existing content check
// ---------------------------------------------------------------------------

function getExistingContentSlugs(): Set<string> {
  if (!fs.existsSync(EXISTING_CONTENT_DIR)) return new Set();
  return new Set(
    fs
      .readdirSync(EXISTING_CONTENT_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
  );
}

function getTaxonomyConcepts(): Set<string> {
  if (!fs.existsSync(TAXONOMY_PATH)) return new Set();
  try {
    const data = JSON.parse(fs.readFileSync(TAXONOMY_PATH, "utf-8")) as Array<{
      concepts: Array<{ name: string }>;
    }>;
    const names = new Set<string>();
    for (const cat of data) {
      for (const c of cat.concepts ?? []) {
        names.add(c.name.toLowerCase());
      }
    }
    return names;
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// Glossary extraction
// ---------------------------------------------------------------------------

/**
 * Parses glossary HTML looking for term/definition pairs.
 * Typical patterns on the source page:
 *   - <strong>Term</strong> – definition text
 *   - <b>Term</b> - definition text
 *   - Bold heading followed by paragraph
 */
function extractTermsFromHtml(html: string): Array<{ term: string; definition: string }> {
  const terms: Array<{ term: string; definition: string }> = [];

  // Pattern 1: <strong>term</strong> followed by separator and definition
  const strongPattern =
    /<(?:strong|b)>(.*?)<\/(?:strong|b)>\s*[-–—:]\s*([\s\S]*?)(?=<(?:strong|b)>|<h[2-6]|$)/gi;
  let match;
  while ((match = strongPattern.exec(html)) !== null) {
    const term = striptags(match[1]).trim();
    const def = cleanHtml(match[2]).trim();
    if (term.length >= 2 && term.length <= 100 && def.length >= 10) {
      terms.push({ term, definition: def.slice(0, 500) });
    }
  }

  // Pattern 2: If pattern 1 found nothing, try splitting by newlines after cleaning
  if (terms.length === 0) {
    const cleaned = cleanHtml(html);
    const lines = cleaned.split("\n").filter((l) => l.trim().length > 5);
    for (const line of lines) {
      const sepMatch = line.match(/^(.{2,60})\s*[-–—:]\s+(.{10,})$/);
      if (sepMatch) {
        terms.push({
          term: sepMatch[1].trim(),
          definition: sepMatch[2].trim().slice(0, 500),
        });
      }
    }
  }

  return terms;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Glossary Parser — Cannabis Magazine            ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  const encodedSlug = encodeURIComponent(GLOSSARY_SLUG);
  const apiUrl = `${WP_API_BASE}?slug=${encodedSlug}&_fields=id,title,content,link`;
  console.log(`   Fetching glossary page from WordPress API...`);
  console.log(`   URL: ${apiUrl}\n`);

  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Cannapedia-Glossary-Parser/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status}: ${res.statusText}. Check if the glossary page slug is correct.`
    );
  }

  const pages = (await res.json()) as Array<{
    id: number;
    title: { rendered: string };
    content: { rendered: string };
    link: string;
  }>;

  if (pages.length === 0) {
    console.log("   No page found with that slug.");
    console.log(
      "   Try fetching all pages: /wp-json/wp/v2/pages?per_page=100&search=מילון"
    );
    return;
  }

  const page = pages[0];
  console.log(`   Found: "${cleanHtml(page.title.rendered)}"`);
  console.log(`   Link:  ${page.link}`);
  console.log(`   Content length: ${page.content.rendered.length} chars\n`);

  // Extract terms from HTML
  console.log("   Extracting glossary terms...\n");
  const rawTerms = extractTermsFromHtml(page.content.rendered);
  console.log(`   Raw terms extracted: ${rawTerms.length}\n`);

  if (rawTerms.length === 0) {
    console.log("   Could not auto-extract terms from the page structure.");
    console.log("   Saving raw cleaned text for manual review.\n");
    const fallback = {
      pageTitle: cleanHtml(page.title.rendered),
      pageLink: page.link,
      rawText: cleanHtml(page.content.rendered),
      extractedAt: new Date().toISOString(),
    };
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(fallback, null, 2), "utf-8");
    console.log(`   Saved raw text to ${OUTPUT_PATH}`);
    return;
  }

  // Cross-reference with existing content
  const existingSlugs = getExistingContentSlugs();
  const taxonomyNames = getTaxonomyConcepts();

  const glossary: GlossaryTerm[] = rawTerms.map((t) => {
    const slug = slugify(t.term);
    return {
      term: t.term,
      definition: t.definition,
      existsInTaxonomy: taxonomyNames.has(t.term.toLowerCase()),
      existsAsContent: existingSlugs.has(slug),
      suggestedSlug: slug,
      suggestedCategory: suggestCategory(t.term, t.definition),
    };
  });

  // Save
  const output = {
    source: page.link,
    extractedAt: new Date().toISOString(),
    totalTerms: glossary.length,
    newTerms: glossary.filter(
      (t) => !t.existsInTaxonomy && !t.existsAsContent
    ).length,
    existingTerms: glossary.filter(
      (t) => t.existsInTaxonomy || t.existsAsContent
    ).length,
    terms: glossary,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8");

  console.log(`${"─".repeat(55)}\n`);
  console.log(`   Total terms:    ${output.totalTerms}`);
  console.log(`   New (to review): ${output.newTerms}`);
  console.log(`   Already exist:  ${output.existingTerms}\n`);

  // Show sample of new terms
  const newTerms = glossary.filter(
    (t) => !t.existsInTaxonomy && !t.existsAsContent
  );
  if (newTerms.length > 0) {
    console.log("   Sample new terms:");
    for (const t of newTerms.slice(0, 10)) {
      console.log(
        `      [${t.suggestedCategory}] ${t.term}: ${t.definition.slice(0, 60)}...`
      );
    }
    if (newTerms.length > 10)
      console.log(`      ... and ${newTerms.length - 10} more`);
  }

  console.log(`\n   Saved to ${OUTPUT_PATH}`);
  console.log(
    "   Review this file manually and remove non-medical/slang terms before"
  );
  console.log("   feeding into the generation pipeline.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err.message ?? err);
  process.exit(1);
});
