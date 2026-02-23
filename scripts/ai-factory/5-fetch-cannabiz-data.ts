/**
 * Cannabiz.co.il Product Data Fetcher
 *
 * Extracts structured product metadata from the WooCommerce store at
 * cannabiz.co.il — attributes, tags (genetics/parent strains), and
 * categories. Used as a background Knowledge Graph to enrich scientific
 * concept pages, NOT to generate standalone product pages.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/5-fetch-cannabiz-data.ts
 *   npx tsx scripts/ai-factory/5-fetch-cannabiz-data.ts --limit 50
 *   npx tsx scripts/ai-factory/5-fetch-cannabiz-data.ts --delay 3
 *   npx tsx scripts/ai-factory/5-fetch-cannabiz-data.ts --skip-existing
 *
 * Flags:
 *   --limit <n>       Max products to fetch (default: all)
 *   --delay <seconds> Delay between page requests (default: 2)
 *   --skip-existing   Skip if catalog file already exists
 *
 * Authentication:
 *   WooCommerce REST API v3 requires consumer keys. Set these in .env.local:
 *     CANNABIZ_WC_KEY=ck_xxxxx
 *     CANNABIZ_WC_SECRET=cs_xxxxx
 *
 *   If no keys are set, the script will attempt the public WC Store API
 *   (limited attribute/tag data) as fallback.
 */

import dotenv from "dotenv";
import * as fs from "node:fs";
import * as path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const CANNABIZ_DOMAIN = "https://cannabiz.co.il";
const WC_V3_BASE = `${CANNABIZ_DOMAIN}/wp-json/wc/v3/products`;
const WC_STORE_BASE = `${CANNABIZ_DOMAIN}/wp-json/wc/store/v1/products`;
const PER_PAGE = 100;

const CATALOG_PATH = path.join(
  __dirname,
  "../../src/data/cannabiz-catalog.json"
);

const WC_KEY = process.env.CANNABIZ_WC_KEY ?? "";
const WC_SECRET = process.env.CANNABIZ_WC_SECRET ?? "";
const hasAuth = Boolean(WC_KEY && WC_SECRET);

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getFlag(name: string, fallback: number): number {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) return fallback;
  return parseInt(args[idx + 1], 10) || fallback;
}

const maxProducts = args.includes("--limit")
  ? getFlag("--limit", Infinity)
  : Infinity;
const delaySeconds = getFlag("--delay", 2);
const skipExisting = args.includes("--skip-existing");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WcAttribute {
  id: number;
  name: string;
  slug?: string;
  option?: string;
  options?: string[];
}

interface WcTag {
  id: number;
  name: string;
  slug: string;
}

interface WcCategory {
  id: number;
  name: string;
  slug: string;
}

interface WcProductV3 {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  status: string;
  stock_status?: string;
  attributes: WcAttribute[];
  categories: WcCategory[];
  tags: WcTag[];
}

interface WcProductStore {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  attributes: {
    id: number;
    name: string;
    taxonomy: string;
    has_variations: boolean;
  }[];
}

