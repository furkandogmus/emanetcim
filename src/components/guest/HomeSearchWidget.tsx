"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { useRouter } from "@/i18n/routing";
import DateTimePicker from "@/components/ui/DateTimePicker";

type Props = {
  /**
   * Varsayılan bırakış/alış değerleri SUNUCUDA üretilip prop olarak geliyor.
   *
   * Neden: burada `new Date()` çağırmak sunucuda (konteyner UTC) ve istemcide
   * (ziyaretçinin saat dilimi) farklı metin üretiyordu; bu değer input'un
   * `value`'su olduğu için React hydration'da metin uyuşmazlığı (#418) veriyor ve
   * ağacı istemcide baştan render ediyordu. Belirtisi ana sayfada titreme ve ilk
   * dokunuşun kaybolmasıydı. Değeri tek bir yerde (sunucuda, sabit saat diliminde)
   * üretmek uyuşmazlığı kaynağında bitiriyor.
   */
  defaultCheckIn: string;
  defaultCheckOut: string;
};

export default function HomeSearchWidget({
  defaultCheckIn,
  defaultCheckOut,
}: Props) {
  const t = useTranslations("Guest");
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [bags, setBags] = useState(1);

  const handleSearch = () => {
    const params = new URLSearchParams({
      checkIn,
      checkOut,
      bags: String(bags),
    });
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
      <div className="flex-1 flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {t("searchCheckIn")}
        </label>
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 focus-within:border-orange-200 transition-colors">
          <DateTimePicker value={checkIn} onChange={setCheckIn} testId="home-checkin" ariaLabel={t("searchCheckIn")} iconSize={18} />
        </div>
      </div>
      <div className="flex-1 flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {t("searchCheckOut")}
        </label>
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 focus-within:border-orange-200 transition-colors">
          <DateTimePicker value={checkOut} onChange={setCheckOut} testId="home-checkout" ariaLabel={t("searchCheckOut")} iconSize={18} />
        </div>
      </div>
      <div className="w-full sm:w-24 flex flex-col gap-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          {t("searchBagCount")}
        </label>
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
          <button
            type="button"
            onClick={() => setBags(Math.max(1, bags - 1))}
            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-sm font-black text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            −
          </button>
          <span className="flex-1 text-center font-black text-gray-900 text-sm">{bags}</span>
          <button
            type="button"
            onClick={() => setBags(Math.min(20, bags + 1))}
            className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-sm font-black text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={handleSearch}
        className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-xl font-black text-sm transition-all shadow-lg shadow-orange-200 hover:shadow-orange-300 flex items-center justify-center gap-2 cursor-pointer"
      >
        <Search size={18} />
        {t("findShops")}
      </button>
    </div>
  );
}
