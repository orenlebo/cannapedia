/**
 * Live Cannabis Magazine Fetcher — Queries the live WordPress REST API
 * for recent articles to supplement the local archive.
 *
 * No authentication required — uses the public wp-json endpoint.
 */

import striptags from "striptags";

const MAGAZINE_API = "https://www.xn--4dbcyzi5a.com/wp-json/wp/v2/posts";
const USER_AGENT = "Cannapedia/1.0 (https://cannapedia.co.il)";
const THREE_YEARS_AGO = new Date(
  Date.now() - 3 * 365.25 * 24 * 60 * 60 * 1000
).toISOString();

interface WpPost {
  id: number;
  date: string;
  title: { rendered: string };
  link: string;
  content: { rendered: string };
  excerpt: { rendered: string };
}

export interface LiveMagazineArticle {
  title: string;
  url: string;
  date: string;
  content: string;
}

function cleanHtml(html: string): string {
  return striptags(html)
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .replace(/&\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function searchLiveMagazine(
  query: string,
  perPage = 5
): Promise<WpPost[]> {
  const params = new URLSearchParams({
    search: query,
    per_page: String(perPage),
    orderby: "date",
    order: "desc",
    after: THREE_YEARS_AGO,
    _fields: "id,date,title,link,content,excerpt",
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${MAGAZINE_API}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.log(`   ⚠️  Live Magazine API returned ${res.status}`);
      return [];
    }

    return (await res.json()) as WpPost[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  Live Magazine fetch error: ${msg}`);
    return [];
  }
}

/**
 * Fetch recent articles from the live Cannabis Magazine WordPress API.
 * Returns formatted context string ready for the Gemini prompt.
 */
export async function fetchLiveMagazineContext(
  aliases: string[],
  conceptName: string
): Promise<{
  context: string;
  sources: { title: string; url: string; date: string }[];
}> {
  const hebrewAliases = aliases.filter((a) => /[\u0590-\u05FF]/.test(a));
  const hebrewTerms = hebrewAliases.length > 0
    ? hebrewAliases.slice(0, 4)
    : [conceptName];

  const seenIds = new Set<number>();
  const articles: LiveMagazineArticle[] = [];

  for (const term of hebrewTerms) {
    const posts = await searchLiveMagazine(term);
    for (const post of posts) {
      if (seenIds.has(post.id)) continue;
      seenIds.add(post.id);

      const title = cleanHtml(post.title.rendered);
      const content = cleanHtml(post.content.rendered);

      if (content.length < 100) continue;

      const words = content.split(/\s+/);
      const trimmed =
        words.length > 2000 ? words.slice(0, 2000).join(" ") + "..." : content;

      articles.push({
        title,
        url: post.link,
        date: post.date.split("T")[0],
        content: trimmed,
      });
    }

    if (articles.length >= 5) break;
  }

  if (articles.length === 0) {
    return { context: "", sources: [] };
  }

  const sources = articles.map((a) => ({
    title: `${a.title} (מגזין קנאביס)`,
    url: a.url,
    date: a.date,
  }));

  const contextParts = articles.map((a, i) => {
    return `--- מקור מגזין קנאביס (Live) ${i + 1} [${a.date}] "${a.title}" ---\nExact URL: ${a.url}\n${a.content}`;
  });

  const header = `\n\nמקורות חיים ממגזין קנאביס (${articles.length} כתבות עדכניות):\n⚠️ כתבות אלו נשלפו בזמן אמת ועשויות להכיל מידע עדכני יותר מהארכיון המקומי.\n\n`;

  return {
    context: header + contextParts.join("\n\n"),
    sources,
  };
}
