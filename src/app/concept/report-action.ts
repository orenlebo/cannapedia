"use server";

import { Resend } from "resend";

const CONTACT_EMAIL = process.env.REVIEW_EMAIL || process.env.CONTACT_EMAIL!;
const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// Rate limiting — in-memory store, resets on server restart
// ---------------------------------------------------------------------------

const ipSubmissions = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_HOUR = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipSubmissions.get(ip);

  if (!entry || now > entry.resetAt) {
    ipSubmissions.set(ip, { count: 1, resetAt: now + 3600_000 });
    return false;
  }

  if (entry.count >= MAX_PER_HOUR) return true;

  entry.count++;
  return false;
}

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

export interface ErrorReportResult {
  success: boolean;
  error?: string;
}

export async function submitErrorReport(
  formData: FormData
): Promise<ErrorReportResult> {
  const honeypot = formData.get("website") as string;
  if (honeypot) {
    return { success: true };
  }

  const loadedAt = Number(formData.get("_t") ?? "0");
  if (Date.now() - loadedAt < 3000) {
    return { success: true };
  }

  const ip = (formData.get("_ip") as string) || "unknown";
  if (isRateLimited(ip)) {
    return {
      success: false,
      error: "שלחת יותר מדי דיווחים. נסה שוב מאוחר יותר.",
    };
  }

  const description = (formData.get("description") as string)?.trim();
  const conceptSlug = (formData.get("concept_slug") as string)?.trim();
  const conceptTitle = (formData.get("concept_title") as string)?.trim();
  const reporterEmail = (formData.get("reporter_email") as string)?.trim();

  if (!description) {
    return { success: false, error: "יש לתאר את הטעות." };
  }

  if (description.length > 1000) {
    return { success: false, error: "התיאור ארוך מדי (מקסימום 1000 תווים)." };
  }

  if (reporterEmail && reporterEmail.length > 200) {
    return { success: false, error: "כתובת האימייל ארוכה מדי." };
  }

  if (reporterEmail) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(reporterEmail)) {
      return { success: false, error: "כתובת האימייל אינה תקינה." };
    }
  }

  try {
    const conceptUrl = `https://cannapedia.co.il/concept/${conceptSlug}`;

    await resend.emails.send({
      from: "קנאפדיה <onboarding@resend.dev>",
      to: CONTACT_EMAIL,
      replyTo: reporterEmail || undefined,
      subject: `[קנאפדיה] דיווח על טעות: ${conceptTitle || conceptSlug}`,
      text: [
        `דיווח על טעות בערך: ${conceptTitle}`,
        `Slug: ${conceptSlug}`,
        `URL: ${conceptUrl}`,
        reporterEmail ? `אימייל מדווח: ${reporterEmail}` : null,
        ``,
        `תיאור הטעות:`,
        description,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return { success: true };
  } catch {
    return {
      success: false,
      error: "שגיאה בשליחת הדיווח. נסה שוב מאוחר יותר.",
    };
  }
}
