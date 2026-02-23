import Link from "next/link";

const footerLinks = [
  { href: "/categories", label: "קטגוריות" },
  { href: "/search", label: "חיפוש" },
  { href: "/about", label: "אודות" },
];

const categoryLinks = [
  { href: "/category/cannabinoids", label: "קנבינואידים" },
  { href: "/category/medical-indications", label: "התוויות רפואיות" },
  { href: "/category/terpenes", label: "טרפנים" },
  { href: "/category/regulation-in-israel", label: "רגולציה בישראל" },
  { href: "/category/endocannabinoid-system", label: "מערכת אנדוקנבינואידית" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-border bg-card/50 pb-24 md:pb-8">
      <div className="mx-auto max-w-3xl px-4 pt-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          <div>
            <Link href="/" className="text-xl font-bold text-primary" title="קנאפדיה — דף הבית">
              קנאפדיה
            </Link>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              אנציקלופדיית הקנאביס הרפואי המובילה בישראל.
              מידע מבוסס מחקר, אובייקטיבי ועדכני.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">ניווט</h3>
            <ul className="flex flex-col gap-2">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    title={link.label}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-foreground">קטגוריות מובילות</h3>
            <ul className="flex flex-col gap-2">
              {categoryLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    title={link.label}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6">
          <p className="text-center text-xs leading-5 text-muted-foreground">
            © {year} קנאפדיה. המידע באתר מיועד למטרות חינוכיות בלבד ואינו מהווה ייעוץ רפואי.
            יש להתייעץ עם רופא מוסמך לפני שימוש בקנאביס רפואי.
          </p>
        </div>
      </div>
    </footer>
  );
}
