/**
 * Review Notifier — Sends email via Resend when a concept is flagged
 * for human review due to low confidence or high risk classification.
 *
 * Uses the same Resend setup as the contact form.
 */

import { Resend } from "resend";

interface ReviewNotification {
  conceptName: string;
  slug: string;
  categorySlug: string;
  confidenceScore: number;
  riskLevel: string;
  unverifiedClaims: string[];
  sourcesConsulted: string[];
}

/**
 * Send an email notification for a concept that requires human review.
 */
export async function notifyReview(
  data: ReviewNotification
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.REVIEW_EMAIL || process.env.CONTACT_EMAIL;

  if (!apiKey || !toEmail) {
    console.log("   ⚠️  Missing RESEND_API_KEY or REVIEW_EMAIL — skipping notification");
    return false;
  }

  const resend = new Resend(apiKey);
  const scorePct = Math.round(data.confidenceScore * 100);

  const claimsList = data.unverifiedClaims.length > 0
    ? data.unverifiedClaims.map((c, i) => `  ${i + 1}. ${c}`).join("\n")
    : "  (אין טענות ספציפיות שנמצאו בעייתיות)";

  const sourcesList = data.sourcesConsulted.length > 0
    ? data.sourcesConsulted.map((s) => `  • ${s}`).join("\n")
    : "  (לא נעשה שימוש במקורות)";

  const jsonPath = `src/data/content/${data.slug}.json`;

  const body = `
ערך חדש דורש אימות ידני לפני פרסום:

שם: ${data.conceptName}
Slug: ${data.slug}
קטגוריה: ${data.categorySlug}
ציון ביטחון: ${scorePct}%
רמת סיכון: ${data.riskLevel}

טענות לא מאומתות:
${claimsList}

מקורות שנבדקו:
${sourcesList}

קובץ JSON: ${jsonPath}

לאישור:
  npx tsx scripts/ai-factory/approve-concept.ts ${data.slug}

הערך לא יפורסם עד לאישור ידני.
  `.trim();

  try {
    await resend.emails.send({
      from: "קנאפדיה <onboarding@resend.dev>",
      to: toEmail,
      subject: `[קנאפדיה] דורש אימות: ${data.conceptName} (ציון: ${scorePct}%)`,
      text: body,
    });

    console.log(`   📧  Review notification sent to ${toEmail}`);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`   ⚠️  Failed to send review email: ${msg}`);
    return false;
  }
}
