"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  ArrowDownRight,
  ArrowUpRight,
  Award,
  Luggage,
  PackageCheck,
  PackageOpen,
  Sparkles,
} from "lucide-react";
import { formatTryCurrency } from "@/lib/currency";
import { bcp47ForUiLocale } from "@/lib/intl-locale";
import { nextMilestone } from "@/lib/partner-milestones";

/**
 * Esnafın GÜNÜNÜ planlatan blok.
 *
 * NEDEN VAR: panel yalnızca ömür boyu toplamları gösteriyordu (aktif rezervasyon,
 * toplam kazanç, aylık görüntülenme). Esnafın dükkanı açtığında sorduğu soru
 * bunların hiçbiri değildi: bugün kaç valiz gelecek, kaçı alınacak, elimde şu an
 * ne var, bu ay nasıl gidiyor. Panel bilgi veriyordu ama günü planlatmıyordu.
 *
 * Bkz. `src/services/PartnerDashboardService.ts` — bütün zaman sınırları
 * DÜKKANIN saat diliminde hesaplanır.
 */

export type PulseProps = {
  todayArrivals: number;
  todayPickups: number;
  bagsInStorage: number;
  capacity: number;
  monthNet: number;
  monthChangePct: number | null;
  bagsHandledAllTime: number;
  /** Komisyon yürürlükte mi? Değilse "tamamı sende" rozeti çıkar. */
  commissionActive: boolean;
};

export default function PartnerPulse({
  todayArrivals,
  todayPickups,
  bagsInStorage,
  capacity,
  monthNet,
  monthChangePct,
  bagsHandledAllTime,
  commissionActive,
}: PulseProps) {
  const t = useTranslations("Partner");
  const bcp47 = bcp47ForUiLocale(useLocale());

  const occupancyPct =
    capacity > 0 ? Math.min(100, Math.round((bagsInStorage / capacity) * 100)) : 0;
  const milestone = nextMilestone(bagsHandledAllTime);
  const rising = monthChangePct !== null && monthChangePct >= 0;

  return (
    <section className="mb-6 space-y-3" aria-label={t("pulseTitle")}>
      {/* ── BUGÜN ── */}
      <div className="ui-card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-3">
          <p className="id-eyebrow text-gray-400">{t("pulseToday")}</p>
          {!commissionActive && (
            <span className="id-pill flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
              <Sparkles className="h-3 w-3" />
              {t("pulseZeroCommission")}
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <PulseStat
            icon={<PackageOpen className="h-4 w-4 text-blue-500" />}
            value={todayArrivals}
            label={t("pulseArrivals")}
          />
          <PulseStat
            icon={<PackageCheck className="h-4 w-4 text-emerald-500" />}
            value={todayPickups}
            label={t("pulsePickups")}
          />
          <PulseStat
            icon={<Luggage className="h-4 w-4 text-amber-500" />}
            value={bagsInStorage}
            label={t("pulseInStorage")}
          />
        </div>

        {/* Doluluk: sayi tek basina "cok mu az mi" sorusunu cevaplamiyor. */}
        {capacity > 0 && (
          <div className="px-5 pb-4 pt-3">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="id-eyebrow text-gray-400">{t("pulseOccupancy")}</span>
              <span className="text-xs font-bold text-gray-600">
                {t("pulseOccupancyValue", { used: bagsInStorage, capacity })}
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
              role="progressbar"
              aria-valuenow={occupancyPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t("pulseOccupancy")}
            >
              <div
                /* Doluluk arttikca renk isiniyor: %85 ustu "yer kalmiyor" demek. */
                className={`h-full rounded-full transition-all duration-500 ${
                  occupancyPct >= 85
                    ? "bg-amber-500"
                    : occupancyPct >= 50
                      ? "bg-emerald-500"
                      : "bg-emerald-400"
                }`}
                style={{ width: `${Math.max(occupancyPct, bagsInStorage > 0 ? 4 : 0)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* ── BU AY + MOMENTUM ── */}
        <Link
          href="/partner/earnings"
          className="ui-card flex flex-col justify-between gap-2 p-5 transition-transform hover:-translate-y-0.5"
        >
          <p className="id-eyebrow text-gray-400">{t("pulseThisMonth")}</p>
          <p className="id-display text-3xl text-gray-900">
            {formatTryCurrency(monthNet, bcp47)}
          </p>
          {/*
            Yuzde degisim GECEN AY 0 ISE gosterilmez: sifira bolmek "%sonsuz
            artis" gibi anlamsiz bir rakam uretir. Yeni acilan dukkan da her ay
            "%100 artis" gormemeli.
          */}
          {monthChangePct === null ? (
            <p className="text-xs text-gray-400">{t("pulseNoComparison")}</p>
          ) : (
            <p
              className={`flex items-center gap-1 text-xs font-bold ${
                rising ? "text-emerald-600" : "text-gray-500"
              }`}
            >
              {rising ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {/*
                YON METNE GIRIYOR, oka birakilmiyor. Once "geçen aya göre %100"
                yaziyordu ve `Math.abs` yuzunden dusus ile artis AYNI cumleyi
                uretiyordu; yonu yalnizca kucuk bir ok tasiyordu. Ekranda
                bakildiginda -%100 bir dusus, "%100" ise artis gibi okunuyordu.
              */}
              {t(rising ? "pulseVsLastMonthUp" : "pulseVsLastMonthDown", {
                pct: Math.abs(monthChangePct),
              })}
            </p>
          )}
        </Link>

        {/* ── KİLOMETRE TAŞI ── */}
        {milestone && (
          <div className="ui-card flex flex-col justify-between gap-2 p-5">
            <div className="flex items-center gap-2">
              <Award className="id-accent h-4 w-4" />
              <p className="id-eyebrow text-gray-400">{t("pulseMilestone")}</p>
            </div>
            <p className="id-display text-3xl text-gray-900">
              {t("pulseBagsHandled", { count: bagsHandledAllTime })}
            </p>
            <div>
              <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="id-accent-bg h-full rounded-full transition-all duration-700"
                  style={{ width: `${milestone.pct}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {t("pulseMilestoneRemaining", {
                  remaining: milestone.target - bagsHandledAllTime,
                  target: milestone.target,
                })}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function PulseStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-4 text-center">
      {icon}
      <p className="id-display text-3xl text-gray-900">{value}</p>
      <p className="text-[11px] font-semibold leading-tight text-gray-400">{label}</p>
    </div>
  );
}
