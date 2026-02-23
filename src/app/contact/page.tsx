import type { Metadata } from "next";
import { headers } from "next/headers";
import ContactForm from "./ContactForm";

const SITE_NAME = "קנאפדיה";
const BASE_URL = "https://cannapedia.co.il";

export const metadata: Metadata = {
  title: "יצירת קשר",
  description: "צרו קשר עם צוות קנאפדיה — שאלות, הערות, דיווח על אי-דיוקים או הצעות לשיפור.",
  openGraph: {
    title: `יצירת קשר | ${SITE_NAME}`,
    description: "צרו קשר עם צוות קנאפדיה",
    type: "website",
    locale: "he_IL",
    siteName: SITE_NAME,
    url: `${BASE_URL}/contact`,
  },
  alternates: {
    canonical: `${BASE_URL}/contact`,
    languages: { "he-IL": `${BASE_URL}/contact` },
  },
  robots: { index: true, follow: true },
};

export default async function ContactPage() {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-foreground">יצירת קשר</h1>
        <p className="text-base leading-7 text-muted-foreground">
          שאלות, הערות, דיווח על אי-דיוקים או הצעות לשיפור? נשמח לשמוע מכם.
        </p>
      </header>

      <ContactForm clientIp={ip} />
    </div>
  );
}
