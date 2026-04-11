"use client";

import {
  Home,
  MapPin,
  CalendarDays,
  Store,
  LayoutDashboard,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import clsx from "clsx";
import { useSession } from "next-auth/react";

type MobileNavItem = {
  href: string;
  labelKey:
    | "mobileNavHome"
    | "mobileNavSearch"
    | "mobileNavBookings"
    | "mobileNavPartnerPanel"
    | "mobileNavPartnerList"
    | "mobileNavAdminPanel"
    | "mobileNavAdminDashboard";
  Icon: LucideIcon;
};

function navItemsForRole(role: string | undefined): MobileNavItem[] {
  if (role === "PARTNER") {
    return [
      { href: "/", labelKey: "mobileNavHome", Icon: Home },
      { href: "/partner", labelKey: "mobileNavPartnerPanel", Icon: Store },
      { href: "/partner/bookings", labelKey: "mobileNavPartnerList", Icon: CalendarDays },
    ];
  }
  if (role === "ADMIN") {
    return [
      { href: "/", labelKey: "mobileNavHome", Icon: Home },
      { href: "/admin", labelKey: "mobileNavAdminPanel", Icon: Shield },
      { href: "/admin/dashboard", labelKey: "mobileNavAdminDashboard", Icon: LayoutDashboard },
    ];
  }
  return [
    { href: "/", labelKey: "mobileNavHome", Icon: Home },
    { href: "/search", labelKey: "mobileNavSearch", Icon: MapPin },
    { href: "/bookings", labelKey: "mobileNavBookings", Icon: CalendarDays },
  ];
}

function pathMatchesHref(pathname: string | null, href: string): boolean {
  const p = pathname ?? "";
  if (href === "/") {
    return p === "/" || p === "";
  }
  return p === href || p.startsWith(`${href}/`);
}

export default function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("Common");
  const { data: session } = useSession();
  const items = navItemsForRole(session?.user?.role);

  const p = pathname ?? "";
  if (p.includes("/login")) return null;

  // /partner ana panel: PartnerClient kendi sekme çubuğunu kullanır; çift alt bar olmasın.
  const normalized = p.replace(/\/$/, "") || "/";
  if (session?.user?.role === "PARTNER" && normalized === "/partner") {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Mobile"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 pt-1">
        {items.map(({ href, labelKey, Icon }) => {
          const active = pathMatchesHref(pathname, href);
          return (
            <li key={href} className="flex min-w-0 flex-1">
              <Link
                href={href}
                className={clsx(
                  "flex w-full flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-colors",
                  active ? "text-orange-600" : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="truncate">{t(labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
