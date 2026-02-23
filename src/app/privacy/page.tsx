import type { Metadata } from "next";
import Link from "next/link";

const SITE_NAME = "קנאפדיה";
const BASE_URL = "https://cannapedia.co.il";

export const metadata: Metadata = {
  title: "מדיניות פרטיות ותנאי שימוש",
  description: "מדיניות הפרטיות ותנאי השימוש של קנאפדיה — אנציקלופדיית הקנאביס הרפואי.",
  openGraph: {
    title: `מדיניות פרטיות ותנאי שימוש | ${SITE_NAME}`,
    description: "מדיניות הפרטיות ותנאי השימוש של קנאפדיה.",
    type: "website",
    locale: "he_IL",
    siteName: SITE_NAME,
    url: `${BASE_URL}/privacy`,
  },
  alternates: {
    canonical: `${BASE_URL}/privacy`,
    languages: { "he-IL": `${BASE_URL}/privacy` },
  },
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-3xl font-bold text-foreground">מדיניות פרטיות ותנאי שימוש</h1>
      <p className="mb-8 text-sm text-muted-foreground">עדכון אחרון: פברואר 2026</p>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">1. כללי</h2>
        <p className="leading-8 text-muted-foreground">
          אתר קנאפדיה (<Link href="/" className="font-medium text-primary hover:underline">cannapedia.co.il</Link>)
          הוא אנציקלופדיה מקוונת המוקדשת למידע רפואי ומדעי בנושא קנאביס רפואי בישראל.
          המדיניות שלהלן מפרטת כיצד אנו אוספים, משתמשים ומגנים על המידע שלכם, וכן את תנאי השימוש באתר.
          השימוש באתר מהווה הסכמה לתנאים אלה.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">2. איסוף מידע</h2>

        <h3 className="mb-2 mt-4 text-lg font-semibold text-foreground">מידע שאתם מוסרים לנו</h3>
        <p className="leading-8 text-muted-foreground">
          בעת שימוש בטופס יצירת הקשר, אנו אוספים את הפרטים הבאים: שם מלא, כתובת
          דוא&quot;ל, מספר טלפון (אופציונלי) ותוכן ההודעה. מידע זה משמש אך ורק לצורך
          מענה לפנייתכם ולא יועבר לצד שלישי כלשהו.
        </p>

        <h3 className="mb-2 mt-4 text-lg font-semibold text-foreground">מידע שנאסף אוטומטית</h3>
        <p className="leading-8 text-muted-foreground">
          האתר משתמש ב-Google Analytics לצורך ניתוח סטטיסטי של דפוסי שימוש באתר.
          שירות זה אוסף מידע אנונימי כגון כתובת IP (באופן מקוצר), סוג הדפדפן,
          מערכת ההפעלה, עמודים שנצפו ומשך הביקור. מידע זה אינו מזהה אתכם אישית.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">3. שימוש במידע</h2>
        <p className="leading-8 text-muted-foreground">המידע שנאסף משמש למטרות הבאות בלבד:</p>
        <ul className="mt-3 list-disc space-y-2 ps-6 text-muted-foreground">
          <li>מענה לפניות שנשלחות דרך טופס יצירת הקשר</li>
          <li>שיפור חוויית המשתמש והתוכן באתר</li>
          <li>ניתוח סטטיסטי אנונימי של דפוסי שימוש</li>
        </ul>
        <p className="mt-3 leading-8 text-muted-foreground">
          איננו מוכרים, משכירים או מעבירים מידע אישי לצדדים שלישיים.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">4. אבטחת מידע</h2>
        <p className="leading-8 text-muted-foreground">
          האתר מוגן באמצעות תעודת SSL (HTTPS) להצפנת התקשורת. אנו נוקטים באמצעי
          אבטחה סבירים להגנה על המידע, אך כמו בכל שירות מקוון, לא ניתן להבטיח
          אבטחה מוחלטת.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">5. עוגיות (Cookies)</h2>
        <p className="leading-8 text-muted-foreground">
          האתר משתמש בעוגיות של Google Analytics לצורך ניתוח סטטיסטי. ניתן לחסום
          עוגיות באמצעות הגדרות הדפדפן, אם כי הדבר עלול להשפיע על חוויית הגלישה.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">6. תנאי שימוש</h2>

        <h3 className="mb-2 mt-4 text-lg font-semibold text-foreground">כתב ויתור רפואי</h3>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm leading-7 text-amber-900">
            <strong>המידע באתר זה מיועד למטרות חינוכיות ואינפורמטיביות בלבד ואינו מהווה
            ייעוץ רפואי, אבחון או המלצה לטיפול.</strong> אין להשתמש במידע המופיע באתר
            כתחליף להתייעצות עם רופא מוסמך. שימוש בקנאביס רפואי בישראל מותר אך
            ורק באמצעות רישיון רפואי בתוקף שהונפק על ידי היחידה לקנאביס רפואי
            במשרד הבריאות.
          </p>
        </div>

        <h3 className="mb-2 mt-4 text-lg font-semibold text-foreground">קניין רוחני</h3>
        <p className="leading-8 text-muted-foreground">
          כל התכנים באתר, לרבות טקסטים, עיצוב ומבנה, מוגנים בזכויות יוצרים.
          אין להעתיק, לשכפל או להפיץ תוכן מהאתר ללא אישור מראש ובכתב.
        </p>

        <h3 className="mb-2 mt-4 text-lg font-semibold text-foreground">קישורים חיצוניים</h3>
        <p className="leading-8 text-muted-foreground">
          האתר עשוי לכלול קישורים לאתרים חיצוניים. איננו אחראים לתוכן, למדיניות
          הפרטיות או לזמינות של אתרים אלה.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">7. שינויים במדיניות</h2>
        <p className="leading-8 text-muted-foreground">
          אנו שומרים לעצמנו את הזכות לעדכן מדיניות זו מעת לעת. שינויים מהותיים
          יפורסמו בעמוד זה עם עדכון תאריך העדכון האחרון.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-2xl font-bold text-foreground">8. יצירת קשר</h2>
        <p className="leading-8 text-muted-foreground">
          לשאלות או בקשות בנוגע למדיניות הפרטיות, ניתן לפנות אלינו דרך{" "}
          <Link href="/contact" className="font-medium text-primary hover:underline">
            טופס יצירת הקשר
          </Link>.
        </p>
      </section>

      <div className="mt-10 text-center">
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
