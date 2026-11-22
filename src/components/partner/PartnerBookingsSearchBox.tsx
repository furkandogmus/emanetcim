import { Search } from "lucide-react";
import type { PartnerBookingsFilter } from "@/lib/partner-bookings-filter";

/**
 * Esnaf rezervasyon aramasi: duz GET formu, JS gerektirmez. Eslesme kurali
 * sunucuda (`PartnerBookingSearchService`); sayfa `?q=` ile yeniden cizilir.
 */
export default function PartnerBookingsSearchBox({
  initialQuery,
  filter,
  label,
  placeholder,
  submitLabel,
}: {
  initialQuery: string;
  filter: PartnerBookingsFilter;
  label: string;
  placeholder: string;
  submitLabel: string;
}) {
  return (
    <form method="get" role="search" className="flex gap-2">
      {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4">
        <Search size={16} className="shrink-0 text-gray-400" aria-hidden="true" />
        <span className="sr-only">{label}</span>
        <input
          type="search"
          name="q"
          defaultValue={initialQuery}
          placeholder={placeholder}
          maxLength={100}
          className="min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none"
        />
      </label>
      <button
        type="submit"
        className="rounded-2xl bg-orange-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-700"
      >
        {submitLabel}
      </button>
    </form>
  );
}
