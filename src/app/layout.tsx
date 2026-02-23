import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import TopHeader from "@/components/TopHeader";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  variable: "--font-rubik",
  display: "swap",
});

const SITE_NAME = "קנאפדיה";
const BASE_URL = "https://cannapedia.co.il";
const SITE_DESCRIPTION =
  "מאגר הידע המקיף והמהימן ביותר בישראל בנושא קנאביס רפואי. מידע מבוסס מחקר על זנים, קנבינואידים, מינון ושימושים רפואיים.";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#16a34a",
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: `${SITE_NAME} - אנציקלופדיית הקנאביס הרפואי של ישראל`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME, url: BASE_URL }],
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: SITE_NAME,
    title: `${SITE_NAME} - אנציקלופדיית הקנאביס הרפואי של ישראל`,
    description: SITE_DESCRIPTION,
    url: BASE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} - אנציקלופדיית הקנאביס הרפואי של ישראל`,
    description: SITE_DESCRIPTION,
  },
  alternates: {
    canonical: BASE_URL,
    languages: { "he-IL": BASE_URL },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${rubik.variable} font-sans antialiased`}>
        <TopHeader />
        <main className="mx-auto min-h-screen max-w-3xl px-4 pb-20 pt-4">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
