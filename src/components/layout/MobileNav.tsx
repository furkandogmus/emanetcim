"use client";

import { Home, MapPin, CalendarDays } from "lucide-react";
import { Link, usePathname } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import clsx from "clsx";

const items = [
  { href: "/", labelKey: "mobileNavHome" as const, Icon: Home },
  { href: "/search", labelKey: "mobileNavSearch" as const, Icon: MapPin },
  { href: "/bookings", labelKey: "mobileNavBookings" as const, Icon: CalendarDays },
];

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

  if ((pathname ?? "").includes("/login")) return null;

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
