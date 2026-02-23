import type { Metadata } from "next";
import Link from "next/link";

const SITE_NAME = "קנאפדיה";
const BASE_URL = "https://cannapedia.co.il";

export const metadata: Metadata = {
  title: "אודות",
  description:
    "אודות קנאפדיה — אנציקלופדיית הקנאביס הרפואי המובילה בישראל. מידע מבוסס מחקר, אובייקטיבי ועדכני.",
  openGraph: {
    title: `אודות | ${SITE_NAME}`,
    description:
      "אודות קנאפדיה — אנציקלופדיית הקנאביס הרפואי המובילה בישראל.",
    type: "website",
    locale: "he_IL",
    siteName: SITE_NAME,
    url: `${BASE_URL}/about`,
  },
  alternates: {
    canonical: `${BASE_URL}/about`,
    languages: { "he-IL": `${BASE_URL}/about` },
  },
};

export default function AboutPage() {
  return (
    <article className="prose prose-lg mx-auto max-w-2xl">
      <h1 className="mb-2 text-3xl font-bold text-foreground">אודות קנאפדיה</h1>
      <p className="text-lg leading-8 text-muted-foreground">
        קנאפדיה היא אנציקלופדיה מקוונת המוקדשת לתחום הקנאביס הרפואי בישראל.
        המטרה שלנו היא לרכז מידע מדעי, אובייקטיבי ועדכני ולהנגיש אותו לציבור
        הרחב, לצוותי רפואה ולמטופלים.
      </p>

      <section className="mt-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">המשימה שלנו</h2>
        <p className="leading-8 text-muted-foreground">
          אנו מאמינים שמידע מדויק ונגיש הוא הבסיס לקבלת החלטות מושכלות בתחום
          הבריאות. קנאפדיה נבנתה כדי לגשר על הפער בין המחקר המדעי העדכני לבין
          הציבור הישראלי, תוך שמירה קפדנית על סטנדרטים של דיוק, מהימנות ואובייקטיביות.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">מקורות המידע</h2>
        <p className="leading-8 text-muted-foreground">
          התוכן באנציקלופדיה מבוסס על מקורות מידע מגוונים, ובכלל זה:
        </p>
        <ul className="mt-3 list-disc space-y-2 ps-6 text-muted-foreground">
          <li>מחקרים קליניים ומאמרים שפיטים ממאגרי PubMed ו-ClinicalTrials.gov</li>
          <li>פרסומי משרד הבריאות הישראלי והיחידה לקנאביס רפואי (יק&quot;ר)</li>
          <li>ארכיון מגזין הקנאביס הישראלי — מעל 8,000 כתבות מקצועיות</li>
          <li>ספרות מקצועית עולמית ומדריכים של ארגוני בריאות בינלאומיים</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">כתב ויתור</h2>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm leading-7 text-amber-900">
            <strong>המידע באתר זה מיועד למטרות חינוכיות ואינפורמטיביות בלבד
            ואינו מהווה ייעוץ רפואי, אבחון או המלצה לטיפול.</strong> אין
            להשתמש במידע המופיע באתר כתחליף להתייעצות עם רופא מוסמך או איש
            מקצוע בתחום הבריאות. שימוש בקנאביס רפואי בישראל מותר אך ורק
            באמצעות רישיון רפואי בתוקף שהונפק על ידי היחידה לקנאביס רפואי
            במשרד הבריאות.
          </p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">יצירת קשר</h2>
        <p className="leading-8 text-muted-foreground">
          לשאלות, הערות, דיווח על אי-דיוקים או הצעות לשיפור —
          מוזמנים לפנות אלינו דרך טופס יצירת הקשר.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link
          href="/contact"
          className="inline-flex rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.97]"
        >
          יצירת קשר
        </Link>
        <Link
          href="/"
          className="inline-flex rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:scale-[0.97]"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </article>
  );
}
