"use server";

import { Resend } from "resend";

const CONTACT_EMAIL = process.env.CONTACT_EMAIL!;
const resend = new Resend(process.env.RESEND_API_KEY);

// ---------------------------------------------------------------------------
// Rate limiting — in-memory store, resets on server restart
// ---------------------------------------------------------------------------

const ipSubmissions = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_HOUR = 3;

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

export interface ContactResult {
  success: boolean;
  error?: string;
}

export async function submitContact(
  formData: FormData
): Promise<ContactResult> {
  // Honeypot — if this hidden field has a value, it's a bot
  const honeypot = formData.get("website") as string;
  if (honeypot) {
    // Silently succeed to not tip off the bot
    return { success: true };
  }

  // Time-based check — reject if submitted faster than 3 seconds
  const loadedAt = Number(formData.get("_t") ?? "0");
  if (Date.now() - loadedAt < 3000) {
    return { success: true }; // silent fake success
  }

  // Rate limiting by IP (fallback to generic key in dev)
  const ip =
    (formData.get("_ip") as string) || "unknown";
  if (isRateLimited(ip)) {
    return { success: false, error: "שלחת יותר מדי הודעות. נסה שוב מאוחר יותר." };
  }

  // Extract and validate fields
  const name = (formData.get("name") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim();
  const email = (formData.get("email") as string)?.trim();
  const message = (formData.get("message") as string)?.trim();

  if (!name || !email || !message) {
    return { success: false, error: "יש למלא את כל השדות המסומנים בכוכבית." };
  }

  if (name.length > 100 || email.length > 200 || message.length > 5000) {
    return { success: false, error: "אחד השדות ארוך מדי." };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: "כתובת האימייל אינה תקינה." };
  }

  // Send email via Resend
  try {
    await resend.emails.send({
      from: "קנאפדיה <onboarding@resend.dev>",
      to: CONTACT_EMAIL,
      subject: `פנייה חדשה מקנאפדיה: ${name}`,
      replyTo: email,
      text: [
        `שם: ${name}`,
        phone ? `טלפון: ${phone}` : null,
        `אימייל: ${email}`,
        ``,
        `הודעה:`,
        message,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return { success: true };
  } catch {
    return { success: false, error: "שגיאה בשליחת ההודעה. נסה שוב מאוחר יותר." };
  }
}
