"use client";

import { useTranslations } from "next-intl";
import { hoursForDate, isoWeekday, type ShopSchedule } from "@/lib/shop-schedule";

/** Bu haftanın 7 günü (bugünden başlayarak) ve o günün saati; izin günü "Kapalı". */
export default function ShopHoursList({
  schedule,
  today,
}: {
  schedule: ShopSchedule;
  today: string;
}) {
  const t = useTranslations("Partner.schedule");
  const tg = useTranslations("Guest");
  const rows = Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10);
    return { date, weekday: isoWeekday(date), hours: hoursForDate(schedule, date) };
  });
  const upcoming = (schedule.closures ?? []).filter((c) => c.endDate >= today);

  return (
    <div className="space-y-2 text-sm font-bold text-gray-700">
      {rows.map((r) => (
        <div key={r.date} className="flex justify-between">
          <span>{t(`days.${r.weekday}`)}</span>
          <span className={r.hours ? "" : "text-red-600"}>
            {r.hours ? `${r.hours.open} – ${r.hours.close}` : t("closed")}
          </span>
        </div>
      ))}
      {upcoming.length > 0 ? (
        <ul className="mt-3 border-t border-black/5 pt-3 text-xs font-bold text-gray-600">
          {upcoming.map((c) => (
            <li key={`${c.startDate}-${c.endDate}`}>
              {tg("shopClosedOn", {
                range: c.startDate === c.endDate ? c.startDate : `${c.startDate} → ${c.endDate}`,
              })}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
