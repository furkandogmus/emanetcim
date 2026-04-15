"use client";

import { Link } from "@/i18n/routing";
import UserNav from "./UserNav";
import LocaleSwitcher from "./LocaleSwitcher";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Package } from "lucide-react";
import { useLocale } from "next-intl";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname?.includes(href) && href !== "/";
  return (
    <Link
      href={href}
      className={`relative text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
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
  const locale = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const hideGuestBookingNav = role === "PARTNER" || role === "ADMIN";
  const logoHref = role === "PARTNER" ? "/partner" : role === "ADMIN" ? "/admin" : "/";
  const navCopy =
    locale === "tr"
      ? { explore: "Keşfet", partner: "Partner", insurance: "Sigorta", blog: "Blog" }
      : { explore: "Explore", partner: "Partners", insurance: "Insurance", blog: "Blog" };

  if (pathname?.includes("/login")) return null;

  return (
    <header className="sticky top-0 w-full z-50 glass border-b border-gray-100/80 px-4 sm:px-6 py-3 flex justify-between items-center transition-all duration-300">
      {/* Logo */}
      <Link
        href={logoHref}
        className="flex items-center gap-2.5 group"
      >
        <div className="w-8 h-8 bg-brand-gradient rounded-xl flex items-center justify-center shadow-brand-sm group-hover:shadow-brand-md transition-all duration-200 group-active:scale-95">
          <Package size={16} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-black tracking-tight text-gray-900 group-hover:text-orange-600 transition-colors duration-200">
          BagajPark
        </span>
      </Link>

      {/* Nav + Actions */}
      <div className="flex items-center gap-3 sm:gap-5">
        {!hideGuestBookingNav && (
          <>
            <NavLink href="/search">{navCopy.explore}</NavLink>
            <NavLink href="/partners">{navCopy.partner}</NavLink>
            <NavLink href="/insurance">{navCopy.insurance}</NavLink>
          </>
        )}
        <NavLink href="/blog">{navCopy.blog}</NavLink>
        <LocaleSwitcher />
        <UserNav />
      </div>
    </header>
  );
}
