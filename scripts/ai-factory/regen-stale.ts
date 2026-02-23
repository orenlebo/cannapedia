/**
 * Regenerate stale concept pages — pages whose newest source predates 2020.
 * Now includes multi-source retrieval, fact-checking, and review workflow.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/regen-stale.ts              # dry-run — list stale only
 *   npx tsx scripts/ai-factory/regen-stale.ts --all        # dry-run — list ALL pages
 *   npx tsx scripts/ai-factory/regen-stale.ts --run        # regenerate stale
 *   npx tsx scripts/ai-factory/regen-stale.ts --all --run  # regenerate ALL
 *   npx tsx scripts/ai-factory/regen-stale.ts --all --run --batch 50 --delay 15 --skip-verify
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
  console.error("❌  Missing GEMINI_API_KEY in .env.local");
  process.exit(1);
}

const CONTENT_DIR = path.join(__dirname, "../../src/data/content");
const CUTOFF_YEAR = 2020;

const args = process.argv.slice(2);
const doRun = args.includes("--run");
const doAll = args.includes("--all");
const skipVerify = args.includes("--skip-verify");
const batchIdx = args.indexOf("--batch");
const batchSize =
  batchIdx >= 0 && batchIdx + 1 < args.length
    ? parseInt(args[batchIdx + 1], 10) || 10
    : 999;
const delayIdx = args.indexOf("--delay");
const delaySeconds =
  delayIdx >= 0 && delayIdx + 1 < args.length
    ? parseInt(args[delayIdx + 1], 10) || 20
    : 20;

interface StaleEntry {
  slug: string;
  categorySlug: string;
  name: string;
  newestSource: number;
}

function findPages(all: boolean): StaleEntry[] {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json"));
  const entries: StaleEntry[] = [];

  for (const file of files) {
    const data = JSON.parse(
      fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8")
    );
    const sources = data.sources || [];

    const years = sources
      .map((s: { date?: string }) => new Date(s.date || "2000").getFullYear())
      .filter((y: number) => y > 1900);
    const newest = years.length > 0 ? Math.max(...years) : 0;

    if (all || newest < CUTOFF_YEAR) {
      entries.push({
        slug: data.slug || file.replace(".json", ""),
        categorySlug: data.categorySlug || "unknown",
        name: data.title || data.slug || file.replace(".json", ""),
        newestSource: newest,
      });
    }
  }

  return entries.sort((a, b) => a.newestSource - b.newestSource);
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

async function main() {
  const pages = findPages(doAll);
  const label = doAll ? "total" : `stale (newest source < ${CUTOFF_YEAR})`;
  console.log(`\n🔍  Found ${pages.length} ${label} pages:\n`);

  for (const entry of pages) {
    console.log(
      `   ${entry.slug.padEnd(45)} ${entry.categorySlug.padEnd(30)} newest: ${entry.newestSource || "—"}`
    );
  }

  if (!doRun) {
    console.log(`\n   Dry run. Pass --run to regenerate.`);
    console.log(`   npx tsx scripts/ai-factory/regen-stale.ts --run --all --batch 10 --skip-verify\n`);
    return;
  }

  const toProcess = pages.slice(0, batchSize);
  console.log(
    `\n🚀  Regenerating ${toProcess.length} pages (delay: ${delaySeconds}s)...\n`
  );

  const genAI = new GoogleGenerativeAI(API_KEY);
  let success = 0;
  let fail = 0;
  let pending = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const entry = toProcess[i];
    const label = `[${i + 1}/${toProcess.length}]`;
    console.log(`${label} ${entry.name} (${entry.categorySlug})`);

    try {
      // Aliases
      process.stdout.write("      Aliases... ");
      const specificAliases = await generateSearchAliases(entry.name, genAI);
      const allTerms = [entry.name, ...specificAliases];
      console.log(`${allTerms.length} terms`);

      // Archive RAG
      process.stdout.write("      RAG... ");
      const broadTerms: string[] = [];
      const catHebrew = CATEGORY_HEBREW[entry.categorySlug];
      if (catHebrew) broadTerms.push(catHebrew);
      const ragResult = retrieve(entry.name, specificAliases, broadTerms);
      const hasRag = ragResult.chunks.length > 0;
      const ragContext = formatContextForPrompt(ragResult);
      console.log(hasRag ? `${ragResult.matchedArticles} articles` : "none");

      // Wikipedia
      process.stdout.write("      Wiki... ");
      const wikiResult = await fetchWikipediaContext(allTerms, entry.name);
      const hasWiki = wikiResult.context.length > 0;
      console.log(hasWiki ? `${wikiResult.sources.length} articles` : "none");

      // Live Magazine
      process.stdout.write("      LiveMag... ");
      const liveMagResult = await fetchLiveMagazineContext(allTerms, entry.name);
      const hasLiveMag = liveMagResult.context.length > 0;
      console.log(hasLiveMag ? `${liveMagResult.sources.length} articles` : "none");

      // Google Search
      process.stdout.write("      Google... ");
      const googleResult = await fetchGoogleSearchContext(allTerms, entry.name);
      const hasGoogle = googleResult.context.length > 0;
      console.log(hasGoogle ? `${googleResult.sources.length} results` : "none");

      const combinedContext = buildCombinedContext({
        ragContext,
        liveMagazineContext: liveMagResult.context,
        wikiContext: wikiResult.context,
        googleContext: googleResult.context,
      });
      const hasCombinedContext = combinedContext.length > 0;

      // Generate
      process.stdout.write("      Generating... ");
      const model = genAI.getGenerativeModel({
        model: MODEL,
        systemInstruction: SYSTEM_INSTRUCTION,
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json",
        },
      });

      const prompt = buildPrompt(entry.name, entry.categorySlug, combinedContext);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let concept: Record<string, unknown>;
      try {
        concept = JSON.parse(text);
      } catch {
        throw new Error("JSON parse failed");
      }

      const slug = (concept.slug as string) || slugify(entry.name);
      concept.slug = slug;
      concept.categorySlug = entry.categorySlug;

      // Merge sources
      const existingSources = (concept.sources as Array<{ title: string; url: string; date: string }>) ?? [];
      const allSources = [...existingSources];
      const existingUrls = new Set(allSources.map((s) => s.url));

      for (const src of [...ragResult.sources, ...liveMagResult.sources, ...wikiResult.sources, ...googleResult.sources]) {
        if (!existingUrls.has(src.url)) {
          allSources.push(src);
          existingUrls.add(src.url);
        }
      }
      concept.sources = allSources;

      if (!hasCombinedContext) {
        concept.sourceType = "global_ai";
      } else {
        concept.sourceType = hasRag ? "rag" : "wikipedia";
      }

      if (allTerms.length > 0) {
        concept.searchAliases = allTerms;
      }

      console.log("done");

      // Fact-check
      if (!skipVerify) {
        process.stdout.write("      Verifying... ");
        const fcResult = await factCheck(concept, combinedContext, genAI);
        concept.confidenceScore = fcResult.confidenceScore;
        concept.unverifiedClaims = fcResult.unverifiedClaims;

        const needsReview =
          fcResult.confidenceScore < 0.85 ||
          fcResult.riskLevel === "high" ||
          !hasCombinedContext;

        if (needsReview) {
          concept.verificationStatus = "pending";
          concept.needsHumanReview = true;
          console.log(`PENDING (${Math.round(fcResult.confidenceScore * 100)}%, ${fcResult.riskLevel})`);
          pending++;

          await notifyReview({
            conceptName: (concept.title as string) || entry.name,
            slug,
            categorySlug: entry.categorySlug,
            confidenceScore: fcResult.confidenceScore,
            riskLevel: fcResult.riskLevel,
            unverifiedClaims: fcResult.unverifiedClaims,
            sourcesConsulted: allSources.map((s) => (s as { title: string }).title),
          });
        } else {
          concept.verificationStatus = "verified";
          concept.needsHumanReview = false;
          console.log(`VERIFIED (${Math.round(fcResult.confidenceScore * 100)}%)`);
        }
      } else {
        concept.verificationStatus = "verified";
        concept.needsHumanReview = false;
      }

      const outPath = path.join(CONTENT_DIR, `${slug}.json`);
      fs.writeFileSync(outPath, JSON.stringify(concept, null, 2), "utf-8");

      const sections = (concept.sections as unknown[])?.length ?? 0;
      const srcParts = [hasRag && "RAG", hasWiki && "Wiki", hasLiveMag && "Mag", hasGoogle && "Google"].filter(Boolean);
      console.log(`      ✅ ${sections} sections (${srcParts.join("+") || "GLOBAL"})`);
      success++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`      ❌ FAILED: ${msg}`);
      fail++;

      if (msg.includes("429") || msg.includes("500") || msg.includes("503")) {
        const backoff = delaySeconds * 2;
        console.log(`      Rate limited — backing off ${backoff}s`);
        await sleep(backoff);
      }
    }

    if (i < toProcess.length - 1) {
      await sleep(delaySeconds);
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`✅  Success: ${success} (${pending} pending review)  |  ❌ Failed: ${fail}`);
  console.log(`Remaining: ${pages.length - toProcess.length}\n`);
}

main().catch((err) => {
  console.error("❌  Fatal error:", err.message ?? err);
  process.exit(1);
});
