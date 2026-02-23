/**
 * Taxonomy Planner — asks Gemini to generate the master category/concept
 * structure for Cannapedia. Saves output to taxonomy-draft.json.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/1-plan-taxonomy.ts
 *
 * Requires GEMINI_API_KEY in .env.local
 */

import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "node:fs";
import * as path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY || API_KEY === "your_key_here") {
  console.error(
    "❌  Missing GEMINI_API_KEY. Set it in .env.local and try again."
  );
  process.exit(1);
}

const MODEL = "gemini-2.5-pro";
const OUTPUT_PATH = path.join(__dirname, "taxonomy-draft.json");

interface TaxonomyConcept {
  name: string;
  slug: string;
  medicalName: string;
}

interface TaxonomyCategory {
  name: string;
  slug: string;
  description: string;
  concepts: TaxonomyConcept[];
}

const SYSTEM_INSTRUCTION = `אתה משמש כמנהל רפואי ראשי (Chief Medical Officer) של אנציקלופדיה רפואית-מדעית מקיפה בנושא קנאביס רפואי בישראל.

משימתך: לתכנן את מבנה הטקסונומיה (קטגוריות ומושגים) של האנציקלופדיה.

כללים מחייבים:
- כל התוכן בעברית תקינה ומקצועית
- הסתמך אך ורק על עובדות מדעיות מבוססות ומחקרים peer-reviewed
- אל תמציא מושגים — כל מושג חייב להיות מוכר בספרות המדעית
- slug חייב להיות באנגלית, lowercase, עם מקפים (kebab-case)
- medicalName חייב להיות השם המדעי/רפואי באנגלית`;

const PROMPT = `צור מבנה טקסונומיה עבור אנציקלופדיית קנאביס רפואי.

דרישות:
1. בדיוק 10 קטגוריות מרכזיות שמכסות את כל מרחב הידע של קנאביס רפואי
2. עבור כל קטגוריה — בדיוק 5 מושגי ליבה (הכי חיוניים וחשובים)
3. כל קטגוריה צריכה לכלול: name (עברית), slug (אנגלית), description (עברית, 1-2 משפטים)
4. כל מושג צריך לכלול: name (עברית), slug (אנגלית), medicalName (אנגלית מדעית)

הקטגוריות צריכות לכסות לפחות: קנבינואידים, טרפנים, מצבים רפואיים, דרכי מתן, זנים, מערכות ביולוגיות, רגולציה, מחקר, תופעות לוואי, ואינטראקציות.

החזר JSON בלבד — מערך של אובייקטים בפורמט הבא (ללא markdown, ללא הסברים):
[
  {
    "name": "שם הקטגוריה",
    "slug": "category-slug",
    "description": "תיאור קצר",
    "concepts": [
      { "name": "שם המושג", "slug": "concept-slug", "medicalName": "Scientific Name" }
    ]
  }
]`;

async function main() {
  console.log("🧬  Cannapedia Taxonomy Planner");
  console.log(`📡  Model: ${MODEL}`);
  console.log("⏳  Generating taxonomy with Gemini...\n");

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
    },
  });

  const result = await model.generateContent(PROMPT);
  const text = result.response.text();

  let taxonomy: TaxonomyCategory[];
  try {
    taxonomy = JSON.parse(text);
  } catch {
    console.error("❌  Failed to parse Gemini response as JSON.");
    console.error("Raw response:\n", text);
    process.exit(1);
  }

  if (!Array.isArray(taxonomy) || taxonomy.length === 0) {
    console.error("❌  Response is not a valid array.");
    process.exit(1);
  }

  const totalConcepts = taxonomy.reduce(
    (sum, cat) => sum + cat.concepts.length,
    0
  );
  console.log(`✅  Received ${taxonomy.length} categories, ${totalConcepts} concepts total\n`);

  for (const cat of taxonomy) {
    console.log(`  📂 ${cat.name} (${cat.slug})`);
    for (const concept of cat.concepts) {
      console.log(`     • ${concept.name} → ${concept.medicalName}`);
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(taxonomy, null, 2), "utf-8");
  console.log(`\n💾  Saved to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("❌  Fatal error:", err.message ?? err);
  process.exit(1);
});
