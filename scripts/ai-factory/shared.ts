/**
 * Shared constants and utilities for all AI factory scripts.
 * Single source of truth for prompts, schema, category mappings, and helpers.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export const MODEL = "gemini-2.5-pro";
export const ALIAS_MODEL = "gemini-2.0-flash";

// ---------------------------------------------------------------------------
// Category slug → Hebrew name map
// ---------------------------------------------------------------------------

export const CATEGORY_HEBREW: Record<string, string> = {
  cannabinoids: "קנבינואידים",
  "medical-indications": "התוויות רפואיות",
  terpenes: "טרפנים",
  "cultivars-and-chemotypes": "זנים וכימוטיפים",
  "routes-of-administration": "דרכי מתן וצורות צריכה",
  "endocannabinoid-system": "המערכת האנדוקנבינואידית",
  "regulation-in-israel": "רגולציה ואסדרה בישראל",
  "research-and-development": "מחקר ופיתוח",
  "side-effects-and-risks": "תופעות לוואי וסיכונים",
  "drug-drug-interactions": "אינטראקציות בין-תרופתיות",
};

// ---------------------------------------------------------------------------
// Alias generation
// ---------------------------------------------------------------------------

export async function generateSearchAliases(
  concept: string,
  genAI: GoogleGenerativeAI
): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({
      model: ALIAS_MODEL,
      generationConfig: { temperature: 0, maxOutputTokens: 300 },
    });

    const prompt = `Return a comma-separated list of the English name and all common Hebrew spellings/transliterations for the cannabis/medical concept: "${concept}".
Include scientific names, common abbreviations, and variant Hebrew spellings.
Output ONLY the comma-separated list, nothing else.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return text
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length >= 2 && a !== concept);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  Alias generation failed: ${msg}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// System instruction
// ---------------------------------------------------------------------------

export const SYSTEM_INSTRUCTION = `אתה חוקר רפואי מומחה ברמה עולמית בתחום הקנאביס הרפואי, עם ניסיון של 20 שנה במחקר קליני.

כללים מחייבים ובלתי ניתנים לערעור:
1. כתוב אך ורק בעברית תקינה, מקצועית ונגישה
2. הסתמך אך ורק על עובדות מדעיות מבוססות ומחקרים peer-reviewed
3. אל תמציא — אם אינך בטוח במידע, אל תכלול אותו
4. היה אובייקטיבי לחלוטין — הצג גם יתרונות וגם סיכונים
5. כל section חייב להיות עצמאי ומקיף (לפחות 3-4 משפטים בפסקה)
6. ה-slug חייב להיות באנגלית, lowercase, kebab-case
7. הקפד על דיוק מדעי — שמות תרכובות, מנגנונים, ומינוח רפואי

חוק ה-"Lex Posterior" (חובה):
כאשר מידע ממקורות שונים סותר זה את זה, המידע החדש יותר (לפי תאריך הפרסום) גובר תמיד.
זה חל במיוחד על:
- רגולציה ישראלית (נהלי יק"ר, חוקים, מינונים מאושרים)
- ממצאי מחקרים קליניים (מחקר חדש מחליף ישן)
- המלצות טיפול וריכוזים

כלל סינתזה קריטי (חובה מוחלטת):
המקורות שסופקו לך מגיעים מתאריכים שונים ומארבעה סוגים: ארכיון מגזין קנאביס, מגזין קנאביס (חי), ויקיפדיה, וחיפוש Google.
חובה עליך להשוות אותם באופן אקטיבי.
אם מקור ישן מציג תיאוריה, מיתוס, או טענה — ומקור חדש יותר מפריך, מעדכן, או משנה את המידע הזה — חובה עליך לשקף את ההתפתחות הזו בטקסט.
לעולם אל תציג מיתוס מיושן כעובדה עדכנית אם מקור חדש יותר ב-context שלך סותר אותו.
הצג תמיד את הקונצנזוס המדעי העדכני ביותר בהתבסס על המקורות החדשים ביותר שסופקו.

כלל עדכניות רגולטורית (חובה קריטית):
כאשר הנושא קשור לרגולציה, חוקים, מדיניות, או סטטוס משפטי — מקורות Google Search, מגזין קנאביס (חי), וויקיפדיה גוברים תמיד על מקורות ישנים מהארכיון.
סדר עדיפות המקורות (מהעדכני ביותר): 1) חיפוש Google 2) מגזין קנאביס (חי) 3) ויקיפדיה 4) ארכיון מקומי.
אם מקורות חדשים יותר מציגים מצב משפטי/רגולטורי שונה ממה שמופיע בארכיון הישן — התייחס למצב במקורות החדשים כמצב הנוכחי, והזכר את המצב הישן רק כרקע היסטורי.
בנוסף, אתה רשאי ומעודד להשלים מידע רגולטורי עדכני מהידע הכללי שלך (training data) אם אין לך מספיק מקורות. סמן עובדות כאלו בבירור, למשל: "נכון לשנת 2024" או "על פי המצב החוקי הנוכחי".

כלל FAQs — טיפול במיתוסים:
כאשר אתה כותב תשובות ל-FAQs, אם קיים מיתוס נפוץ במקורות הישנים יותר — ציין את המיתוס אך הפרך או עדכן אותו מיד בהתבסס על המקורות החדשים ביותר שזמינים לך.

כללי מקורות (Sources) — חובה מוחלטת:
- בשדה "sources" כלול כתבות מארכיון מגזין קנאביס, מגזין קנאביס (חי), ערכי ויקיפדיה, ותוצאות Google שסופקו לך ב-context
- חובה להשתמש ב-URL המדויק שמופיע בשורת "Exact URL:" בכל בלוק מקור. אסור בהחלט לנחש, לבנות, או ליצור URLs בעצמך
- אסור לכלול קישורי Cannabiz או קישורי מסחר אלקטרוני בשדה sources. שדה ה-sources מיועד אך ורק לכתבות רפואיות/מדעיות ולמקורות מידע
- אם לא סופקו מקורות — השאר את שדה "sources" כמערך ריק []
- עדיפות ציטוט: כאשר אתה בוחר מקורות לשדה "sources", תעדיף תמיד את הכתבות הספציפיות והממוקדות ביותר לנושא. אם הזכרת עובדה, מיתוס, או טענה ספציפית בטקסט — הכתבה שממנה שאבת את המידע חייבת להופיע ב-sources. אל תסתפק ברישום כתבות רקע כלליות בלבד. כל טענה ספציפית דורשת את המקור הספציפי שלה

כללי עיצוב טקסט — חובה מוחלטת:
- אסור בהחלט להשתמש בתגיות HTML (כמו <a href>, <b>, <i> וכו'). השתמש אך ורק בפורמט טקסט רגיל
- אל תשלב קישורים בתוך טקסט ה-sections. קישורים מופיעים רק בשדה "sources"

חשוב: אתה כותב עבור אנציקלופדיה רפואית ישראלית בסגנון YMYL (Your Money Your Life).
התוכן צריך לעמוד בסטנדרטים של E-E-A-T (Experience, Expertise, Authority, Trust) של Google.`;

// ---------------------------------------------------------------------------
// Concept JSON schema (sent to Gemini as output format instruction)
// ---------------------------------------------------------------------------

export const CONCEPT_SCHEMA = `{
  "slug": "string — english, lowercase, kebab-case identifier",
  "title": "string — שם המושג בעברית (ואנגלית בסוגריים אם רלוונטי)",
  "subtitle": "string — משפט אחד שמתאר את המושג",
  "category": "string — שם הקטגוריה בעברית",
  "categorySlug": "string — slug הקטגוריה באנגלית",
  "bluf": {
    "points": ["string — 3 נקודות תמציתיות שמסכמות את העיקר"],
    "lastUpdated": "string — תאריך בעברית, למשל: 21 בפברואר 2026"
  },
  "sections": [
    {
      "id": "string — english id for anchor",
      "heading": "string — כותרת H2 בעברית",
      "content": "string — פסקה מקיפה (לפחות 3-4 משפטים). טקסט רגיל בלבד — ללא HTML, ללא קישורים",
      "subsections": [
        {
          "heading": "string — כותרת H3 בעברית",
          "content": "string — פסקה (לפחות 2-3 משפטים). טקסט רגיל בלבד"
        }
      ]
    }
  ],
  "faqs": [
    {
      "question": "string — שאלה נפוצה בעברית",
      "answer": "string — תשובה מקיפה (2-3 משפטים). טקסט רגיל בלבד"
    }
  ],
  "relatedConcepts": [
    {
      "slug": "string — slug של מושג קשור",
      "label": "string — שם המושג הקשור בעברית"
    }
  ],
  "sources": [
    {
      "title": "string — כותרת הכתבה המקורית מהארכיון",
      "url": "string — ה-Exact URL מבלוק המקור. אסור לבנות URLs בעצמך",
      "date": "string — תאריך פרסום ISO"
    }
  ],
  "schema": {
    "medicalName": "string — שם מדעי באנגלית",
    "alternateName": ["string — שמות חלופיים באנגלית ובעברית"],
    "description": "string — תיאור SEO בעברית (עד 160 תווים)",
    "medicineSystem": "WesternConventional",
    "relevantSpecialty": ["string — התמחויות רפואיות באנגלית"]
  }
}`;

// ---------------------------------------------------------------------------
// Combined context builder
// ---------------------------------------------------------------------------

export interface SourceContextParts {
  ragContext: string;
  liveMagazineContext: string;
  wikiContext: string;
  googleContext: string;
}

/**
 * Merge all source contexts in recency order (oldest first, newest last).
 * Gemini reads top-to-bottom, so the most recent info is freshest in context.
 */
