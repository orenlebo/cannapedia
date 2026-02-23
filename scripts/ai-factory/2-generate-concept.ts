/**
 * Concept Generator v6 — RAG + Wikipedia + Live Magazine + Google Search,
 * with post-generation fact-checking and human-in-the-loop review.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/2-generate-concept.ts "CBD" "cannabinoids"
 *   npx tsx scripts/ai-factory/2-generate-concept.ts "מירצן" "terpenes"
 *   npx tsx scripts/ai-factory/2-generate-concept.ts "CBD" "cannabinoids" --skip-verify
 *
 * Requires GEMINI_API_KEY in .env.local
 * Optional: GOOGLE_CSE_API_KEY, GOOGLE_CSE_ID, RESEND_API_KEY, REVIEW_EMAIL
 */

import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs";
import * as path from "node:path";
import { retrieve, formatContextForPrompt } from "./rag-retriever";
import { fetchWikipediaContext } from "./wiki-fetcher";
import { fetchGoogleSearchContext } from "./google-fetcher";
import { fetchLiveMagazineContext } from "./live-magazine-fetcher";
import { factCheck } from "./fact-checker";
import { notifyReview } from "./review-notifier";
import {
  MODEL,
  CATEGORY_HEBREW,
  generateSearchAliases,
  SYSTEM_INSTRUCTION,
  buildPrompt,
  buildCombinedContext,
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
const skipVerify = process.argv.includes("--skip-verify");

if (!conceptName || !categorySlug) {
  console.error(
    '❌  Usage: npx tsx scripts/ai-factory/2-generate-concept.ts "<concept>" "<category-slug>"'
  );
  process.exit(1);
}

const CONTENT_DIR = path.join(__dirname, "../../src/data/content");

async function main() {
  console.log(
    "📝  Cannapedia Concept Generator v6 (Multi-source + Fact-check)"
  );
  console.log(`📡  Model: ${MODEL}`);
  console.log(`🔬  Concept: "${conceptName}"`);
  console.log(`📂  Category: ${categorySlug}`);
  if (skipVerify) console.log("⏭️   Fact-check: SKIPPED");
  console.log();

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

  // ── Step 2: Multi-source retrieval ────────────────────────────────────
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
      `⚠️  No relevant articles found in archive (${ragResult.totalArticlesScanned} scanned)\n`
    );
  }

  console.log("🌐  Fetching Wikipedia context...");
  const wikiResult = await fetchWikipediaContext(allTerms, conceptName);
  const hasWikiContext = wikiResult.context.length > 0;

  if (hasWikiContext) {
    console.log(`✅  Found ${wikiResult.sources.length} Wikipedia articles`);
    for (const src of wikiResult.sources) {
      console.log(`   📖 ${src.title}`);
    }
    console.log();
  } else {
    console.log("   ℹ️  No relevant Wikipedia articles found\n");
  }

  console.log("📰  Fetching live Cannabis Magazine articles...");
  const liveMagResult = await fetchLiveMagazineContext(allTerms, conceptName);
  const hasLiveMag = liveMagResult.context.length > 0;

  if (hasLiveMag) {
    console.log(`✅  Found ${liveMagResult.sources.length} live magazine articles`);
    for (const src of liveMagResult.sources) {
      console.log(`   📰 ${src.title}`);
    }
    console.log();
  } else {
    console.log("   ℹ️  No live magazine articles found\n");
  }

  console.log("🔎  Searching Google...");
  const googleResult = await fetchGoogleSearchContext(allTerms, conceptName);
  const hasGoogle = googleResult.context.length > 0;

  if (hasGoogle) {
    console.log(`✅  Found ${googleResult.sources.length} Google results`);
    for (const src of googleResult.sources) {
      console.log(`   🌍 ${src.title}`);
    }
    console.log();
  } else {
    console.log("   ℹ️  No Google results found (API key may not be set)\n");
  }

  const combinedContext = buildCombinedContext({
    ragContext,
    liveMagazineContext: liveMagResult.context,
    wikiContext: wikiResult.context,
    googleContext: googleResult.context,
  });
  const hasCombinedContext = combinedContext.length > 0;

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

  const prompt = buildPrompt(conceptName, categorySlug, combinedContext);
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

  // ── Step 4: Merge sources from all channels ───────────────────────────
  const existingSources = (concept.sources as Array<{ title: string; url: string; date: string }>) ?? [];
  const allSources = [...existingSources];
  const existingUrls = new Set(allSources.map((s) => s.url));

  const allExternalSources = [
    ...ragResult.sources,
    ...liveMagResult.sources,
    ...wikiResult.sources,
    ...googleResult.sources,
  ];

  for (const src of allExternalSources) {
    if (!existingUrls.has(src.url)) {
      allSources.push(src);
      existingUrls.add(src.url);
    }
  }
  concept.sources = allSources;

  if (!hasCombinedContext) {
    concept.sourceType = "global_ai";
  } else {
    concept.sourceType = hasRagContext ? "rag" : "wikipedia";
  }

  if (allTerms.length > 0) {
    concept.searchAliases = allTerms;
  }

  // ── Step 5: Fact-check ────────────────────────────────────────────────
  let fcResult = { confidenceScore: 1.0, unverifiedClaims: [] as string[], riskLevel: "low" as const, claims: [] as Array<{ claim: string; verified: boolean; source: string; note: string }> };

  if (!skipVerify) {
    console.log("🔍  Running fact-checker...");
    fcResult = await factCheck(concept, combinedContext, genAI);
    const scorePct = Math.round(fcResult.confidenceScore * 100);
    console.log(`   Confidence: ${scorePct}%`);
    console.log(`   Risk level: ${fcResult.riskLevel}`);
    console.log(`   Unverified claims: ${fcResult.unverifiedClaims.length}`);
    if (fcResult.unverifiedClaims.length > 0) {
      for (const c of fcResult.unverifiedClaims) {
        console.log(`   ⚠️  ${c}`);
      }
    }
    console.log();
  }

  // ── Step 6: Review decision ───────────────────────────────────────────
  concept.confidenceScore = fcResult.confidenceScore;
  concept.unverifiedClaims = fcResult.unverifiedClaims;

  const needsReview =
    fcResult.confidenceScore < 0.85 ||
    fcResult.riskLevel === "high" ||
    !hasCombinedContext;

  if (needsReview && !skipVerify) {
    concept.verificationStatus = "pending";
    concept.needsHumanReview = true;
    console.log("🔶  Status: PENDING — requires human review before publishing");

    await notifyReview({
      conceptName: (concept.title as string) || conceptName,
      slug,
      categorySlug,
      confidenceScore: fcResult.confidenceScore,
      riskLevel: fcResult.riskLevel,
      unverifiedClaims: fcResult.unverifiedClaims,
      sourcesConsulted: allSources.map((s) => (s as { title: string }).title),
    });
  } else {
    concept.verificationStatus = "verified";
    concept.needsHumanReview = false;
    console.log("✅  Status: VERIFIED — auto-approved for publishing");
  }

  // ── Step 7: Save ──────────────────────────────────────────────────────
  const sections =
    (concept.sections as Array<Record<string, unknown>>) ?? [];
  const faqs = (concept.faqs as Array<Record<string, unknown>>) ?? [];
  const related =
    (concept.relatedConcepts as Array<Record<string, unknown>>) ?? [];
  const sources =
    (concept.sources as Array<Record<string, unknown>>) ?? [];

  console.log(`\n✅  Generated: "${concept.title}"`);
  console.log(`   slug: ${slug}`);
  console.log(`   sections: ${sections.length}`);
  console.log(`   FAQs: ${faqs.length}`);
  console.log(`   related: ${related.length}`);
  console.log(`   sources: ${sources.length}`);
  console.log(`   sourceType: ${concept.sourceType}`);
  console.log(`   verificationStatus: ${concept.verificationStatus}`);
  console.log(`   confidenceScore: ${Math.round(fcResult.confidenceScore * 100)}%`);
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

  if (concept.verificationStatus === "verified") {
    console.log(
      `🚀  Page is now LIVE at http://localhost:9343/concept/${slug}`
    );
  } else {
    console.log(
      `⏸️   Page is PENDING review — will not appear on site until approved`
    );
    console.log(
      `   To approve: npx tsx scripts/ai-factory/approve-concept.ts ${slug}`
    );
  }
}

main().catch((err) => {
  console.error("❌  Fatal error:", err.message ?? err);
  process.exit(1);
});
