"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, Clock } from "lucide-react";
import DateTimePicker from "@/components/ui/DateTimePicker";
import { addDays, calendarDaysInclusive } from "@/lib/stay-days";
import { hoursForDate, lastDropOffForDate, type ShopSchedule } from "@/lib/shop-schedule";
import { timeZoneCityLabel } from "@/lib/datetime-local";

type Props = {
  dropDate: string;
  pickupDate: string;
  onChange: (dropDate: string, pickupDate: string) => void;
  /** Secilebilecek ilk birakis gunu (`YYYY-MM-DD`). */
  minDropDate: string;
  maxDays: number;
  /** Haftalik saat + izinler; secilen gunun saati buradan okunur. */
  schedule: ShopSchedule;
  /** Dukkanin saat dilimi; saatler onun yerel saatidir, misafirin cihazininki degil. */
  timeZone: string;
};

const QUICK_DAYS = [1, 2, 3];

function localDateOf(date: string): Date | undefined {
  const [y, m, d] = date.split("-").map(Number);
  return y ? new Date(y, m - 1, d) : undefined;
}

/**
 * Gun bazli kalis secimi. Saat sorulmaz: birakis ve alis dukkanin calisma
 * saatine oturtulur (`resolveStayWindow`), fiyat gun sayisindan cikar.
 */
export default function StayDaysPicker({ dropDate, pickupDate, onChange, minDropDate, maxDays, schedule, timeZone }: Props) {
  const t = useTranslations("Guest");
  const days = calendarDaysInclusive(dropDate, pickupDate);
  const dropHours = hoursForDate(schedule, dropDate);
  const pickupHours = hoursForDate(schedule, pickupDate);
  const lastDrop = lastDropOffForDate(schedule, dropDate);
  const isClosed = (d: Date) =>
    hoursForDate(schedule, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`) === null;

  const setDrop = (v: string) => {
    // Alis gunu birakisin gerisinde kalamaz; kalis suresi korunarak kaydirilir.
    const keep = Math.max(1, days);
    onChange(v, calendarDaysInclusive(v, pickupDate) < 1 ? addDays(v, keep - 1) : pickupDate);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-gray-500">{t("stayDropDay")}</span>
          <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 focus-within:border-brand-300">
            <DateTimePicker
              value={dropDate}
              onChange={setDrop}
              dateOnly
              minDate={localDateOf(minDropDate)}
              isDateDisabled={isClosed}
              testId="checkout-drop-date"
              ariaLabel={t("stayDropDay")}
              iconSize={16}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-gray-500">{t("stayPickupDay")}</span>
          <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 focus-within:border-brand-300">
            <DateTimePicker
              value={pickupDate}
              onChange={(v) => onChange(dropDate, v)}
              dateOnly
              minDate={localDateOf(dropDate)}
              isDateDisabled={isClosed}
              testId="checkout-pickup-date"
              ariaLabel={t("stayPickupDay")}
              iconSize={16}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("stayDuration")}>
        {QUICK_DAYS.filter((n) => n <= maxDays).map((n) => {
          const active = days === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(dropDate, addDays(dropDate, n - 1))}
              className={`rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-brand-300"
              }`}
            >
              {t("stayDaysCount", { count: n })}
            </button>
          );
        })}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4">
        <CalendarDays size={20} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900" data-testid="checkout-days-summary">
            {days > 0 ? t("stayDaysCount", { count: days }) : "—"}
          </p>
          {dropHours ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-600" data-testid="checkout-drop-hours">
              <Clock size={12} className="shrink-0" aria-hidden />
              {t("stayDropHours", { date: dropDate, open: dropHours.open, close: dropHours.close, last: lastDrop ?? dropHours.close })}
            </p>
          ) : (
            <p className="mt-0.5 text-xs font-bold text-orange-600">{t("stayDayClosed", { date: dropDate })}</p>
          )}
          {pickupHours ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-600" data-testid="checkout-pickup-hours">
              <Clock size={12} className="shrink-0" aria-hidden />
              {t("stayPickupHours", { date: pickupDate, open: pickupHours.open, close: pickupHours.close })}
            </p>
          ) : (
            <p className="mt-0.5 text-xs font-bold text-orange-600">{t("stayDayClosed", { date: pickupDate })}</p>
          )}
          {!schedule.open247 ? (
            <p className="mt-0.5 pl-[18px] text-[11px] text-gray-500">
              {t("timesInShopTimezone", { zone: timeZoneCityLabel(timeZone) })}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
