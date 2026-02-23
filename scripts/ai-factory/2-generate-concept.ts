/**
 * Concept Generator v5 — RAG-powered, strict URL sourcing.
 *
 * E-commerce enrichment is fully decoupled: the generator only saves
 * `searchAliases` into the concept JSON. The frontend matches products
 * at render time from the latest catalog, ensuring zero data staleness.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/2-generate-concept.ts "CBD" "cannabinoids"
 *   npx tsx scripts/ai-factory/2-generate-concept.ts "מירצן" "terpenes"
 *
 * Requires GEMINI_API_KEY in .env.local
 */

import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs";
import * as path from "node:path";
import { retrieve, formatContextForPrompt } from "./rag-retriever";
import {
  MODEL,
  CATEGORY_HEBREW,
  generateSearchAliases,
  SYSTEM_INSTRUCTION,
  buildPrompt,
  slugify,
} from "./shared";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY || API_KEY === "your_key_here") {
  console.error(
    "❌  Missing GEMINI_API_KEY. Set it in .env.local and try again."
  );
  process.exit(1);
}

const conceptName = process.argv[2];
const categorySlug = process.argv[3];

if (!conceptName || !categorySlug) {
  console.error(
    '❌  Usage: npx tsx scripts/ai-factory/2-generate-concept.ts "<concept>" "<category-slug>"'
  );
  process.exit(1);
}

const CONTENT_DIR = path.join(__dirname, "../../src/data/content");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    "📝  Cannapedia Concept Generator v5 (RAG + Aliases, decoupled enrichment)"
  );
  console.log(`📡  Model: ${MODEL}`);
  console.log(`🔬  Concept: "${conceptName}"`);
  console.log(`📂  Category: ${categorySlug}\n`);

  const genAI = new GoogleGenerativeAI(API_KEY);

  // ── Step 1: Generate search aliases ───────────────────────────────────
  console.log("🔤  Generating search aliases (transliterations)...");
  const specificAliases = await generateSearchAliases(conceptName, genAI);
  const allTerms = [conceptName, ...specificAliases];

  const broadTerms: string[] = [];
  const categoryHebrew = CATEGORY_HEBREW[categorySlug];
  if (categoryHebrew) broadTerms.push(categoryHebrew);

  console.log(`✅  Specific aliases: [${allTerms.join(", ")}]`);
  if (broadTerms.length > 0) {
    console.log(`✅  Broad category terms (Tier 2): [${broadTerms.join(", ")}]`);
  }
  console.log();

  // ── Step 2: Two-tiered RAG retrieval ──────────────────────────────────
  console.log("🔍  Searching magazine archive...");
  const ragResult = retrieve(conceptName, specificAliases, broadTerms);
  const hasRagContext = ragResult.chunks.length > 0;
  const ragContext = formatContextForPrompt(ragResult);

  if (hasRagContext) {
    console.log(
      `✅  Found ${ragResult.matchedArticles} articles (${ragResult.tier1Articles} specific + ${ragResult.tier2Articles} broad), ${ragResult.chunks.length} chunks (from ${ragResult.totalArticlesScanned} total)\n`
    );
    for (const src of ragResult.sources) {
      const d = new Date(src.date).toLocaleDateString("he-IL");
      console.log(`   📰 [${d}] ${src.title}`);
    }
    console.log();
  } else {
    console.log(
      `⚠️  No relevant articles found in archive (${ragResult.totalArticlesScanned} scanned)`
    );
    console.log(
      "   → Will use global AI knowledge with needsHumanReview flag\n"
    );
  }

  // ── Step 3: Generate content with Gemini ──────────────────────────────
  console.log("⏳  Generating content with Gemini...\n");

  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  const prompt = buildPrompt(conceptName, categorySlug, ragContext);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  let concept: Record<string, unknown>;
  try {
    concept = JSON.parse(text);
  } catch {
    console.error("❌  Failed to parse Gemini response as JSON.");
    console.error("Raw response (first 500 chars):\n", text.slice(0, 500));
    const fallbackPath = path.join(CONTENT_DIR, `_error_${Date.now()}.txt`);
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
    fs.writeFileSync(fallbackPath, text, "utf-8");
    console.error(`💾  Raw response saved to ${fallbackPath}`);
    process.exit(1);
  }

  const slug = (concept.slug as string) || slugify(conceptName);
  concept.slug = slug;
  concept.categorySlug = categorySlug;

  if (!hasRagContext) {
    concept.needsHumanReview = true;
    concept.sourceType = "global_ai";
  } else {
    concept.needsHumanReview = false;
    concept.sourceType = "rag";

    if (!concept.sources || (concept.sources as unknown[]).length === 0) {
      concept.sources = ragResult.sources;
    }
  }

  if (allTerms.length > 0) {
    concept.searchAliases = allTerms;
  }

  const sections =
    (concept.sections as Array<Record<string, unknown>>) ?? [];
  const faqs = (concept.faqs as Array<Record<string, unknown>>) ?? [];
  const related =
    (concept.relatedConcepts as Array<Record<string, unknown>>) ?? [];
  const sources =
    (concept.sources as Array<Record<string, unknown>>) ?? [];

  console.log(`✅  Generated: "${concept.title}"`);
  console.log(`   slug: ${slug}`);
  console.log(`   sections: ${sections.length}`);
  console.log(`   FAQs: ${faqs.length}`);
  console.log(`   related: ${related.length}`);
  console.log(`   sources: ${sources.length}`);
  console.log(`   sourceType: ${concept.sourceType}`);
  console.log(`   needsHumanReview: ${concept.needsHumanReview}`);
  console.log(`   searchAliases: ${allTerms.length} terms`);

  const bluf = concept.bluf as { points?: string[] } | undefined;
  if (bluf?.points) {
    console.log("\n📋  BLUF points:");
    for (const p of bluf.points) {
      console.log(`   • ${p}`);
    }
  }

  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  const outPath = path.join(CONTENT_DIR, `${slug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(concept, null, 2), "utf-8");
  console.log(`\n💾  Saved to ${outPath}`);
  console.log(
    `🚀  Page is now LIVE at http://localhost:9343/concept/${slug}`
  );
}

main().catch((err) => {
  console.error("❌  Fatal error:", err.message ?? err);
  process.exit(1);
});
