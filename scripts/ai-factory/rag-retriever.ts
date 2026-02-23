/**
 * RAG Retriever — Recency-Weighted, Title-First Scoring
 *
 * Pipeline:
 *   1. Score ALL articles (title +100, tags +50, content +2/occ capped +20)
 *   2. Apply Recency Multiplier: 1 + ((year - 2010) * 0.1)
 *   3. Apply PR Penalty (0.5x) for content-only matches (no title/tag hits)
 *   4. Apply Broad Penalty (0.3x) for articles matching only broad category terms
 *   5. Sort by FinalScore DESC → slice top N articles
 *   6. Chunk the selected articles
 *   7. Sort chunks chronologically (oldest→newest) for Lex Posterior
 *   8. Feed to Gemini
 */

import * as fs from "node:fs";
import * as path from "node:path";

const ARCHIVE_DIR = path.join(__dirname, "../../src/data/magazine-archive");
const MIN_WORD_COUNT = 50;
const MAX_CHUNKS_PER_ARTICLE = 3;
const CHUNK_TARGET_WORDS = 400;

export interface ArchiveArticle {
  id: number;
  date: string;
  link: string;
  title: string;
  content: string;
  excerpt: string;
  tags?: number[];
  wordCount: number;
}

export interface RetrievedChunk {
  articleId: number;
  articleTitle: string;
  articleUrl: string;
  articleDate: string;
  chunkIndex: number;
  text: string;
  wordCount: number;
}

export interface RetrievalResult {
  query: string;
  aliases: string[];
  totalArticlesScanned: number;
  matchedArticles: number;
  tier1Articles: number;
  tier2Articles: number;
  chunks: RetrievedChunk[];
  sources: { title: string; url: string; date: string }[];
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

function loadArchive(): ArchiveArticle[] {
  if (!fs.existsSync(ARCHIVE_DIR)) return [];

  const files = fs
    .readdirSync(ARCHIVE_DIR)
    .filter((f) => f.endsWith(".json"));
  const articles: ArchiveArticle[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(ARCHIVE_DIR, file), "utf-8");
      const data = JSON.parse(raw);

      if ((data.wordCount ?? 0) < MIN_WORD_COUNT) continue;
      if (!data.content || data.content.trim().length < 100) continue;

      articles.push({
        id: data.id,
        date: data.date,
        link: data.link,
        title: data.title,
        content: data.content,
        excerpt: data.excerpt ?? "",
        tags: data.tags ?? [],
        wordCount: data.wordCount ?? 0,
      });
    } catch {
      // Skip malformed files
    }
  }

  return articles;
}

// ---------------------------------------------------------------------------
// Term expansion
// ---------------------------------------------------------------------------

function expandTerms(raw: string[]): string[] {
  const terms: string[] = [];

  for (const item of raw) {
    const base = item.toLowerCase().trim();
    if (!base || base.length < 2) continue;
    terms.push(base);

    const parenMatch = base.match(/\(([^)]+)\)/);
    if (parenMatch) {
      terms.push(parenMatch[1].trim());
      terms.push(base.replace(/\([^)]+\)/, "").trim());
    }

    if (base.includes(" - "))
      terms.push(...base.split(" - ").map((t) => t.trim()));
    if (base.includes("/"))
      terms.push(...base.split("/").map((t) => t.trim()));
  }

  return [...new Set(terms.filter((t) => t.length >= 2))];
}

// ---------------------------------------------------------------------------
// Recency-Weighted, Title-First Scoring
// ---------------------------------------------------------------------------

interface ArticleScore {
  article: ArchiveArticle;
  titleTagScore: number;
  contentScore: number;
  baseScore: number;
  recencyMultiplier: number;
  prPenalty: number;
  broadPenalty: number;
  finalScore: number;
  isSpecific: boolean;
}

function scoreArticle(
  article: ArchiveArticle,
  specificTerms: string[],
  broadTerms: string[]
): ArticleScore {
  const titleLower = article.title.toLowerCase();
  const contentLower = article.content.toLowerCase();

  let titleTagScore = 0;
  let contentScore = 0;
  let densityBoost = 0;
  let hasSpecificMatch = false;

  // --- Score against SPECIFIC terms ---
  for (const term of specificTerms) {
    if (titleLower.includes(term)) {
      titleTagScore += 100;
      hasSpecificMatch = true;
    }

    const contentOccurrences = contentLower.split(term).length - 1;
    const cappedContentPts = Math.min(contentOccurrences * 2, 20);
    contentScore += cappedContentPts;

    if (contentOccurrences > 0) hasSpecificMatch = true;

    // Density Boost: article engages deeply with this specific term
    if (contentOccurrences >= 3) densityBoost = 40;
  }

  // --- Score against BROAD terms ---
  let hasBroadMatch = false;
  for (const term of broadTerms) {
    if (titleLower.includes(term)) {
      titleTagScore += 100;
      hasBroadMatch = true;
    }

    const contentOccurrences = contentLower.split(term).length - 1;
    const cappedContentPts = Math.min(contentOccurrences * 2, 20);
    contentScore += cappedContentPts;
    if (contentOccurrences > 0) hasBroadMatch = true;
  }

  const baseScore = titleTagScore + contentScore + densityBoost;
  if (baseScore === 0) {
    return {
      article,
      titleTagScore: 0,
      contentScore: 0,
      baseScore: 0,
      recencyMultiplier: 1,
      prPenalty: 1,
      broadPenalty: 1,
      finalScore: 0,
      isSpecific: false,
    };
  }

  // --- Recency multiplier: 1 + ((year - 2010) * 0.1) ---
  const year = new Date(article.date).getFullYear() || 2015;
  const recencyMultiplier = 1 + (year - 2010) * 0.1;

  // --- PR Penalty: if title/tags scored 0 → 0.5x ---
  const prPenalty = titleTagScore === 0 ? 0.5 : 1;

  // --- Broad Penalty: if matched ONLY broad terms (no specific) → 0.3x ---
  const broadPenalty = !hasSpecificMatch && hasBroadMatch ? 0.3 : 1;

  const finalScore =
    baseScore * recencyMultiplier * prPenalty * broadPenalty;

  return {
    article,
    titleTagScore,
    contentScore,
    baseScore,
    recencyMultiplier,
    prPenalty,
    broadPenalty,
    finalScore,
    isSpecific: hasSpecificMatch,
  };
}

