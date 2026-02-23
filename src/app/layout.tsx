import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import TopHeader from "@/components/TopHeader";
import BottomNav from "@/components/BottomNav";
import "./globals.css";

const rubik = Rubik({
  subsets: ["latin", "hebrew"],
  variable: "--font-rubik",
  display: "swap",
});

export const metadata: Metadata = {
  title: "קנאפדיה - מאגר הידע המוביל לקנאביס רפואי",
  description:
    "מאגר הידע המקיף והמהימן ביותר בישראל בנושא קנאביס רפואי. מידע מבוסס מחקר על זנים, קנבינואידים, מינון ושימושים רפואיים.",
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
