/**
 * Taxonomy Expansion — Multi-domain LLM-powered concept discovery.
 *
 * Queries Gemini Flash across all 10 categories to exhaustively list concepts,
 * merges with existing taxonomy and content, and outputs a persistent queue.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/7-expand-taxonomy.ts
 *   npx tsx scripts/ai-factory/7-expand-taxonomy.ts --dry-run   # stats only
 *
 * Requires GEMINI_API_KEY in .env.local
 */

import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs";
import * as path from "node:path";
import { ALIAS_MODEL } from "./shared";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY || API_KEY === "your_key_here") {
  console.error("❌  Missing GEMINI_API_KEY in .env.local");
  process.exit(1);
}

const QUEUE_PATH = path.join(__dirname, "concept-queue.json");
const TAXONOMY_PATH = path.join(__dirname, "taxonomy-draft.json");
const CONTENT_DIR = path.join(__dirname, "../../src/data/content");

const isDryRun = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Queue types
// ---------------------------------------------------------------------------

interface QueueConcept {
  name: string;
  slug: string;
  categorySlug: string;
  medicalName: string;
  source: string;
  status: "pending" | "completed" | "failed" | "skipped";
  attempts: number;
  lastError: string | null;
  completedAt: string | null;
}

interface QueueFile {
  version: number;
  lastUpdated: string;
  concepts: QueueConcept[];
}

// ---------------------------------------------------------------------------
// Domain-specific expansion prompts (one per category)
// ---------------------------------------------------------------------------

interface DomainPrompt {
  categorySlug: string;
  prompt: string;
}

const DOMAIN_PROMPTS: DomainPrompt[] = [
  {
    categorySlug: "cannabinoids",
    prompt: `List ALL known phytocannabinoids (major and minor) found in the cannabis plant.
Include: THC, CBD, CBG, CBN, CBC, THCV, CBDV, CBL, THCA, CBDA, CBGA, Delta-8-THC, and any other documented cannabinoid.
Also include synthetic cannabinoids used in medicine (Dronabinol, Nabilone, Epidiolex).
For each, provide: Hebrew name, English scientific name, and a kebab-case slug.`,
  },
  {
    categorySlug: "terpenes",
    prompt: `List ALL terpenes and terpenoids documented in cannabis plants.
Include: Myrcene, Limonene, Linalool, Pinene, Caryophyllene, Humulene, Terpinolene, Ocimene, Bisabolol, Nerolidol, Geraniol, Guaiol, Camphene, Borneol, Eucalyptol, Valencene, Phytol, and any others.
For each, provide: Hebrew name, English scientific name, and a kebab-case slug.`,
  },
  {
    categorySlug: "medical-indications",
    prompt: `List ALL medical conditions and symptoms where cannabis or cannabinoids are prescribed, studied, or show promising evidence.
Include: chronic pain, neuropathic pain, fibromyalgia, PTSD, anxiety, depression, insomnia, epilepsy, multiple sclerosis, spasticity, Crohn's disease, IBD, nausea (CINV), cachexia, anorexia, glaucoma, Parkinson's, Alzheimer's, autism spectrum, Tourette syndrome, migraines, arthritis, cancer-related symptoms, palliative care, ADHD.
Also include conditions specifically approved for medical cannabis in Israel.
For each, provide: Hebrew name, English medical name, and a kebab-case slug.`,
  },
  {
    categorySlug: "routes-of-administration",
    prompt: `List ALL documented methods of cannabis consumption and drug delivery systems.
Include: inhalation (smoking, vaporization), oral (capsules, edibles, oils, tinctures), sublingual, topical (creams, patches, balms), transdermal, rectal, intranasal, ophthalmic.
Also include specific delivery technologies (metered-dose inhalers, nebulizers, nanoemulsions).
For each, provide: Hebrew name, English name, and a kebab-case slug.`,
  },
  {
    categorySlug: "cultivars-and-chemotypes",
    prompt: `List ALL key concepts related to cannabis cultivars, genetics, and chemotypes.
Include: Indica, Sativa, Hybrid, Ruderalis, chemotype classification (Type I/II/III), landrace strains, trichome types, the entourage effect, cannabis breeding and selection, polyploidy, hemp vs medical cannabis, autoflowering genetics, feminized seeds, full-spectrum vs isolate vs broad-spectrum.
For each, provide: Hebrew name, English name, and a kebab-case slug.`,
  },
  {
    categorySlug: "endocannabinoid-system",
    prompt: `List ALL components and concepts of the human endocannabinoid system (ECS).
Include: CB1 receptor, CB2 receptor, GPR55, TRPV1, anandamide (AEA), 2-AG, FAAH enzyme, MAGL enzyme, endocannabinoid tone, retrograde signaling, homeostasis, clinical endocannabinoid deficiency (CECD), allosteric modulation, receptor desensitization, lipid signaling.
For each, provide: Hebrew name, English scientific name, and a kebab-case slug.`,
  },
  {
    categorySlug: "regulation-in-israel",
    prompt: `List ALL key regulatory concepts, milestones, institutions, and legal frameworks related to medical cannabis in Israel.
Include: YAKAR unit (IMC unit), Procedure 106, medical cannabis license process, authorized physicians, patient rights, home growing regulations, import/export policies, GMP standards (IMC-GMP), Tikun Olam (historical), cannabis reform milestones, decriminalization, prescription system, pharmacy distribution, approved indications list, patient registry.
For each, provide: Hebrew name, English equivalent, and a kebab-case slug.`,
  },
  {
    categorySlug: "research-and-development",
    prompt: `List ALL key research methodology concepts relevant to cannabis science.
Include: randomized controlled trials (RCT), observational studies, meta-analysis, systematic review, preclinical research, in-vitro studies, clinical pharmacology, pharmacokinetics, pharmacodynamics, bioavailability, dose-response, evidence-based medicine (EBM), placebo effect, double-blind study, crossover design, real-world evidence, pharmacovigilance, compassionate use, phase I/II/III/IV trials.
For each, provide: Hebrew name, English scientific name, and a kebab-case slug.`,
  },
  {
    categorySlug: "side-effects-and-risks",
    prompt: `List ALL documented side effects, adverse reactions, and risks associated with cannabis use.
Include: psychoactive effects (anxiety, paranoia, psychosis risk), dry mouth, dizziness, tachycardia, cognitive impairment (short-term memory), dependence/tolerance/withdrawal, CHS (cannabinoid hyperemesis syndrome), respiratory risks (smoking), impaired driving, adolescent brain development risks, pregnancy risks, cardiovascular risks, drug interactions (CYP450).
For each, provide: Hebrew name, English medical term, and a kebab-case slug.`,
  },
  {
    categorySlug: "drug-drug-interactions",
    prompt: `List ALL key drug-drug interaction concepts and specific interaction categories relevant to cannabis pharmacology.
Include: CYP450 enzyme system (CYP3A4, CYP2C9, CYP2C19, CYP2D6, CYP1A2), P-glycoprotein, pharmacokinetic interactions, pharmacodynamic interactions, cannabis with: blood thinners (warfarin), antiepileptics, benzodiazepines, opioids, SSRIs, immunosuppressants, CNS depressants, antipsychotics, chemotherapy agents, statins, antihypertensives.
For each, provide: Hebrew name, English name, and a kebab-case slug.`,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadQueue(): QueueFile {
  if (!fs.existsSync(QUEUE_PATH)) {
    return { version: 1, lastUpdated: new Date().toISOString(), concepts: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, "utf-8")) as QueueFile;
  } catch {
    return { version: 1, lastUpdated: new Date().toISOString(), concepts: [] };
  }
}

function saveQueue(queue: QueueFile): void {
  queue.lastUpdated = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), "utf-8");
}

