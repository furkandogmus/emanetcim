"use client";

import { useState, useEffect, useCallback } from "react";
import clsx from "clsx";
import { useTranslations } from "next-intl";

interface SlotInfo {
  id: string;
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
  onSelectRange: (from: string, to: string, slotCount: number) => void;
  initialFrom?: string;
  initialTo?: string;
}

function formatSlotTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function SlotAvailabilityGrid({
  shopId,
  date,
  selectedBags,
  onSelectRange,
  initialFrom,
  initialTo,
}: SlotAvailabilityGridProps) {
  const t = useTranslations("Guest");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string | null>(initialFrom ?? null);
  const [selectedEnd, setSelectedEnd] = useState<string | null>(initialTo ?? null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      const from = dayStart.toISOString();
      const to = dayEnd.toISOString();

      const res = await fetch(`/api/shops/${shopId}/slots?from=${from}&to=${to}`);
      if (!res.ok) throw new Error("Failed to fetch slots");
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load slots");
    } finally {
      setLoading(false);
    }
  }, [shopId, date]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleSlotTap = (slotId: string, slotStart: string) => {
    if (!selectedStart) {
      setSelectedStart(slotStart);
      setSelectedEnd(null);
    } else if (slotStart < selectedStart) {
      setSelectedStart(slotStart);
      setSelectedEnd(null);
    } else {
      setSelectedEnd(slotStart);
      const startIdx = slots.findIndex((s) => s.startTime === selectedStart);
      const endIdx = slots.findIndex((s) => s.startTime === slotStart);
      if (startIdx >= 0 && endIdx >= 0) {
        const slotCount = endIdx - startIdx + 1;
        onSelectRange(selectedStart, slots[endIdx].endTime, slotCount);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-orange-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-2 text-xs text-red-500">{error}</div>;
  }

  if (slots.length === 0) {
    return (
      <div className="text-center py-2 text-xs text-gray-400">
        {t("slotsNoneForDate")}
      </div>
    );
  }

  const inSelectedRange = (slotStart: string) => {
    if (!selectedStart) return false;
    if (!selectedEnd) return slotStart === selectedStart;
    return slotStart >= selectedStart && slotStart <= selectedEnd;
  };

  const label = t("slotsAvailableTitle");
  const bagLabel = t("slotsBagsSelected", { count: selectedBags });

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
        <p className="text-[10px] font-bold text-gray-400">{bagLabel}</p>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
        {slots.map((slot) => {
          const isAvailable = slot.available >= selectedBags;
          const selected = inSelectedRange(slot.startTime);
          return (
            <button
              key={slot.id}
              type="button"
              disabled={!isAvailable}
              onClick={() => handleSlotTap(slot.id, slot.startTime)}
              className={clsx(
                "shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-center transition-all min-w-[52px]",
                selected
                  ? "bg-orange-600 text-white shadow-md scale-105"
                  : isAvailable
                    ? "bg-gray-50 border border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50"
                    : "bg-gray-100 border border-gray-100 text-gray-300 cursor-not-allowed",
              )}
            >
              <span className="text-[11px] font-bold leading-tight">
                {formatSlotTime(slot.startTime)}
              </span>
              <span
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
      {selectedStart && selectedEnd && (
        <p className="mt-2 text-xs font-bold text-orange-600 text-center">
          {formatSlotTime(selectedStart)} → {formatSlotTime(selectedEnd)}
          {" "}({slots.filter((s) => inSelectedRange(s.startTime)).length} {t("checkoutSlotUnit")},{" "}
          {slots.filter((s) => inSelectedRange(s.startTime)).length * 0.5}{t("checkoutHourShort")})
        </p>
      )}
    </div>
  );
}
