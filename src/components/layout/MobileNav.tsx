"use client";

import {
  Home,
  MapPin,
  CalendarDays,
  Store,
  LayoutDashboard,
  Shield,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/routing";
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
      { href: "/",                labelKey: "mobileNavHome",         Icon: Home },
      { href: "/partner",         labelKey: "mobileNavPartnerPanel", Icon: Store },
      { href: "/partner/bookings",labelKey: "mobileNavPartnerList",  Icon: CalendarDays },
    ];
  }
  if (role === "ADMIN") {
    return [
      { href: "/",               labelKey: "mobileNavHome",          Icon: Home },
      { href: "/admin",          labelKey: "mobileNavAdminPanel",     Icon: Shield },
      { href: "/admin/dashboard",labelKey: "mobileNavAdminDashboard", Icon: LayoutDashboard },
    ];
  }
  return [
    { href: "/",        labelKey: "mobileNavHome",     Icon: Home },
    { href: "/search",  labelKey: "mobileNavSearch",   Icon: MapPin },
    { href: "/bookings",labelKey: "mobileNavBookings", Icon: CalendarDays },
  ];
}

function pathMatchesHref(pathname: string | null, href: string): boolean {
  const p = pathname ?? "";
  if (href === "/") return p === "/" || p === "";
  return p === href || p.startsWith(`${href}/`);
}

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Common");
  const { data: session } = useSession();
  const items = navItemsForRole(session?.user?.role);

  const p = pathname ?? "";
  const isDetailPage = p.includes("/shop/") || p.includes("/checkout/");
  if (
    p.includes("/login") ||
    p.includes("/register") ||
    p.includes("/auth/") ||
    p.includes("/admin/") ||
    p.includes("/partner/")
  ) {
    return null;
  }

  const normalized = p.replace(/\/$/, "") || "/";
  if (session?.user?.role === "PARTNER" && normalized === "/partner") return null;

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 pb-safe md:hidden"
      aria-label="Mobile navigation"
    >
      {/* Blur backdrop */}
      <div className="glass border-t border-gray-100/80">
        <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 pt-2 pb-2">
          {isDetailPage ? (
            <li className="flex min-w-0 flex-1 max-w-[60px]">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 px-1 transition-all duration-200 active:scale-90"
              >
                <div className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-all duration-200">
                  <ChevronLeft className="h-4.5 w-4.5 text-gray-400" strokeWidth={2} aria-hidden />
                </div>
                <span className="truncate text-[9px] id-eyebrow text-gray-400">
                  {t("back")}
                </span>
              </button>
            </li>
          ) : null}
          {items.map(({ href, labelKey, Icon }) => {
            const active = pathMatchesHref(pathname, href);
            return (
              <li key={href} className="flex min-w-0 flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex w-full flex-col items-center gap-1 rounded-2xl py-2 px-1 transition-all duration-200 active:scale-90"
                >
                  {/* Icon pill */}
                  <div
                    className={clsx(
                      "relative flex items-center justify-center rounded-xl transition-all duration-200",
                      active
                        ? "w-12 h-7 bg-orange-600 shadow-brand-sm"
                        : "w-7 h-7 hover:bg-gray-100"
                    )}
                  >
                    <Icon
                      className={clsx(
                        "h-4.5 w-4.5 shrink-0 transition-colors duration-200",
                        active ? "text-white" : "text-gray-400"
                      )}
                      strokeWidth={active ? 2.5 : 2}
                      aria-hidden
                    />
                  </div>
                  {/* Label */}
                  <span
                    className={clsx(
                      "truncate text-[9px] id-eyebrow transition-colors duration-200",
                      active ? "text-orange-600" : "text-gray-400"
                    )}
                  >
                    {t(labelKey)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
