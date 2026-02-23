/**
 * Approve Concept — Marks a pending concept as verified for publishing.
 *
 * Usage:
 *   npx tsx scripts/ai-factory/approve-concept.ts <slug>
 *   npx tsx scripts/ai-factory/approve-concept.ts --list-pending
 *   npx tsx scripts/ai-factory/approve-concept.ts --all-pending
 */

import * as fs from "node:fs";
import * as path from "node:path";

const CONTENT_DIR = path.join(__dirname, "../../src/data/content");

interface ConceptJson {
  slug: string;
  title: string;
  verificationStatus?: string;
  needsHumanReview?: boolean;
  confidenceScore?: number;
  unverifiedClaims?: string[];
  [key: string]: unknown;
}

function readConcept(slug: string): ConceptJson | null {
  const filePath = path.join(CONTENT_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ConceptJson;
}

function saveConcept(slug: string, data: ConceptJson): void {
  const filePath = path.join(CONTENT_DIR, `${slug}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function findPendingConcepts(): ConceptJson[] {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const pending: ConceptJson[] = [];

  for (const file of files) {
    const data = JSON.parse(
      fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8")
    ) as ConceptJson;

    if (data.verificationStatus === "pending") {
      data.slug = data.slug || file.replace(".json", "");
      pending.push(data);
    }
  }

  return pending;
}

function approveConcept(slug: string): boolean {
  const concept = readConcept(slug);
  if (!concept) {
    console.error(`❌  Concept not found: ${slug}`);
    return false;
  }

  if (concept.verificationStatus === "verified") {
    console.log(`ℹ️  "${concept.title || slug}" is already verified.`);
    return true;
  }

  concept.verificationStatus = "verified";
  concept.needsHumanReview = false;

  saveConcept(slug, concept);
  console.log(`✅  Approved: "${concept.title || slug}" (${slug})`);
  console.log(`   Previous confidence: ${concept.confidenceScore ? Math.round(concept.confidenceScore * 100) + "%" : "N/A"}`);

  if (concept.unverifiedClaims && concept.unverifiedClaims.length > 0) {
    console.log(`   ⚠️  Note: ${concept.unverifiedClaims.length} claims were flagged — review them before deploying:`);
    for (const claim of concept.unverifiedClaims) {
      console.log(`      • ${claim}`);
    }
  }

  return true;
}

function main() {
  const args = process.argv.slice(2);

  if (args.includes("--list-pending")) {
    const pending = findPendingConcepts();
    if (pending.length === 0) {
      console.log("✅  No pending concepts found — all verified!");
      return;
    }

    console.log(`\n📋  ${pending.length} pending concepts:\n`);
    for (const c of pending) {
      const score = c.confidenceScore ? Math.round(c.confidenceScore * 100) + "%" : "N/A";
      const claims = c.unverifiedClaims?.length ?? 0;
      console.log(
        `   ${(c.slug || "unknown").padEnd(40)} score: ${score.padEnd(5)} claims: ${claims}  "${c.title || ""}"`
      );
    }
    console.log(`\n   To approve: npx tsx scripts/ai-factory/approve-concept.ts <slug>`);
    console.log(`   To approve all: npx tsx scripts/ai-factory/approve-concept.ts --all-pending\n`);
    return;
  }

  if (args.includes("--all-pending")) {
    const pending = findPendingConcepts();
    if (pending.length === 0) {
      console.log("✅  No pending concepts found — all verified!");
      return;
    }

    console.log(`\n🔄  Approving ${pending.length} pending concepts...\n`);
    let approved = 0;
    for (const c of pending) {
      if (approveConcept(c.slug)) approved++;
    }
    console.log(`\n✅  Approved ${approved}/${pending.length} concepts.\n`);
    return;
  }

  const slug = args[0];
  if (!slug) {
    console.error("❌  Usage:");
    console.error("   npx tsx scripts/ai-factory/approve-concept.ts <slug>");
    console.error("   npx tsx scripts/ai-factory/approve-concept.ts --list-pending");
    console.error("   npx tsx scripts/ai-factory/approve-concept.ts --all-pending");
    process.exit(1);
  }

  approveConcept(slug);
}

main();
