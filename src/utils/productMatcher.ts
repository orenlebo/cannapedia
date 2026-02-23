/**
 * Runtime product matcher — reads the latest Cannabiz catalog from disk
 * and returns matching in-stock products for a concept's search aliases.
 *
 * Runs server-side only (uses fs). Called at page render time so products
 * are always fresh without regenerating AI content.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CATALOG_PATH = path.join(
  process.cwd(),
  "src/data/cannabiz-catalog.json"
);

const FLOWER_CATEGORIES = ["תפרחות", "flowers", "פרחים"];
const MAX_PRODUCTS = 4;

export interface MatchedProduct {
  slug: string;
  name: string;
  attributes: Record<string, string>;
  tags: string[];
  categories: string[];
  link: string;
}

interface CatalogEntry {
  slug: string;
  name: string;
  attributes: Record<string, string>;
  tags?: string[];
  categories?: string[];
  link: string;
  stockStatus?: string;
}

function loadCatalog(): CatalogEntry[] {
  if (!fs.existsSync(CATALOG_PATH)) return [];
  try {
    return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8")) as CatalogEntry[];
  } catch {
    return [];
  }
}

export function findProducts(searchAliases: string[]): MatchedProduct[] {
  if (searchAliases.length === 0) return [];

  const catalog = loadCatalog();
  if (catalog.length === 0) return [];

  const inStock = catalog.filter(
    (e) => !e.stockStatus || e.stockStatus === "instock"
  );
  if (inStock.length === 0) return [];

  const queries = searchAliases
    .map((a) => a.toLowerCase().trim())
    .filter((q) => q.length >= 2);

  const scored: Array<{ entry: CatalogEntry; score: number }> = [];

  for (const entry of inStock) {
    let score = 0;
    const tags = entry.tags || [];
    const categories = entry.categories || [];

    for (const val of Object.values(entry.attributes || {})) {
      const valLower = val.toLowerCase();
      for (const q of queries) {
        if (valLower.includes(q)) {
          score += 10;
          break;
        }
      }
      if (score > 0) break;
    }

    for (const tag of tags) {
      const tagLower = tag.toLowerCase();
      for (const q of queries) {
        if (tagLower.includes(q)) {
          score += 8;
          break;
        }
      }
      if (score >= 18) break;
    }

    const nameLower = entry.name.toLowerCase();
    for (const q of queries) {
      if (nameLower.includes(q)) {
        score += 3;
        break;
      }
    }

    if (score === 0) continue;

    const isFlower = categories.some((c) =>
      FLOWER_CATEGORIES.some((fc) => c.toLowerCase().includes(fc))
    );
    if (isFlower) score += 5;

    scored.push({ entry, score });
  }

  if (scored.length === 0) return [];

  scored.sort((a, b) => b.score - a.score);

  // Deterministic shuffle from the qualified pool to avoid pinning
  const pool = scored.slice(0, Math.min(scored.length, MAX_PRODUCTS * 2));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (pool[i].score * 31 + i * 17) % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, MAX_PRODUCTS).map((s) => ({
    slug: s.entry.slug,
    name: s.entry.name,
    attributes: s.entry.attributes || {},
    tags: s.entry.tags || [],
    categories: s.entry.categories || [],
    link: s.entry.link,
  }));
}
