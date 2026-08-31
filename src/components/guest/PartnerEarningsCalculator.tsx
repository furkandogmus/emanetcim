"use client";

import { useMemo, useState } from "react";
import { formatTryCurrency } from "@/lib/currency";

type Labels = {
  capacityLabel: string;
  occupancyLabel: string;
  monthlyEarningsLabel: string;
  disclaimer: string;
};

/**
 * Esnaf başvuru sayfasındaki "kazanç tahmini" — eskiden "örnek hesap için
 * ortak ekibimizle görüşün" diyen statik bir metindi (bkz.
 * docs/KOD_TARAMA_2026-08-23.md). Aday esnafın bir telefon görüşmesi
 * beklemeden ANINDA gördüğü, gerçek fiyat/komisyon verisiyle çalışan bir
 * araca çevrildi.
 *
 * Komisyon oranı sabit yazılmıyor — `merchantShareRatio` sunucudan (platform
 * ayarlarının o anki gerçek değeri) geliyor, öyle ki oran değişirse hesap
 * otomatik güncel kalır.
 */
export default function PartnerEarningsCalculator({
  defaultPricePerDay,
  merchantShareRatio,
  locale,
  labels,
}: {
  defaultPricePerDay: number;
  merchantShareRatio: number;
  locale: string;
  labels: Labels;
}) {
  const [capacity, setCapacity] = useState(10);
  const [occupancyPct, setOccupancyPct] = useState(50);

  const monthlyNet = useMemo(() => {
    const dailyBookings = capacity * (occupancyPct / 100);
    const dailyGross = dailyBookings * defaultPricePerDay;
    const dailyNet = dailyGross * merchantShareRatio;
    return Math.round(dailyNet * 30);
  }, [capacity, occupancyPct, defaultPricePerDay, merchantShareRatio]);

  return (
    <div className="mx-auto max-w-xl text-left">
      <div className="space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-bold text-gray-700">
            <label htmlFor="partner-capacity">{labels.capacityLabel}</label>
            <span className="text-orange-600">{capacity}</span>
          </div>
          <input
            id="partner-capacity"
            type="range"
            min={2}
            max={50}
            step={1}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-full accent-orange-600"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm font-bold text-gray-700">
            <label htmlFor="partner-occupancy">{labels.occupancyLabel}</label>
            <span className="text-orange-600">%{occupancyPct}</span>
          </div>
          <input
            id="partner-occupancy"
            type="range"
            aria-valuetext={`%${occupancyPct}`}
            min={10}
            max={100}
            step={5}
            value={occupancyPct}
            onChange={(e) => setOccupancyPct(Number(e.target.value))}
            className="w-full accent-orange-600"
          />
        </div>
      </div>

      {/* Kaydiraci ceken kisi rakamin degistigini gormeli; goremeyen de
          duymali. aria-live olmadan bu arac ekran okuyucuda sessiz. */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="mt-8 rounded-3xl bg-white p-6 text-center shadow-sm"
      >
        <p className="id-eyebrow text-gray-400">
          {labels.monthlyEarningsLabel}
        </p>
        <p className="mt-2 text-4xl font-black tracking-tight text-orange-600">
          {formatTryCurrency(monthlyNet, locale, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })}
        </p>
      </div>

      <p className="mt-4 text-xs text-gray-500">{labels.disclaimer}</p>
    </div>
  );
}
