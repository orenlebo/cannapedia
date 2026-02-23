/**
 * Bulk Concept Generator v3 — Queue-driven, crash-resilient.
 * Now includes multi-source retrieval, fact-checking, and review workflow.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/3-generate-bulk.ts --batch 20
 *   npx tsx scripts/ai-factory/3-generate-bulk.ts --batch 50 --category terpenes
 *   npx tsx scripts/ai-factory/3-generate-bulk.ts --retry-failed
 *   npx tsx scripts/ai-factory/3-generate-bulk.ts --status
 *   npx tsx scripts/ai-factory/3-generate-bulk.ts --batch 10 --skip-verify
 *
 * Flags:
 *   --batch <n>       Max concepts to process (default: 10)
 *   --category <slug> Only process concepts in this category
 *   --delay <seconds> Delay between concepts (default: 15)
 *   --retry-failed    Include failed items (up to maxAttempts)
 *   --status          Print queue summary and exit
 *   --skip-verify     Skip fact-checking step
 *
 * Requires GEMINI_API_KEY in .env.local
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

const QUEUE_PATH = path.join(__dirname, "concept-queue.json");
const CONTENT_DIR = path.join(__dirname, "../../src/data/content");
const MAX_ATTEMPTS = 3;

const args = process.argv.slice(2);

function getFlag(name: string, fallback: number): number {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return parseInt(args[idx + 1], 10) || fallback;
}

function getStringFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

const batchSize = getFlag("--batch", 10);
const delaySeconds = getFlag("--delay", 15);
const categoryFilter = getStringFlag("--category");
const retryFailed = args.includes("--retry-failed");
const statusOnly = args.includes("--status");
const skipVerify = args.includes("--skip-verify");

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

function loadQueue(): QueueFile {
  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`❌  Queue not found: ${QUEUE_PATH}`);
    console.error("   Run 7-expand-taxonomy.ts first to create the queue.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(QUEUE_PATH, "utf-8")) as QueueFile;
}

function saveQueue(queue: QueueFile): void {
  queue.lastUpdated = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2), "utf-8");
}

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function progressBar(current: number, total: number, width = 30): string {
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(width * pct);
  const empty = width - filled;
  return `${"█".repeat(filled)}${"░".repeat(empty)} ${current}/${total} (${Math.round(pct * 100)}%)`;
}

function printStatus(queue: QueueFile): void {
  const pending = queue.concepts.filter((c) => c.status === "pending").length;
  const completed = queue.concepts.filter((c) => c.status === "completed").length;
  const failed = queue.concepts.filter((c) => c.status === "failed").length;
  const skipped = queue.concepts.filter((c) => c.status === "skipped").length;

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Concept Queue Status                           ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`   Total:     ${queue.concepts.length}`);
  console.log(`   Pending:   ${pending}`);
  console.log(`   Completed: ${completed}`);
  console.log(`   Failed:    ${failed}`);
  console.log(`   Skipped:   ${skipped}`);
  console.log(`   Updated:   ${queue.lastUpdated}\n`);

  const catMap = new Map<string, { p: number; c: number; f: number }>();
  for (const item of queue.concepts) {
    const e = catMap.get(item.categorySlug) ?? { p: 0, c: 0, f: 0 };
    if (item.status === "pending") e.p++;
    else if (item.status === "completed") e.c++;
    else if (item.status === "failed") e.f++;
    catMap.set(item.categorySlug, e);
  }
  console.log("   Per-category:");
  for (const [cat, { p, c, f }] of [...catMap.entries()].sort()) {
    console.log(`      ${cat}: ${c} done, ${p} pending, ${f} failed`);
  }

  if (failed > 0) {
    console.log("\n   Failed concepts:");
    for (const c of queue.concepts.filter((c) => c.status === "failed")) {
      console.log(`      ${c.slug} (${c.attempts} attempts): ${c.lastError}`);
    }
  }
}

async function main() {
  const queue = loadQueue();

  if (statusOnly) {
    printStatus(queue);
    return;
  }

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Cannapedia Bulk Generator v3 (Multi-source)    ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`   Model:    ${MODEL}`);
  console.log(`   Batch:    ${batchSize}`);
  console.log(`   Delay:    ${delaySeconds}s`);
  if (categoryFilter) console.log(`   Category: ${categoryFilter}`);
  if (retryFailed) console.log(`   Mode:     retry-failed`);
  if (skipVerify) console.log(`   Verify:   SKIPPED`);
  console.log();

  let candidates = queue.concepts.filter((c) => {
    if (c.status === "completed" || c.status === "skipped") return false;
    if (c.status === "failed" && !retryFailed) return false;
    if (c.status === "failed" && c.attempts >= MAX_ATTEMPTS) return false;
    if (categoryFilter && c.categorySlug !== categoryFilter) return false;
    return true;
  });

  if (candidates.length === 0) {
    console.log("   No concepts to process. Queue is up to date.\n");
    printStatus(queue);
    return;
  }

  const toProcess = candidates.slice(0, batchSize);
  console.log(
    `   Processing ${toProcess.length} of ${candidates.length} eligible concepts\n`
  );
  console.log(`${"─".repeat(60)}\n`);

  const genAI = new GoogleGenerativeAI(API_KEY);
  fs.mkdirSync(CONTENT_DIR, { recursive: true });

  let successCount = 0;
  let failCount = 0;
  let pendingCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const queueIdx = queue.concepts.findIndex((c) => c.slug === item.slug);
    const label = `[${i + 1}/${toProcess.length}]`;

    console.log(`${label} ${item.name} (${item.categorySlug})`);
    console.log(`      ${progressBar(i, toProcess.length)}`);

    item.attempts++;

    try {
      // Aliases
      process.stdout.write("      Aliases... ");
      const specificAliases = await generateSearchAliases(item.name, genAI);
      const allTerms = [item.name, ...specificAliases];
      console.log(`${allTerms.length} terms`);

      // Archive RAG
      process.stdout.write("      RAG... ");
      const broadTerms: string[] = [];
      const catHebrew = CATEGORY_HEBREW[item.categorySlug];
      if (catHebrew) broadTerms.push(catHebrew);

      const ragResult = retrieve(item.name, specificAliases, broadTerms);
      const hasRag = ragResult.chunks.length > 0;
      const ragContext = formatContextForPrompt(ragResult);
      console.log(
        hasRag
          ? `${ragResult.matchedArticles} articles, ${ragResult.chunks.length} chunks`
          : "none"
      );

      // Wikipedia
      process.stdout.write("      Wiki... ");
      const wikiResult = await fetchWikipediaContext(allTerms, item.name);
      const hasWiki = wikiResult.context.length > 0;
      console.log(hasWiki ? `${wikiResult.sources.length} articles` : "none");

      // Live Magazine
      process.stdout.write("      LiveMag... ");
      const liveMagResult = await fetchLiveMagazineContext(allTerms, item.name);
      const hasLiveMag = liveMagResult.context.length > 0;
      console.log(hasLiveMag ? `${liveMagResult.sources.length} articles` : "none");

      // Google Search
      process.stdout.write("      Google... ");
      const googleResult = await fetchGoogleSearchContext(allTerms, item.name);
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

      const prompt = buildPrompt(item.name, item.categorySlug, combinedContext);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      let concept: Record<string, unknown>;
      try {
        concept = JSON.parse(text);
      } catch {
        throw new Error("JSON parse failed");
      }

      const slug = (concept.slug as string) || slugify(item.name);
      concept.slug = slug;
      concept.categorySlug = item.categorySlug;

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
          pendingCount++;

          await notifyReview({
            conceptName: (concept.title as string) || item.name,
            slug,
            categorySlug: item.categorySlug,
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

      // Save
      const outPath = path.join(CONTENT_DIR, `${slug}.json`);
      fs.writeFileSync(outPath, JSON.stringify(concept, null, 2), "utf-8");

      item.status = "completed";
      item.completedAt = new Date().toISOString();
      item.lastError = null;
      if (queueIdx >= 0) queue.concepts[queueIdx] = item;
      saveQueue(queue);

      const sections = (concept.sections as unknown[])?.length ?? 0;
      const srcParts = [hasRag && "RAG", hasWiki && "Wiki", hasLiveMag && "Mag", hasGoogle && "Google"].filter(Boolean);
      console.log(
        `      ✅ ${sections} sections (${srcParts.join("+") || "GLOBAL"})`
      );
      successCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`      ❌ FAILED: ${msg}`);

      item.status = item.attempts >= MAX_ATTEMPTS ? "failed" : "pending";
      item.lastError = msg;
      if (queueIdx >= 0) queue.concepts[queueIdx] = item;
      saveQueue(queue);

      failCount++;

      if (msg.includes("429") || msg.includes("500") || msg.includes("503")) {
        const backoff = delaySeconds * Math.pow(2, item.attempts - 1);
        console.log(`      Rate limited — backing off ${backoff}s`);
        await sleep(backoff);
        continue;
      }
    }

    if (i < toProcess.length - 1) {
      await sleep(delaySeconds);
    }
  }

  console.log(`\n${"─".repeat(60)}\n`);
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Batch Complete                                 ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`   Succeeded:  ${successCount} (${pendingCount} pending review)`);
  console.log(`   Failed:     ${failCount}`);

  const remaining = queue.concepts.filter((c) => c.status === "pending").length;
  const totalFailed = queue.concepts.filter((c) => c.status === "failed").length;
  console.log(`   Remaining:  ${remaining} pending, ${totalFailed} failed`);
  console.log(`   Queue:      ${QUEUE_PATH}\n`);

  if (remaining > 0) {
    console.log(
      `   Next: npx tsx scripts/ai-factory/3-generate-bulk.ts --batch ${batchSize}`
    );
  }
}

main().catch((err) => {
  console.error("❌  Fatal error:", err.message ?? err);
  process.exit(1);
});
