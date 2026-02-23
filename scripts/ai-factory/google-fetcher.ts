/**
 * Google Custom Search Fetcher — Retrieves recent web/news results
 * for use as supplementary context alongside RAG and Wikipedia.
 *
 * Requires GOOGLE_CSE_API_KEY and GOOGLE_CSE_ID in .env.local.
 */

import striptags from "striptags";

interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  pagemap?: {
    metatags?: Array<Record<string, string>>;
  };
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
}

export interface GoogleSearchResult {
  title: string;
  url: string;
  snippet: string;
  date: string;
  fullText?: string;
}

const USER_AGENT = "Cannapedia/1.0 (https://cannapedia.co.il)";
const MAX_FULL_TEXT_LENGTH = 3000;

async function searchGoogle(
  query: string,
  apiKey: string,
  cseId: string,
  dateRestrict = "y3"
): Promise<GoogleSearchItem[]> {
  const params = new URLSearchParams({
    key: apiKey,
    cx: cseId,
    q: query,
    num: "5",
    dateRestrict,
  });

  try {
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?${params}`,
      { headers: { "User-Agent": USER_AGENT } }
    );
    if (!res.ok) {
      console.log(`   ⚠️  Google CSE returned ${res.status} for query: ${query}`);
      return [];
    }
    const data = (await res.json()) as GoogleSearchResponse;
    return data.items ?? [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  Google CSE error: ${msg}`);
    return [];
  }
}

async function fetchPageText(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const html = await res.text();
    const text = striptags(html)
      .replace(/\s+/g, " ")
      .trim();

    if (text.length < 100) return null;

    return text.length > MAX_FULL_TEXT_LENGTH
      ? text.slice(0, MAX_FULL_TEXT_LENGTH) + "..."
      : text;
  } catch {
    return null;
  }
}

function extractDate(item: GoogleSearchItem): string {
  const metatags = item.pagemap?.metatags?.[0];
  const candidates = [
    metatags?.["article:published_time"],
    metatags?.["og:updated_time"],
    metatags?.["date"],
  ];

  for (const c of candidates) {
    if (c) {
      const d = new Date(c);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }
  }

  const snippetMatch = item.snippet.match(
    /(\d{1,2})\s+(ב?(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר))\s+(\d{4})/
  );
  if (snippetMatch) {
    return `${snippetMatch[3]}-01-01`;
  }

  return new Date().toISOString().split("T")[0];
}

/**
 * Fetch Google Custom Search results for a concept.
 * Returns formatted context string ready for the Gemini prompt.
 */
export async function fetchGoogleSearchContext(
  aliases: string[],
  conceptName: string
): Promise<{
  context: string;
  sources: { title: string; url: string; date: string }[];
}> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId) {
    return { context: "", sources: [] };
  }

  const hebrewAliases = aliases.filter((a) => /[\u0590-\u05FF]/.test(a));
  const englishAliases = aliases.filter((a) => /[a-zA-Z]/.test(a));

  const queries: string[] = [];

  // Search with each unique Hebrew alias (native terms first, then transliterations)
  const hebrewTerms = hebrewAliases.length > 0 ? hebrewAliases : [conceptName];
  for (const term of hebrewTerms.slice(0, 3)) {
    queries.push(`"${term}" קנאביס`);
  }

  if (englishAliases.length > 0) {
    queries.push(`"${englishAliases[0]}" cannabis`);
  }

  const seenUrls = new Set<string>();
  const results: GoogleSearchResult[] = [];

  for (const query of queries) {
    const items = await searchGoogle(query, apiKey, cseId);
    for (const item of items) {
      if (seenUrls.has(item.link)) continue;
      seenUrls.add(item.link);

      results.push({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        date: extractDate(item),
      });
    }
  }

  if (results.length === 0) {
    return { context: "", sources: [] };
  }

  const topResults = results.slice(0, 5);

  const fetchTargets = topResults.slice(0, 3);
  const fullTexts = await Promise.all(
    fetchTargets.map((r) => fetchPageText(r.url))
  );
  for (let i = 0; i < fetchTargets.length; i++) {
    if (fullTexts[i]) {
      fetchTargets[i].fullText = fullTexts[i]!;
    }
  }

  const sources = topResults.map((r) => ({
    title: r.title,
    url: r.url,
    date: r.date,
  }));

  const contextParts = topResults.map((r, i) => {
    const body = r.fullText || r.snippet;
    return `--- מקור Google Search ${i + 1} [${r.date}] "${r.title}" ---\nExact URL: ${r.url}\n${body}`;
  });

  const header = `\n\nמקורות מחיפוש Google (${topResults.length} תוצאות עדכניות):\n⚠️ מידע מחיפוש אינטרנט הוא בדרך כלל העדכני ביותר, במיוחד לגבי רגולציה, חוקים ונתונים עובדתיים.\n\n`;

  return {
    context: header + contextParts.join("\n\n"),
    sources,
  };
}