export interface CatalogEntry {
  slug: string;
  name: string;
  attributes: Record<string, string>;
  tags: string[];
  categories: string[];
  link: string;
  stockStatus: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function progressBar(
  current: number,
  total: number | null,
  width = 30
): string {
  if (!total || total === Infinity) return `[${current} fetched]`;
  const pct = current / total;
  const filled = Math.round(width * pct);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `${bar} ${current}/${total} (${Math.round(pct * 100)}%)`;
}

function buildAuthHeader(): Record<string, string> {
  if (!hasAuth) return {};
  const encoded = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64");
  return { Authorization: `Basic ${encoded}` };
}

function extractAttributes(attrs: WcAttribute[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const attr of attrs) {
    const key = attr.slug ?? attr.name.toLowerCase().replace(/\s+/g, "_");
    const value =
      attr.option ??
      (attr.options && attr.options.length > 0
        ? attr.options.join(", ")
        : "");
    if (value) result[key] = value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Fetchers
// ---------------------------------------------------------------------------

async function fetchPageV3(
  page: number
): Promise<{
  products: WcProductV3[];
  totalPages: number;
  totalProducts: number;
}> {
  const fields =
    "id,name,slug,permalink,status,stock_status,attributes,categories,tags";
  const url = `${WC_V3_BASE}?per_page=${PER_PAGE}&page=${page}&status=publish&_fields=${fields}`;

  const res = await fetch(url, {
    headers: {
      ...buildAuthHeader(),
      "User-Agent": "Cannapedia-Catalog-Fetcher/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Auth failed (${res.status}). Ensure CANNABIZ_WC_KEY and CANNABIZ_WC_SECRET are set in .env.local`
      );
    }
    if (res.status === 400 || res.status === 404) {
      return { products: [], totalPages: page - 1, totalProducts: 0 };
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText} for page ${page}`);
  }

  const totalPages = parseInt(
    res.headers.get("x-wp-totalpages") ?? "0",
    10
  );
  const totalProducts = parseInt(res.headers.get("x-wp-total") ?? "0", 10);
  const products = (await res.json()) as WcProductV3[];

  return { products, totalPages, totalProducts };
}

async function fetchPageStore(
  page: number
): Promise<{
  products: WcProductStore[];
  totalPages: number;
  totalProducts: number;
}> {
  const url = `${WC_STORE_BASE}?per_page=${PER_PAGE}&page=${page}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Cannapedia-Catalog-Fetcher/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    if (res.status === 400 || res.status === 404) {
      return { products: [], totalPages: page - 1, totalProducts: 0 };
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText} for page ${page}`);
  }

  const totalPages = parseInt(
    res.headers.get("x-wp-totalpages") ?? "0",
    10
  );
  const totalProducts = parseInt(res.headers.get("x-wp-total") ?? "0", 10);
  const products = (await res.json()) as WcProductStore[];

  return { products, totalPages, totalProducts };
}

function processV3Product(product: WcProductV3): CatalogEntry {
  return {
    slug: product.slug,
    name: product.name,
    attributes: extractAttributes(product.attributes),
    tags: (product.tags ?? []).map((t) => t.name),
    categories: (product.categories ?? []).map((c) => c.name),
    link: product.permalink,
    stockStatus: product.stock_status ?? "instock",
  };
}

function processStoreProduct(product: WcProductStore): CatalogEntry {
  const attrs: Record<string, string> = {};
  for (const a of product.attributes) {
    attrs[a.taxonomy || a.name] = a.name;
  }
  return {
    slug: product.slug,
    name: product.name,
    attributes: attrs,
    tags: [],
    categories: [],
    link: product.permalink,
    stockStatus: "instock",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   Cannabiz Product Catalog Fetcher              ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`   Domain: ${CANNABIZ_DOMAIN}`);
  console.log(
    `   Auth:   ${hasAuth ? "WC REST API v3 (authenticated)" : "WC Store API (public, limited tags/attrs)"}`
  );
  console.log(`   Delay:  ${delaySeconds}s between page requests`);
  console.log(`   Output: ${CATALOG_PATH}`);
  if (maxProducts < Infinity) console.log(`   Limit:  ${maxProducts} products`);
  console.log(`\n${"─".repeat(55)}\n`);

  if (skipExisting && fs.existsSync(CATALOG_PATH)) {
    console.log(
      "   Catalog already exists. Use without --skip-existing to overwrite."
    );
    return;
  }

  const catalog: CatalogEntry[] = [];
  let page = 1;
  let totalPages = 1;
  let totalProducts: number | null = null;
  let fetched = 0;

  const startTime = Date.now();

  while (true) {
    try {
      if (hasAuth) {
        const result = await fetchPageV3(page);
        if (result.products.length === 0) break;
        totalPages = result.totalPages || totalPages;
        if (!totalProducts) totalProducts = result.totalProducts;

        for (const p of result.products) {
          if (fetched >= maxProducts) break;
          catalog.push(processV3Product(p));
          fetched++;
        }
      } else {
        const result = await fetchPageStore(page);
        if (result.products.length === 0) break;
        totalPages = result.totalPages || totalPages;
        if (!totalProducts) totalProducts = result.totalProducts;

        for (const p of result.products) {
          if (fetched >= maxProducts) break;
          catalog.push(processStoreProduct(p));
          fetched++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`\n   Page ${page} failed: ${msg}`);
      console.log("   Stopping gracefully.\n");
      break;
    }

    console.log(`   Page ${page}: ${progressBar(fetched, totalProducts)}`);

    if (fetched >= maxProducts) break;
    if (page >= totalPages) break;

    page++;
    process.stdout.write(`   Waiting ${delaySeconds}s...`);
    await sleep(delaySeconds);
    process.stdout.write("\r" + " ".repeat(50) + "\r");
  }

  // Save catalog
  const outputDir = path.dirname(CATALOG_PATH);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf-8");

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  console.log(`\n${"─".repeat(55)}`);
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║   Fetch Complete                                ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`   Products: ${catalog.length}`);
  console.log(`   Duration: ${minutes}m ${seconds}s`);
  console.log(`   Output:   ${CATALOG_PATH}\n`);

  // Category distribution
  const catCounts = new Map<string, number>();
  for (const entry of catalog) {
    for (const cat of entry.categories) {
      catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
    }
    if (entry.categories.length === 0) {
      catCounts.set("(uncategorized)", (catCounts.get("(uncategorized)") ?? 0) + 1);
    }
  }
  if (catCounts.size > 0) {
    console.log("   Category distribution:");
    const sortedCats = [...catCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sortedCats) {
      console.log(`      ${cat}: ${count} products`);
    }
  }

  // Stock status distribution
  const stockCounts = new Map<string, number>();
  for (const entry of catalog) {
    const s = entry.stockStatus || "unknown";
    stockCounts.set(s, (stockCounts.get(s) ?? 0) + 1);
  }
  if (stockCounts.size > 0) {
    console.log("\n   Stock status:");
    for (const [status, count] of [...stockCounts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`      ${status}: ${count} products`);
    }
  }

  // Tag distribution (top 15)
  const tagCounts = new Map<string, number>();
  for (const entry of catalog) {
    for (const tag of entry.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const productsWithTags = catalog.filter((e) => e.tags.length > 0).length;
  console.log(
    `\n   Tags: ${productsWithTags}/${catalog.length} products have genetics/tags`
  );
  if (tagCounts.size > 0) {
    console.log("   Top tags (genetics):");
    const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [tag, count] of sortedTags.slice(0, 15)) {
      console.log(`      ${tag}: ${count} products`);
    }
    if (sortedTags.length > 15) {
      console.log(`      ... and ${sortedTags.length - 15} more tags`);
    }
  }

  // Attribute distribution
  const attrCounts = new Map<string, number>();
  for (const entry of catalog) {
    for (const key of Object.keys(entry.attributes)) {
      attrCounts.set(key, (attrCounts.get(key) ?? 0) + 1);
    }
  }
  if (attrCounts.size > 0) {
    console.log("\n   Attribute distribution:");
    const sorted = [...attrCounts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [key, count] of sorted.slice(0, 15)) {
      console.log(`      ${key}: ${count} products`);
    }
    if (sorted.length > 15) {
      console.log(`      ... and ${sorted.length - 15} more attributes`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message ?? err);
  process.exit(1);
});
