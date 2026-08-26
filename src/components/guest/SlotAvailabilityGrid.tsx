"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { useLocale, useTranslations } from "next-intl";
import { AlertCircle, RotateCw } from "lucide-react";
import { formatDecimal } from "@/lib/currency";
import {
  PLATFORM_TIMEZONE,
  parseDatetimeLocalInTimeZone,
  timeZoneCityLabel,
  toDatetimeLocalValueInTimeZone,
} from "@/lib/datetime-local";

interface SlotInfo {
  id: string;
  /** API'den ISO anı olarak gelir: "2026-08-24T09:30:00.000Z". */
  startTime: string;
  endTime: string;
  capacity: number;
  reserved: number;
  available: number;
}

interface SlotAvailabilityGridProps {
  shopId: string;
  date: Date;
  selectedBags: number;
  /**
   * `from`/`to`, `datetime-local` DUVAR SAATİ biçimindedir ("YYYY-MM-DDTHH:mm"),
   * dükkanın saat diliminde. ISO anı DEĞİL — bkz. `toWallValue` altındaki not.
   */
  onSelectRange: (from: string, to: string, slotCount: number) => void;
  initialFrom?: string;
  initialTo?: string;
  timeZone?: string;
}

/**
 * ISO anını dükkanın saat dilimindeki `datetime-local` duvar saatine çevirir.
 *
 * NEDEN (2026-08-24'te ölçüldü): bu bileşen seçilen aralığı `onSelectRange` ile
 * HAM ISO olarak veriyordu ("2026-08-24T09:30:00.000Z") ve `CheckoutClient` onu
 * doğrudan `setCheckInLocal`'a yazıyordu. O state bir `datetime-local` duvar
 * saati bekliyor; `parseDatetimeLocalInTimeZone` gelen değere koşulsuz "Z"
 * ekliyor, yani "...000Z" + "Z" = "...000ZZ" → **Invalid Date → null**.
 *
 * Sonuç ölçüldü: iki slot'a dokunup aralık seçmek `windowOk`'u FALSE yapıyordu.
 * Yani müsaitlik ızgarasını AMACINA UYGUN kullanmak — iki dokunuşla saat seçmek —
 * rezervasyonu bozuyor, "devam" butonu sönüyor ve kullanıcı "tarih geçersiz"
 * uyarısı alıyordu. Sınırda çevirmek bu sözleşmeyi tek yerde tutar.
 */
function toWallValue(iso: string, timeZone: string): string {
  return toDatetimeLocalValueInTimeZone(new Date(iso), timeZone);
}

/**
 * Slot etiketi DÜKKANIN saatinde yazılır, cihazınkinde değil.
 *
 * Eskiden `new Date(iso).getHours()` kullanılıyordu; bu CİHAZIN saat dilimidir.
 * `src/lib/datetime-local.ts` bu hata sınıfını ("Berlin'de 1 saat, New York'ta
 * 7 saat kayma") tam olarak anlatıyor ve tarih girdileri için düzeltilmişti —
 * slot ızgarası o düzeltmenin dışında kalmıştı. Hedef kitle turist olduğu için
 * telefonu hâlâ memleket saatinde olan misafir, dükkanın müsaitlik takvimiyle
 * uyuşmayan saatler görüyordu.
 */
function formatSlotTime(iso: string, timeZone: string): string {
  return toWallValue(iso, timeZone).slice(11, 16);
}

/** Gün penceresi de dükkanın saat diliminde hesaplanır (cihazın gece yarısı değil). */
function dayWindow(date: Date, timeZone: string): { from: Date; to: Date } | null {
  const day = toDatetimeLocalValueInTimeZone(date, timeZone).slice(0, 10);
  const from = parseDatetimeLocalInTimeZone(`${day}T00:00`, timeZone);
  const to = parseDatetimeLocalInTimeZone(`${day}T23:59`, timeZone);
  return from && to ? { from, to } : null;
}