interface TaxonomyConcept {
  name: string;
  slug: string;
  medicalName: string;
}

interface TaxonomyCategory {
  slug: string;
  concepts: TaxonomyConcept[];
}

function loadExistingTaxonomy(): TaxonomyConcept[] {
  if (!fs.existsSync(TAXONOMY_PATH)) return [];
  try {
    const data = JSON.parse(
      fs.readFileSync(TAXONOMY_PATH, "utf-8")
    ) as TaxonomyCategory[];
    const all: TaxonomyConcept[] = [];
    for (const cat of data) {
      for (const c of cat.concepts) {
        all.push(c);
      }
    }
    return all;
  } catch {
    return [];
  }
}

function getExistingContentSlugs(): Set<string> {
  if (!fs.existsSync(CONTENT_DIR)) return new Set();
  return new Set(
    fs
      .readdirSync(CONTENT_DIR)
      .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
      .map((f) => f.replace(/\.json$/, ""))
  );
}

// ---------------------------------------------------------------------------
// LLM expansion call
// ---------------------------------------------------------------------------

async function expandDomain(
  genAI: GoogleGenerativeAI,
  domain: DomainPrompt
): Promise<TaxonomyConcept[]> {
  const model = genAI.getGenerativeModel({
    model: ALIAS_MODEL,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
  });

  const prompt = `${domain.prompt}

Return a JSON array of objects, each with: "name" (Hebrew), "slug" (English kebab-case), "medicalName" (English scientific).
Output ONLY the JSON array, nothing else.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (c: Record<string, unknown>) => c.name && c.slug && c.medicalName
      )
      .map((c: Record<string, string>) => ({
        name: c.name,
        slug: c.slug
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/--+/g, "-")
          .replace(/^-|-$/g, ""),
        medicalName: c.medicalName,
      }));
  } catch {
    console.error(`   ❌ Failed to parse response for ${domain.categorySlug}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Cannapedia Taxonomy Expansion Engine           ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  if (isDryRun) console.log("   Mode: DRY RUN (no writes)\n");

  const genAI = new GoogleGenerativeAI(API_KEY);

  // ── Phase 1: LLM expansion across all domains ─────────────────────────
  console.log("🔬  Expanding taxonomy across 10 domains...\n");

  const discovered = new Map<string, { concept: TaxonomyConcept; categorySlug: string }>();

  for (const domain of DOMAIN_PROMPTS) {
    process.stdout.write(`   📂 ${domain.categorySlug}... `);
    try {
      const concepts = await expandDomain(genAI, domain);
      let added = 0;
      for (const c of concepts) {
        if (!discovered.has(c.slug)) {
          discovered.set(c.slug, { concept: c, categorySlug: domain.categorySlug });
          added++;
        }
      }
      console.log(`${concepts.length} concepts (${added} new)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAILED: ${msg}`);
    }
    await sleep(2000);
  }

  console.log(`\n   Total discovered: ${discovered.size} unique concepts\n`);

  // ── Phase 2: Merge with existing data ─────────────────────────────────
  console.log("🔄  Merging with existing taxonomy and content...\n");

  const existingSlugs = getExistingContentSlugs();
  const existingTaxonomy = loadExistingTaxonomy();
  const queue = loadQueue();
  const queueBySlug = new Map(queue.concepts.map((c) => [c.slug, c]));

  // Seed from existing taxonomy (concepts that Gemini might not rediscover)
  for (const tc of existingTaxonomy) {
    if (!discovered.has(tc.slug)) {
      const taxonomyCat = (
        JSON.parse(fs.readFileSync(TAXONOMY_PATH, "utf-8")) as TaxonomyCategory[]
      ).find((cat) => cat.concepts.some((c) => c.slug === tc.slug));

      discovered.set(tc.slug, {
        concept: tc,
        categorySlug: taxonomyCat?.slug ?? "cannabinoids",
      });
    }
  }

  // Build final queue
  const finalConcepts: QueueConcept[] = [];
  let newCount = 0;
  let completedCount = 0;
  let preservedCount = 0;

  for (const [slug, { concept, categorySlug }] of discovered) {
    const existing = queueBySlug.get(slug);

    if (existing) {
      // Preserve existing queue state (don't reset completed/failed items)
      finalConcepts.push(existing);
      preservedCount++;
      if (existing.status === "completed") completedCount++;
    } else if (existingSlugs.has(slug)) {
      // Already generated as content — mark completed
      finalConcepts.push({
        name: concept.name,
        slug,
        categorySlug,
        medicalName: concept.medicalName,
        source: "pre-existing",
        status: "completed",
        attempts: 0,
        lastError: null,
        completedAt: new Date().toISOString(),
      });
      completedCount++;
    } else {
      finalConcepts.push({
        name: concept.name,
        slug,
        categorySlug,
        medicalName: concept.medicalName,
        source: "taxonomy-expansion",
        status: "pending",
        attempts: 0,
        lastError: null,
        completedAt: null,
      });
      newCount++;
    }
  }

  // Sort: pending first (alphabetically), then completed
  finalConcepts.sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (a.status !== "pending" && b.status === "pending") return 1;
    return a.slug.localeCompare(b.slug);
  });

  const pendingCount = finalConcepts.filter((c) => c.status === "pending").length;
  const failedCount = finalConcepts.filter((c) => c.status === "failed").length;

  // ── Phase 3: Output ───────────────────────────────────────────────────
  console.log("📊  Queue Summary:");
  console.log(`   Total concepts:  ${finalConcepts.length}`);
  console.log(`   New (pending):   ${newCount}`);
  console.log(`   Completed:       ${completedCount}`);
  console.log(`   Failed:          ${failedCount}`);
  console.log(`   Preserved:       ${preservedCount}`);
  console.log(`   Ready to generate: ${pendingCount}\n`);

  // Category breakdown
  const catBreakdown = new Map<string, { total: number; pending: number }>();
  for (const c of finalConcepts) {
    const entry = catBreakdown.get(c.categorySlug) ?? { total: 0, pending: 0 };
    entry.total++;
    if (c.status === "pending") entry.pending++;
    catBreakdown.set(c.categorySlug, entry);
  }
  console.log("   Per-category breakdown:");
  for (const [cat, { total, pending }] of [...catBreakdown.entries()].sort(
    (a, b) => b[1].total - a[1].total
  )) {
    console.log(`      ${cat}: ${total} total, ${pending} pending`);
  }

  if (isDryRun) {
    console.log("\n   Dry run — no files written.");
    return;
  }

  const newQueue: QueueFile = {
    version: 1,
    lastUpdated: new Date().toISOString(),
    concepts: finalConcepts,
  };
  saveQueue(newQueue);
  console.log(`\n💾  Queue saved to ${QUEUE_PATH}`);
  console.log(
    `\n🚀  Run: npx tsx scripts/ai-factory/3-generate-bulk.ts --batch 20`
  );
}

main().catch((err) => {
  console.error("❌  Fatal error:", err.message ?? err);
  process.exit(1);
});