export function buildCombinedContext(parts: SourceContextParts): string {
  return [
    parts.ragContext,
    parts.liveMagazineContext,
    parts.wikiContext,
    parts.googleContext,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildPrompt(
  name: string,
  catSlug: string,
  ragData: string
): string {
  let prompt = `כתוב ערך אנציקלופדי מקיף ומדויק על "${name}" עבור אנציקלופדיית קנאביס רפואי בעברית.

הקטגוריה: categorySlug = "${catSlug}"

דרישות מבניות:
1. בדיוק 3 נקודות BLUF (תמצית)
2. לפחות 5 sections (H2), כל section עם פסקת content מקיפה
3. sections מומלצים: "מהו/מהי [X]?", "מנגנון הפעולה", "שימושים רפואיים" (עם subsections), "תופעות לוואי וסיכונים", "סטטוס רגולטורי בישראל"
4. Section "שימושים רפואיים" חייב לכלול לפחות 3 subsections
5. לפחות 3 שאלות נפוצות (FAQs)
6. לפחות 3 מושגים קשורים (relatedConcepts)
7. שדה schema מלא
8. אל תכלול sections על מוצרים מסחריים — רק תוכן מדעי/רפואי`;

  if (ragData) {
    prompt += `\n\nלהלן מקורות ממספר ערוצים: ארכיון מגזין קנאביס, מגזין קנאביס (חי), ויקיפדיה, וחיפוש Google. השתמש בהם כבסיס עובדתי.
זכור: מידע חדש יותר גובר על ישן (Lex Posterior). סדר עדיפות: Google > מגזין קנאביס חי > ויקיפדיה > ארכיון.
כלול בשדה "sources" את הכתבות שהשפיעו על התוכן שיצרת — חובה להשתמש ב-Exact URL שמופיע בכל בלוק מקור.

${ragData}`;
  } else {
    prompt += `\n\nלא נמצאו מקורות מקומיים או חיצוניים. הסתמך על הידע המדעי הגלובלי שלך בלבד.
השאר את שדה "sources" כמערך ריק [].`;
  }

  prompt += `\n\nהחזר JSON בלבד — אובייקט יחיד בפורמט הבא (ללא markdown, ללא הסברים):
${CONCEPT_SCHEMA}`;

  return prompt;
}

// ---------------------------------------------------------------------------
// Slugify
// ---------------------------------------------------------------------------

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05FF]+/g, "-")
    .replace(/^-|-$/g, "");
}
