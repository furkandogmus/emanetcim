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
    <div className="w-full max-w-4xl mx-auto bg-white border border-gray-200 shadow-xl rounded-2xl p-4 sm:p-6 flex flex-col lg:flex-row items-stretch lg:items-end gap-3">
      {/*
        `min-w-0`: flex ogesi varsayilan olarak `min-width: auto` alir, yani
        icerigi kadar genis kalir ve KUCULEMEZ. Tarih alanlari kuculemeyince
        satir karta sigmiyor ve `shrink-0` olan buton kartin DISINA tasiyor.

        Olculdu (2026-08-31, 640-1440 px arasi her genislikte): TR 43 px, DE
        41 px, FR 71 px kartin disinda. Ingilizce'de gorunmuyordu, cunku onceki
        turda etiketi kisaltmistim -- yani hatayi tek dilde kapatip yapisal
        sebebi birakmisim. Ayni tuzak `ShopListItem`'da da yaziyor.

        Yalniz `min-w-0` yetmiyor: alanlar kuculunce bu sefer tarih metni
        DateTimePicker'daki `truncate` ile sessizce kirpiliyordu ("1.09.2026 0"
        gibi -- gecerli bir deger gibi duran, aslinda yarim bir tarih). Yani
        kart tek satir icin yapisal olarak dardi. Bu yuzden `max-w-4xl` ve
        satira gecis esigi `sm` yerine `lg`: 1024 pikselin altinda alanlar alt
        alta, tarih tam okunur; ustunde tek satir ve hepsi sigar.
      */}
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <label className="id-eyebrow text-gray-400">
          {t("searchCheckIn")}
        </label>
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 focus-within:border-orange-200 transition-colors">
          <DateTimePicker value={checkIn} onChange={setCheckIn} testId="home-checkin" ariaLabel={t("searchCheckIn")} iconSize={18} />
        </div>
      </div>
      <div className="min-w-0 flex-1 flex flex-col gap-1.5">
        <label className="id-eyebrow text-gray-400">
          {t("searchCheckOut")}
        </label>
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 focus-within:border-orange-200 transition-colors">
          <DateTimePicker value={checkOut} onChange={setCheckOut} testId="home-checkout" ariaLabel={t("searchCheckOut")} iconSize={18} />
        </div>
      </div>
      <div className="w-full lg:w-24 flex flex-col gap-1.5">
        <label className="id-eyebrow text-gray-400">
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
        /*
          `whitespace-nowrap shrink-0`: etiket dile gore uzuyor ve bu buton bir
          flex satirinin icinde. Almancada ("Aufbewahrung finden") ve Ingilizcede
          buton UC SATIRA sariyordu, yani satirin iki katina cikip tarih
          alanlarinin hizasini bozuyordu (2026-08-31 ekran goruntusu). Turkce'de
          gorunmeyen bir hata: en kisa etiket Turkce.
        */
        className="w-full lg:w-auto shrink-0 whitespace-nowrap bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-xl font-black text-sm transition-all shadow-lg shadow-orange-200 hover:shadow-orange-300 flex items-center justify-center gap-2 cursor-pointer"
      >
        <Search size={18} />
        {t("findShops")}
      </button>
    </div>
  );
}
