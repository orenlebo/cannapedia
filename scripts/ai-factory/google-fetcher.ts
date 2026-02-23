/**
 * Google Search Fetcher — Uses Gemini's built-in Google Search grounding
 * to retrieve fresh web information for concept verification.
 *
 * Uses the existing GEMINI_API_KEY — no additional API keys or setup needed.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GoogleSearchSource {
  title: string;
  url: string;
  date: string;
}

const SEARCH_MODEL = "gemini-2.0-flash";

/**
 * Fetch fresh web context for a concept using Gemini's Google Search grounding.
 * Returns a formatted context string and extracted sources.
 */
export async function fetchGoogleSearchContext(
  aliases: string[],
  conceptName: string
): Promise<{
  context: string;
  sources: GoogleSearchSource[];
}> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { context: "", sources: [] };
  }

  const hebrewAliases = aliases.filter((a) => /[\u0590-\u05FF]/.test(a));
  const primaryHebrew =
    hebrewAliases[0] || conceptName;
  const secondaryTerms = hebrewAliases.slice(1, 3).join(", ");

  const searchQuery = secondaryTerms
    ? `מצא מידע עדכני (מ-2020 ואילך) על "${primaryHebrew}" (${secondaryTerms}) בהקשר של קנאביס בישראל. כלול: מצב חוקי/רגולטורי נוכחי, עובדות מפתח, שינויים אחרונים, וסטטיסטיקות. התמקד במידע ישראלי ומדעי.`
    : `מצא מידע עדכני (מ-2020 ואילך) על "${primaryHebrew}" בהקשר של קנאביס רפואי. כלול: ממצאי מחקר עדכניים, מנגנון פעולה, שימושים רפואיים, ומצב רגולטורי בישראל.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: SEARCH_MODEL,
      tools: [{ googleSearch: {} } as any],
    });

    const result = await model.generateContent(searchQuery);
    const text = result.response.text();

    if (!text || text.length < 50) {
      return { context: "", sources: [] };
    }

    // Extract grounding sources
    const sources: GoogleSearchSource[] = [];
    const meta = (result.response.candidates?.[0] as any)?.groundingMetadata;
    if (meta?.groundingChunks) {
      for (const chunk of meta.groundingChunks) {
        if (chunk.web?.uri && chunk.web?.title) {
          sources.push({
            title: chunk.web.title,
            url: chunk.web.uri,
            date: new Date().toISOString().split("T")[0],
          });
        }
      }
    }

    const header = `\n\nמקורות מחיפוש Google (${sources.length} מקורות, מידע עדכני):
⚠️ מידע זה נשלף בזמן אמת מהאינטרנט באמצעות Google Search ומשקף את המצב העדכני ביותר.\n\n`;

    const contextBlock = `--- מקור Google Search [${new Date().toISOString().split("T")[0]}] ---\n${text}`;

    return {
      context: header + contextBlock,
      sources,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  Google Search grounding error: ${msg}`);
    return { context: "", sources: [] };
  }
}
