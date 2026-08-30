"use client";

import { Link } from "@/i18n/routing";
import UserNav from "./UserNav";
import LocaleSwitcher from "./LocaleSwitcher";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Package } from "lucide-react";
import { useTranslations } from "next-intl";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname?.includes(href) && href !== "/";
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      /*
        `py-2 -my-2`: baglantinin GORUNUSU ayni kaliyor, DOKUNMA ALANI buyuyor.
        Olculdu (2026-08-31): bu baglantilar 47x12 ve 33x12 px'di -- WCAG 2.2
        2.5.8'in astigi 24x24 esiginin yarisi. Kucuk hedef masaustunde
        "isabet etmedim" demek, telefonda "yanlis sayfaya gittim" demek.
      */
      className={` relative inline-block py-2 -my-2 id-eyebrow transition-all duration-200 ${
        active ? "text-orange-600" : "text-gray-500 hover:text-gray-900"
      }`}
    >
      {children}
      {active && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-orange-500" />
      )}
    </Link>
  );
}

export default function Header() {
  const pathname = usePathname();
  const tCommon = useTranslations("Common");
  const { data: session } = useSession();
  const role = session?.user?.role;
  const hideGuestBookingNav = role === "PARTNER" || role === "ADMIN";
  const logoHref = role === "PARTNER" ? "/partner" : role === "ADMIN" ? "/admin" : "/";
  /**
   * Site geneli navigasyon metinleri — `navLabel`/`secondaryLabel`/`logoLabel`
   * dahil. Bunlar ERİŞİLEBİLİRLİK etiketleri: sabit yazıldıklarında 12 dilde
   * ekran okuyucu İngilizce anons ediyordu (P1-24). `blog` çevrilmiyor, uluslararası.
   */
  const navCopy = {
    explore: tCommon("navExplore"),
    becomePartner: tCommon("navBecomePartner"),
    insurance: tCommon("navInsurance"),
    blog: "Blog",
    navLabel: tCommon("navMainLabel"),
    secondaryLabel: tCommon("navSecondaryLabel"),
    logoLabel: tCommon("navLogoLabel"),
  };

  if (pathname?.includes("/login")) return null;

  return (
    <header className="sticky top-0 w-full z-50 glass border-b border-gray-100/80 px-4 sm:px-6 py-3 flex justify-between items-center transition-all duration-300">
      {/* Logo */}
      <Link
        href={logoHref}
        aria-label={navCopy.logoLabel}
        className="flex items-center gap-2.5 group"
      >
        <div className="w-8 h-8 bg-brand-gradient rounded-xl flex items-center justify-center shadow-brand-sm group-hover:shadow-brand-md transition-all duration-200 group-active:scale-95">
          <Package size={16} className="text-white" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <span className="text-lg font-black tracking-tight text-gray-900 group-hover:text-orange-600 transition-colors duration-200">
          BagajPark
        </span>
        {process.env.NEXT_PUBLIC_BETA_BADGE === "true" && (
          <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-[9px] id-eyebrow text-orange-700">
            Beta
          </span>
        )}
      </Link>

      {/* Nav + Actions */}
      <div className="flex items-center gap-2 sm:gap-5 min-w-0">
        {!hideGuestBookingNav && (
          <nav aria-label={navCopy.navLabel} className="hidden md:flex items-center gap-5">
            <NavLink href="/search">{navCopy.explore}</NavLink>
            <NavLink href="/insurance">{navCopy.insurance}</NavLink>
            {/* 2026-08-21: /register (rolsuz) -> /partners — footer'daki "Esnafımız Olun" ile
                aynı tek tanıtım/başvuru funnel'ına hizalandı, bkz. UX_AUDIT_BOUNCE_COMPARISON */}
            <Link href="/partners" className="relative id-eyebrow text-orange-600 hover:text-orange-700 transition-all duration-200">{navCopy.becomePartner}</Link>
          </nav>
        )}
        <nav aria-label={navCopy.secondaryLabel} className="hidden md:flex">
          <NavLink href="/blog">{navCopy.blog}</NavLink>
        </nav>
        <div className="shrink-0">
          <LocaleSwitcher />
        </div>
        <div className="shrink-0">
          <UserNav />
        </div>
      </div>
    </header>
  );
}
