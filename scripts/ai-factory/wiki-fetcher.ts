/**
 * Wikipedia Fetcher — Retrieves relevant Wikipedia articles in Hebrew and English
 * for use as supplementary RAG context alongside the local archive.
 *
 * Uses the free MediaWiki API (no auth required).
 */

interface WikiSearchResult {
  title: string;
  snippet: string;
  pageid: number;
}

interface WikiArticle {
  title: string;
  lang: "he" | "en";
  url: string;
  content: string;
  lastModified: string;
}

const USER_AGENT = "Cannapedia/1.0 (https://cannapedia.co.il)";

async function searchWiki(
  query: string,
  lang: "he" | "en",
  limit = 3
): Promise<WikiSearchResult[]> {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    srnamespace: "0",
    format: "json",
    origin: "*",
  });

  try {
    const res = await fetch(`${base}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.query?.search ?? [];
  } catch {
    return [];
  }
}

async function getArticleContent(
  title: string,
  lang: "he" | "en"
): Promise<WikiArticle | null> {
  const base = `https://${lang}.wikipedia.org/w/api.php`;
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "extracts|info|revisions",
    exintro: "false",
    explaintext: "true",
    exsectionformat: "plain",
    inprop: "url",
    rvprop: "timestamp",
    format: "json",
    origin: "*",
  });

  try {
    const res = await fetch(`${base}?${params}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as Record<string, unknown>;
    if ((page as { missing?: boolean }).missing) return null;

    const extract = (page.extract as string) || "";
    const revisions = page.revisions as { timestamp: string }[] | undefined;
    const lastMod = revisions?.[0]?.timestamp ?? new Date().toISOString();

    // Trim to ~3000 words to avoid bloating the context
    const words = extract.split(/\s+/);
    const trimmed = words.length > 3000 ? words.slice(0, 3000).join(" ") + "..." : extract;

    return {
      title: page.title as string,
      lang,
      url: (page.fullurl as string) || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      content: trimmed,
      lastModified: lastMod,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch Wikipedia articles for a concept using its aliases.
 * Searches both Hebrew and English Wikipedia.
 * Returns formatted context string ready for the Gemini prompt.
 */
export async function fetchWikipediaContext(
  aliases: string[],
  conceptName: string
): Promise<{ context: string; sources: { title: string; url: string; date: string }[] }> {
  const articles: WikiArticle[] = [];
  const seenTitles = new Set<string>();

  // Search Hebrew Wikipedia first (primary language)
  const hebrewAliases = aliases.filter((a) => /[\u0590-\u05FF]/.test(a));
  const englishAliases = aliases.filter((a) => /[a-zA-Z]/.test(a));

  // Hebrew searches
  for (const alias of [conceptName, ...hebrewAliases].slice(0, 3)) {
    const results = await searchWiki(alias, "he", 2);
    for (const r of results) {
      if (seenTitles.has(`he:${r.title}`)) continue;
      seenTitles.add(`he:${r.title}`);
      const article = await getArticleContent(r.title, "he");
      if (article && article.content.length > 200) {
        articles.push(article);
      }
    }
    if (articles.length >= 3) break;
  }

  // English searches
  for (const alias of englishAliases.slice(0, 2)) {
    const results = await searchWiki(alias + " cannabis", "en", 2);
    for (const r of results) {
      if (seenTitles.has(`en:${r.title}`)) continue;
      seenTitles.add(`en:${r.title}`);
      const article = await getArticleContent(r.title, "en");
      if (article && article.content.length > 200) {
        articles.push(article);
      }
    }
    if (articles.length >= 5) break;
  }

  if (articles.length === 0) {
    return { context: "", sources: [] };
  }

  const sources = articles.map((a) => ({
    title: `${a.title} (Wikipedia ${a.lang === "he" ? "עברית" : "English"})`,
    url: a.url,
    date: a.lastModified.split("T")[0],
  }));

  const contextParts = articles.map((a, i) => {
    const langLabel = a.lang === "he" ? "ויקיפדיה עברית" : "Wikipedia English";
    const dateStr = new Date(a.lastModified).toLocaleDateString("he-IL");
    return `--- מקור ויקיפדיה ${i + 1} [${langLabel}, עודכן ${dateStr}] "${a.title}" ---\nExact URL: ${a.url}\n${a.content}`;
  });

  const header = `\n\nמקורות מויקיפדיה (${articles.length} ערכים רלוונטיים, מידע עדכני):\n⚠️ מידע מויקיפדיה הוא בדרך כלל עדכני יותר ממקורות הארכיון המקומי, במיוחד לגבי רגולציה, חוקים ונתונים עובדתיים.\n\n`;

  return {
    context: header + contextParts.join("\n\n"),
    sources,
  };
}