// ---------------------------------------------------------------------------
// Semantic chunking
// ---------------------------------------------------------------------------

function chunkArticle(article: ArchiveArticle): string[] {
  const content = article.content;

  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);

  if (paragraphs.length === 0) return [content];

  const chunks: string[] = [];
  let currentChunk = "";
  let currentWords = 0;

  for (const para of paragraphs) {
    const paraWords = para.split(/\s+/).length;

    if (currentWords + paraWords > CHUNK_TARGET_WORDS && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
      currentWords = 0;
      if (chunks.length >= MAX_CHUNKS_PER_ARTICLE) break;
    }

    currentChunk += para + "\n\n";
    currentWords += paraWords;
  }

  if (currentChunk.trim() && chunks.length < MAX_CHUNKS_PER_ARTICLE) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0
    ? chunks
    : [content.slice(0, CHUNK_TARGET_WORDS * 6)];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @param conceptName  The specific concept to retrieve for.
 * @param aliases      Specific aliases (transliterations, English name, etc.)
 * @param broadTerms   Broad category terms (e.g., ["טרפנים"]) — penalized 0.3x.
 * @param maxArticles  Max articles to keep after scoring (default 15).
 * @param maxTotalChunks Max total chunks from selected articles (default 25).
 */
export function retrieve(
  conceptName: string,
  aliases: string[] = [],
  broadTerms: string[] = [],
  maxArticles = 15,
  maxTotalChunks = 25
): RetrievalResult {
  const archive = loadArchive();

  const specificTerms = expandTerms([conceptName, ...aliases]);
  const broadExpanded = expandTerms(broadTerms);

  // ── Step 1: Score ALL articles ────────────────────────────────────────
  const scored = archive
    .map((article) => scoreArticle(article, specificTerms, broadExpanded))
    .filter((s) => s.finalScore > 0);

  // ── Step 2: Sort by FinalScore DESC (best articles first) ─────────────
  scored.sort((a, b) => b.finalScore - a.finalScore);

  // ── Step 3: Slice top N articles ──────────────────────────────────────
  const topArticles = scored.slice(0, maxArticles);

  const specificCount = topArticles.filter((s) => s.isSpecific).length;
  const broadOnlyCount = topArticles.length - specificCount;

  // ── Step 4: Chunk the selected articles ───────────────────────────────
  const allChunks: RetrievedChunk[] = [];
  for (const entry of topArticles) {
    const textChunks = chunkArticle(entry.article);
    for (let i = 0; i < textChunks.length; i++) {
      allChunks.push({
        articleId: entry.article.id,
        articleTitle: entry.article.title,
        articleUrl: entry.article.link,
        articleDate: entry.article.date,
        chunkIndex: i,
        text: textChunks[i],
        wordCount: textChunks[i].split(/\s+/).length,
      });
      if (allChunks.length >= maxTotalChunks) break;
    }
    if (allChunks.length >= maxTotalChunks) break;
  }

  // ── Step 5: Final chronological sort (oldest→newest, Lex Posterior) ───
  allChunks.sort(
    (a, b) =>
      new Date(a.articleDate).getTime() - new Date(b.articleDate).getTime()
  );

  // ── Build deduplicated source list ────────────────────────────────────
  const sourceMap = new Map<
    number,
    { title: string; url: string; date: string }
  >();
  for (const chunk of allChunks) {
    if (!sourceMap.has(chunk.articleId)) {
      sourceMap.set(chunk.articleId, {
        title: chunk.articleTitle,
        url: chunk.articleUrl,
        date: chunk.articleDate,
      });
    }
  }

  return {
    query: conceptName,
    aliases: [...new Set([...specificTerms, ...broadExpanded])],
    totalArticlesScanned: archive.length,
    matchedArticles: topArticles.length,
    tier1Articles: specificCount,
    tier2Articles: broadOnlyCount,
    chunks: allChunks,
    sources: Array.from(sourceMap.values()),
  };
}

export function formatContextForPrompt(result: RetrievalResult): string {
  if (result.chunks.length === 0) return "";

  const header = `מקורות מתוך מגזין קנאביס (${result.matchedArticles} כתבות רלוונטיות — ${result.tier1Articles} ספציפיות + ${result.tier2Articles} רקע, מסודרות מהישנה לחדשה):\n`;

  const chunksText = result.chunks
    .map((chunk, i) => {
      const dateStr = new Date(chunk.articleDate).toLocaleDateString("he-IL");
      return `--- מקור ${i + 1} [${dateStr}] "${chunk.articleTitle}" ---\nExact URL: ${chunk.articleUrl}\n${chunk.text}`;
    })
    .join("\n\n");

  return header + chunksText;
}
