/**
 * Post-Generation Fact Checker — Uses Gemini Flash to verify claims
 * extracted from generated concept JSON against source materials.
 *
 * Returns a confidence score, unverified claims, and risk level.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { ALIAS_MODEL } from "./shared";

export interface FactCheckClaim {
  claim: string;
  verified: boolean;
  source: string;
  note: string;
}

export interface FactCheckResult {
  claims: FactCheckClaim[];
  confidenceScore: number;
  unverifiedClaims: string[];
  riskLevel: "high" | "medium" | "low";
}

const HIGH_RISK_KEYWORDS = [
  "רגולציה",
  "משפט",
  "חוק",
  "רפואי",
  "אסדרה",
  "קנס",
  "עונש",
  "משרד הבריאות",
  "יק\"ר",
  "רישיון",
  "regulation",
  "law",
  "legal",
  "medical",
  "penalty",
  "fine",
];

const MEDIUM_RISK_KEYWORDS = [
  "מחקר",
  "מדעי",
  "ניסוי קליני",
  "research",
  "clinical",
  "study",
  "היסטוריה",
];

function classifyRisk(
  categorySlug: string,
  conceptJson: string
): "high" | "medium" | "low" {
  const highRiskCategories = [
    "regulation-in-israel",
    "medical-indications",
    "side-effects-and-risks",
    "drug-drug-interactions",
  ];

  if (highRiskCategories.includes(categorySlug)) return "high";

  const lowerContent = conceptJson.toLowerCase();
  if (HIGH_RISK_KEYWORDS.some((k) => lowerContent.includes(k.toLowerCase()))) {
    return "high";
  }
  if (
    MEDIUM_RISK_KEYWORDS.some((k) => lowerContent.includes(k.toLowerCase()))
  ) {
    return "medium";
  }

  return "low";
}

const FACT_CHECK_PROMPT = `אתה בודק עובדות (Fact Checker) עבור אנציקלופדיית קנאביס רפואי בעברית.
קיבלת ערך אנציקלופדי שנוצר אוטומטית, יחד עם כל חומרי המקור שסופקו ליוצר.

משימתך:
1. חלץ כל טענה עובדתית ספציפית מהערך (תאריכים, מספרים, חוקים, קנסות, אחוזים, שמות תרכובות, מנגנונים)
2. לכל טענה, בדוק האם היא נתמכת על ידי לפחות מקור אחד
3. לטענות רגולטוריות ישראליות — בדוק שהמידע תואם את המקור ה-חדש ביותר
4. סמן כל טענה שסותרת מקור חדש יותר או שאין לה תמיכה במקורות

החזר JSON בלבד (ללא markdown, ללא הסברים) בפורמט:
{
  "claims": [
    { "claim": "תיאור הטענה", "verified": true/false, "source": "שם המקור התומך או 'אין מקור'", "note": "הערה קצרה" }
  ],
  "confidenceScore": 0.0-1.0,
  "unverifiedClaims": ["רשימת טענות לא מאומתות בעברית"]
}

כללים:
- confidenceScore: 1.0 = כל הטענות מאומתות, 0.5 = חצי מאומתות, 0.0 = אף טענה לא מאומתת
- אם אין טענות עובדתיות ספציפיות (למשל ערך תיאורי כללי), החזר confidenceScore של 0.9
- לטענות רגולטוריות: המקור ה-חדש ביותר (לפי תאריך) גובר תמיד
- בדוק במיוחד: סכומי קנסות, תאריכי חוקים, ערכי ריכוזים, מינונים`;

/**
 * Run the fact-checker on generated concept content.
 * Makes a second Gemini call using Flash for speed/cost.
 */
export async function factCheck(
  conceptJson: Record<string, unknown>,
  sourceContext: string,
  genAI: GoogleGenerativeAI
): Promise<FactCheckResult> {
  const categorySlug = (conceptJson.categorySlug as string) || "";
  const conceptStr = JSON.stringify(conceptJson, null, 2);
  const riskLevel = classifyRisk(categorySlug, conceptStr);

  const model = genAI.getGenerativeModel({
    model: ALIAS_MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      maxOutputTokens: 4096,
    },
  });

  const prompt = `${FACT_CHECK_PROMPT}

=== הערך שנוצר ===
${conceptStr}

=== חומרי מקור ===
${sourceContext || "(לא סופקו מקורות)"}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = JSON.parse(text) as {
      claims?: FactCheckClaim[];
      confidenceScore?: number;
      unverifiedClaims?: string[];
    };

    return {
      claims: parsed.claims ?? [],
      confidenceScore: Math.max(
        0,
        Math.min(1, parsed.confidenceScore ?? 0.5)
      ),
      unverifiedClaims: parsed.unverifiedClaims ?? [],
      riskLevel,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  Fact-check failed: ${msg}`);

    return {
      claims: [],
      confidenceScore: 0.5,
      unverifiedClaims: ["Fact-check process failed — manual review required"],
      riskLevel: "high",
    };
  }
}