export default function SlotAvailabilityGrid({
  shopId,
  date,
  selectedBags,
  onSelectRange,
  initialFrom,
  initialTo,
  timeZone = PLATFORM_TIMEZONE,
}: SlotAvailabilityGridProps) {
  const t = useTranslations("Guest");
  const tCommon = useTranslations("Common");
  const locale = useLocale();
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(initialFrom ?? null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(initialTo ?? null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const window = dayWindow(date, timeZone);
      if (!window) throw new Error("invalid day window");

      const res = await fetch(
        `/api/shops/${shopId}/slots?from=${window.from.toISOString()}&to=${window.to.toISOString()}`,
      );
      if (!res.ok) throw new Error(`slots request failed: ${res.status}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      /*
        Ham `e.message` gösterilmiyordu diye değil, GÖSTERİLİYORDU diye değişti:
        kullanıcı 6 dilin hepsinde İngilizce "Failed to fetch slots" görüyordu ve
        tekrar deneme yolu yoktu — ağ tökezlerse adım çıkmaza giriyordu.
      */
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [shopId, date, timeZone]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleSlotTap = (slotStart: string) => {
    if (!selectedStart || slotStart < selectedStart) {
      setSelectedStart(slotStart);
      setSelectedEnd(null);
      return;
    }
    setSelectedEnd(slotStart);
    const startIdx = slots.findIndex((s) => s.startTime === selectedStart);
    const endIdx = slots.findIndex((s) => s.startTime === slotStart);
    if (startIdx >= 0 && endIdx >= 0) {
      onSelectRange(
        toWallValue(selectedStart, timeZone),
        toWallValue(slots[endIdx].endTime, timeZone),
        endIdx - startIdx + 1,
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4" role="status" aria-live="polite">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-orange-600 rounded-full animate-spin" />
        <span className="sr-only">{t("slotsAvailableTitle")}</span>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="ui-state ui-state-error flex flex-wrap items-center justify-between gap-2 rounded-2xl">
        <span className="flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" />
          {t("slotsLoadError")}
        </span>
        <button
          type="button"
          onClick={() => void fetchSlots()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
        >
          <RotateCw size={12} />
          {tCommon("errorRetry")}
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="ui-state ui-state-empty rounded-2xl text-center">
        {t("slotsNoneForDate")}
      </div>
    );
  }

  const inSelectedRange = (slotStart: string) => {
    if (!selectedStart) return false;
    if (!selectedEnd) return slotStart === selectedStart;
    return slotStart >= selectedStart && slotStart <= selectedEnd;
  };

  const selectedCount = slots.filter((s) => inSelectedRange(s.startTime)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="id-eyebrow text-gray-400">
          {t("slotsAvailableTitle")}
        </p>
        <p className="text-[10px] font-bold text-gray-400">
          {t("slotsBagsSelected", { count: selectedBags })}
        </p>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
        {slots.map((slot) => {
          const isAvailable = slot.available >= selectedBags;
          const selected = inSelectedRange(slot.startTime);
          const time = formatSlotTime(slot.startTime, timeZone);
          return (
            <button
              key={slot.id}
              type="button"
              disabled={!isAvailable}
              aria-pressed={selected}
              /*
                Ekran okuyucu eskiden yalnızca "09:30 3" duyuyordu: rakamın neyi
                saydığı hiçbir yerde yazmıyordu. Görsel olarak da yalnızca renk
                (yeşil/amber) taşıyordu — tek başına renk erişilebilir bir sinyal
                değildir.
              */
              aria-label={
                slot.available > 0
                  ? t("slotsSlotAriaLabel", { time, count: slot.available })
                  : t("slotsSlotFullAriaLabel", { time })
              }
              onClick={() => handleSlotTap(slot.startTime)}
              className={clsx(
                "shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-center transition-all min-w-[52px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1",
                selected
                  ? "bg-orange-600 text-white shadow-md scale-105"
                  : isAvailable
                    ? "bg-gray-50 border border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50 cursor-pointer"
                    : "bg-gray-100 border border-gray-100 text-gray-300 cursor-not-allowed",
              )}
            >
              <span aria-hidden className="text-[11px] font-bold leading-tight">
                {time}
              </span>
              <span
                aria-hidden
                className={clsx(
                  "text-[9px] font-bold",
                  selected
                    ? "text-white/80"
                    : slot.available >= 5
                      ? "text-emerald-600"
                      : slot.available > 0
                        ? "text-amber-600"
                        : "text-gray-300",
                )}
              >
                {slot.available}
              </span>
            </button>
          );
        })}
      </div>

      {/*
        Saatlerin hangi takvime ait olduğu yazmıyordu. `timesInShopTimezone`
        anahtarı 6 dilde zaten vardı ama hiçbir yerde kullanılmıyordu — ait
        olduğu yer tam burası: müsaitlik hesabı da dükkanın saatiyle yapılıyor.
        Şehir adı metne SABİT gömülüydü ("...(İstanbul)"); artık dükkanın kendi
        diliminden geliyor, yoksa İstanbul dışı ilk dükkanda cümle yalan söyler.
      */}
      <p className="mt-1 text-[10px] font-medium text-gray-400">
        {t("timesInShopTimezone", { zone: timeZoneCityLabel(timeZone) })}
      </p>

      {selectedStart && selectedEnd && (
        <p className="mt-2 text-xs font-bold text-orange-600 text-center">
          {formatSlotTime(selectedStart, timeZone)} → {formatSlotTime(selectedEnd, timeZone)}{" "}
          ({selectedCount} {t("checkoutSlotUnit")},{" "}
          {/* Ondalık ayracı yerelleştirilmeli: TR'de "1,5", "1.5" değil. */}
          {formatDecimal(selectedCount * 0.5, locale)}
          {t("checkoutHourShort")})
        </p>
      )}
    </div>
  );
}
