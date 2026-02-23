/**
 * WordPress Archive Fetcher — retrieves all posts from the Cannabis Magazine
 * WordPress site via REST API, strips HTML, and saves as clean JSON files.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/4-fetch-wp-archive.ts
 *   npx tsx scripts/ai-factory/4-fetch-wp-archive.ts --limit 100
 *   npx tsx scripts/ai-factory/4-fetch-wp-archive.ts --start-page 5
 *   npx tsx scripts/ai-factory/4-fetch-wp-archive.ts --skip-existing
 *
 * Flags:
 *   --limit <n>       Max number of posts to fetch (default: all)
 *   --start-page <n>  Start from this page number (default: 1)
 *   --skip-existing   Don't overwrite posts already saved
 *   --delay <seconds> Delay between page requests (default: 2)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import striptags from "striptags";

const WP_API_BASE =
  "https://www.xn--4dbcyzi5a.com/wp-json/wp/v2/posts";
const PER_PAGE = 100;
const ARCHIVE_DIR = path.join(__dirname, "../../src/data/magazine-archive");

interface WpPost {
  id: number;
  date: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  categories: number[];
  tags: number[];
}

interface CleanPost {
  id: number;
  date: string;
  link: string;
  title: string;
  content: string;
  excerpt: string;
  categories: number[];
  tags: number[];
  wordCount: number;
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getFlag(name: string, fallback: number): number {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return parseInt(args[idx + 1], 10) || fallback;
}

const maxPosts = args.includes("--limit") ? getFlag("--limit", Infinity) : Infinity;
const startPage = getFlag("--start-page", 1);
const skipExisting = args.includes("--skip-existing");
const delaySeconds = getFlag("--delay", 2);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function cleanHtml(html: string): string {
  let text = html;

  // Remove WordPress shortcodes like [shortcode attr="val"]...[/shortcode]
  text = text.replace(/\[\/?\w+[^\]]*\]/g, "");

  // Remove inline styles and scripts
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Strip all remaining HTML tags
  text = striptags(text);

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "");

  // Normalize whitespace: collapse multiple newlines and trim
  text = text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();

  return text;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function progressBar(current: number, total: number | null, width = 30): string {
  if (!total) return `[${current} fetched]`;
  const pct = current / total;
  const filled = Math.round(width * pct);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `${bar} ${current}/${total} (${Math.round(pct * 100)}%)`;
}

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchPage(page: number): Promise<{ posts: WpPost[]; totalPages: number; totalPosts: number }> {
  const url = `${WP_API_BASE}?per_page=${PER_PAGE}&page=${page}&_fields=id,date,link,title,content,excerpt,categories,tags`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Cannapedia-Archive-Fetcher/1.0",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 400 || res.status === 404) {
      return { posts: [], totalPages: page - 1, totalPosts: 0 };
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText} for page ${page}`);
  }

  const totalPages = parseInt(res.headers.get("x-wp-totalpages") ?? "0", 10);
  const totalPosts = parseInt(res.headers.get("x-wp-total") ?? "0", 10);
  const posts = (await res.json()) as WpPost[];

  return { posts, totalPages, totalPosts };
}

function processPost(post: WpPost): CleanPost {
  return {
    id: post.id,
    date: post.date,
    link: post.link,
    title: cleanHtml(post.title.rendered),
    content: cleanHtml(post.content.rendered),
    excerpt: cleanHtml(post.excerpt.rendered),
    categories: post.categories,
    tags: post.tags,
    wordCount: countWords(cleanHtml(post.content.rendered)),
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   📰  WordPress Archive Fetcher                 ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`   API:    ${WP_API_BASE}`);
  console.log(`   Delay:  ${delaySeconds}s between page requests`);
  console.log(`   Output: ${ARCHIVE_DIR}`);
  if (maxPosts < Infinity) console.log(`   Limit:  ${maxPosts} posts`);
  if (startPage > 1) console.log(`   Start:  page ${startPage}`);
  if (skipExisting) console.log(`   Mode:   skip existing files`);
  console.log(`\n${"─".repeat(55)}\n`);

  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });

  // Fetch first page to get total count
  console.log("⏳  Fetching page 1 to determine total post count...");
  const first = await fetchPage(startPage);

  if (first.posts.length === 0) {
    console.log("❌  No posts found. Check the API URL.");
    return;
  }

  const totalPosts = first.totalPosts;
  const totalPages = first.totalPages;
  const effectiveLimit = Math.min(maxPosts, totalPosts);

  console.log(`✅  Found ${totalPosts} posts across ${totalPages} pages\n`);
  console.log(
    `📋  Plan: fetch up to ${effectiveLimit} posts (pages ${startPage}–${totalPages})\n`
  );
  console.log(`${"─".repeat(55)}\n`);

  let fetched = 0;
  let saved = 0;
  let skipped = 0;
  let page = startPage;
  const startTime = Date.now();

  // Process first page we already fetched
  let postsToProcess: WpPost[] = first.posts;
  let currentTotalPages = totalPages;

  while (true) {
    for (const post of postsToProcess) {
      if (fetched >= effectiveLimit) break;

      const outPath = path.join(ARCHIVE_DIR, `post-${post.id}.json`);

      if (skipExisting && fs.existsSync(outPath)) {
        skipped++;
        fetched++;
        continue;
      }

      const clean = processPost(post);
      fs.writeFileSync(outPath, JSON.stringify(clean, null, 2), "utf-8");
      saved++;
      fetched++;
    }

    console.log(
      `   📄 Page ${page}: ${postsToProcess.length} posts → ${progressBar(fetched, effectiveLimit)}`
    );

    if (fetched >= effectiveLimit) break;

    page++;
    if (page > currentTotalPages) break;

    // Rate-limit: wait before next request
    process.stdout.write(`   ⏱️  Waiting ${delaySeconds}s...`);
    await sleep(delaySeconds);
    process.stdout.write("\r" + " ".repeat(50) + "\r");

    try {
      const result = await fetchPage(page);
      if (result.posts.length === 0) {
        console.log(`   ℹ️  Page ${page} returned 0 posts. Pagination complete.`);
        break;
      }
      postsToProcess = result.posts;
      currentTotalPages = result.totalPages || currentTotalPages;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`\n   ⚠️  Page ${page} failed: ${msg}`);
      console.log("   ℹ️  Stopping gracefully.\n");
      break;
    }
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log(`\n${"─".repeat(55)}`);
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   📊  Fetch Complete                            ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`   💾 Saved:    ${saved} posts`);
  if (skipped > 0) console.log(`   ⏭️  Skipped:  ${skipped} existing`);
  console.log(`   📁 Total:    ${fetched} processed`);
  console.log(`   ⏱️  Duration: ${minutes}m ${seconds}s`);
  console.log(`   📂 Output:   ${ARCHIVE_DIR}\n`);

  // Quick stats on saved content
  const files = fs.readdirSync(ARCHIVE_DIR).filter((f) => f.endsWith(".json"));
  if (files.length > 0) {
    let totalWords = 0;
    for (const file of files) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(ARCHIVE_DIR, file), "utf-8")
        );
        totalWords += data.wordCount ?? 0;
      } catch {
        // skip malformed files
      }
    }
    console.log(`   📊 Archive stats:`);
    console.log(`      Files: ${files.length}`);
    console.log(
      `      Total words: ${totalWords.toLocaleString()}`
    );
    console.log(
      `      Avg words/post: ${Math.round(totalWords / files.length).toLocaleString()}`
    );
  }
}

main().catch((err) => {
  console.error("❌  Fatal error:", err.message ?? err);
  process.exit(1);
});
