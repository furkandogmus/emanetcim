"use client";

import { Link } from "@/i18n/routing";
import type { PartnerBookingsFilter } from "@/lib/partner-bookings-filter";

const FILTERS: PartnerBookingsFilter[] = ["all", "action", "payment", "done"];

export default function PartnerBookingsFilterTabs({
  current,
  labels,
  ariaLabel,
}: {
  current: PartnerBookingsFilter;
  labels: Record<PartnerBookingsFilter, string>;
  ariaLabel: string;
}) {
  const base = "/partner/bookings";

  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label={ariaLabel}>
      {FILTERS.map((f) => {
        const active = current === f;
        const href = f === "all" ? base : `${base}?filter=${f}`;
        return (
          <Link
            key={f}
            href={href}
            role="tab"
            aria-selected={active}
            className={` rounded-full px-4 py-2 text-xs id-eyebrow transition-colors ${
              active
                ? "bg-orange-600 text-white shadow-md shadow-orange-200"
                : "border border-gray-200 bg-white text-gray-600 hover:border-orange-200 hover:text-orange-700"
            }`}
          >
            {labels[f]}
          </Link>
        );
      })}
    </div>
  );
}
