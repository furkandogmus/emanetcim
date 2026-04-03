"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Luggage, Settings } from "lucide-react";
import { updateShopSettingsAction } from "@/actions/shop";

type Props = {
  shopId: string;
  initialCapacity: number;
  initialOpening: string;
  initialClosing: string;
  initialPricePerDay: number;
  /** Sıkışık varyant (panel sekmesi) */
  compact?: boolean;
};

export default function PartnerShopSettingsForm({
  shopId,
  initialCapacity,
  initialOpening,
  initialClosing,
  initialPricePerDay,
  compact = false,
}: Props) {
  const t = useTranslations("Partner");
  const router = useRouter();
  const [capacity, setCapacity] = useState(initialCapacity);
  const [openingTime, setOpeningTime] = useState(initialOpening);
  const [closingTime, setClosingTime] = useState(initialClosing);
  const [pricePerDay, setPricePerDay] = useState(initialPricePerDay);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleSave = async () => {
    setIsUpdating(true);
    try {
      await updateShopSettingsAction(shopId, {
        capacity,
        openingTime,
        closingTime,
        pricePerDay,
      });
      router.refresh();
      alert("Ayarlar güncellendi.");
    } finally {
      setIsUpdating(false);
    }
  };

  const wrap = compact ? "flex flex-col gap-6" : "flex flex-col gap-8 max-w-md mx-auto w-full";

  return (
    <section
      className={`bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50 flex flex-col gap-6 ${compact ? "" : "min-h-[50vh]"}`}
    >
      <h2 className={`font-black tracking-tight ${compact ? "text-lg" : "text-xl"}`}>
        {t("settings")}
      </h2>

      <div className={wrap}>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              {t("capacity")}
            </label>
            <div className="flex items-center gap-4">
              <Luggage size={20} className="text-gray-300" />
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 0)}
                className="flex-1 bg-gray-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
              Günlük Birim Fiyat (₺)
            </label>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-100 flex items-center justify-center rounded-xl text-orange-600 font-black font-sans">
                ₺
              </div>
              <input
                type="number"
                value={pricePerDay}
                onChange={(e) => setPricePerDay(parseFloat(e.target.value) || 0)}
                className="flex-1 bg-gray-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Açılış
              </label>
              <div className="flex items-center gap-4">
                <Clock size={20} className="text-gray-300" />
                <input
                  type="text"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-orange-500 transition-all text-center"
                  placeholder="09:00"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block">
                Kapanış
              </label>
              <div className="flex items-center gap-4">
                <Clock size={20} className="text-gray-300" />
                <input
                  type="text"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="w-full bg-gray-50 p-4 rounded-2xl font-bold outline-none border border-transparent focus:border-orange-500 transition-all text-center"
                  placeholder="20:00"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={isUpdating}
          className="w-full bg-orange-600 hover:bg-orange-700 py-5 rounded-[2rem] text-white font-black shadow-xl shadow-orange-100 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-60"
        >
          {isUpdating ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <Settings size={20} />
          )}
          {t("saveSettings")}
        </button>
      </div>
    </section>
  );
}
