"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Luggage, Settings, CheckCircle, Phone, MapPin , AlertTriangle } from "lucide-react";
import { updateShopSettingsAction } from "@/actions/shop";
import { updatePartnerPhoneAction } from "@/actions/partner";
import { isValidPartnerTrPhone } from "@/lib/netgsm";
import { useActionErrorText } from "@/lib/use-action-error";
import dynamic from "next/dynamic";

const LocationPicker = dynamic(() => import("./LocationPicker"), { ssr: false });

type Props = {
  shopId: string;
  initialCapacity: number;
  initialOpening: string;
  initialClosing: string;
  initialPricePerDay: number;
  /** Platform piyasa fiyatı — min/max limitlerini belirler */
  marketPrice: number;
  /** Sıkışık varyant (panel sekmesi) */
  compact?: boolean;
  /** Netgsm: yeni rezervasyon SMS — dükkan sahibi GSM */
  initialPhone?: string;
  /** Adres bilgileri */
  initialAddress?: string;
  initialCity?: string;
  initialDistrict?: string;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
};

export default function PartnerShopSettingsForm({
  shopId,
  initialCapacity,
  initialOpening,
  initialClosing,
  initialPricePerDay,
  marketPrice,
  compact = false,
  initialPhone = "",
  initialAddress = "",
  initialCity = "",
  initialDistrict = "",
  initialLatitude = null,
  initialLongitude = null,
}: Props) {
  const t = useTranslations("Partner");
  const tErrors = useTranslations("Errors");
  const errorText = useActionErrorText();
  const router = useRouter();
  const [capacity, setCapacity] = useState(initialCapacity);
  const [openingTime, setOpeningTime] = useState(initialOpening);
  const [closingTime, setClosingTime] = useState(initialClosing);
  const [pricePerDay, setPricePerDay] = useState(initialPricePerDay);
  const [partnerPhone, setPartnerPhone] = useState(initialPhone);
  /**
   * Ayar değişikliğinin MEVCUT rezervasyonlara etkisi (`ShopSettingsImpact`).
   * Kayıt başarılı olsa bile gösterilir: saat daraltmak zaten kabul edilmiş
   * rezervasyonları imkânsız hâle getirebiliyor ve esnaf bunu tezgâhta
   * öğreniyordu.
   */
  const [impact, setImpact] = useState<{
    bookingsOutsideHours: number;
    bagsOverCapacity: number;
  } | null>(null);
  const [location, setLocation] = useState({
    address: initialAddress,
    city: initialCity,
    district: initialDistrict,
    latitude: initialLatitude,
    longitude: initialLongitude,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const minPrice = Math.round(marketPrice / 2);
  const maxPrice = marketPrice * 2;
  const minCapacity = 1;
  const maxCapacity = 100_000;

  const handlePriceChange = (val: number) => {
    setPricePerDay(val);
    if (val < minPrice || val > maxPrice) {
      setPriceError(t("priceOutOfRange", { min: minPrice, max: maxPrice }));
    } else {
      setPriceError(null);
    }
  };

  const handleCapacityChange = (val: number) => {
    setCapacity(val);
    if (val < minCapacity || val > maxCapacity) {
      setCapacityError(t("capacityOutOfRange", { min: minCapacity, max: maxCapacity }));
    } else {
      setCapacityError(null);
    }
  };

  const handleSave = async () => {
    if (priceError || capacityError) return;
    if (pricePerDay < minPrice || pricePerDay > maxPrice) {
      setPriceError(t("priceOutOfRange", { min: minPrice, max: maxPrice }));
      return;
    }
    if (capacity < minCapacity || capacity > maxCapacity) {
      setCapacityError(t("capacityOutOfRange", { min: minCapacity, max: maxCapacity }));
      return;
    }
    setIsUpdating(true);
    setSaved(false);
    setPhoneError(null);
    if (!isValidPartnerTrPhone(partnerPhone)) {
      setPhoneError(tErrors("invalidTrPhone"));
      setIsUpdating(false);
      return;
    }
    try {
      const shopRes = await updateShopSettingsAction(shopId, {
        capacity,
        openingTime,
        closingTime,
        pricePerDay,
        address: location.address || undefined,
        city: location.city || undefined,
        district: location.district || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
      });
      if (!shopRes.success) {
        // `shopRes.error` bir "Errors.x" anahtaridir, ham metin degil --
        // cevrilmeden basilirsa alanda birebir "Errors.invalidData" yazardi
        // (asagidaki phoneRes ayni sinifi zaten dogru ele aliyordu).
        setPhoneError(errorText(shopRes.error));
        return;
      }
      /*
        AYAR DEGISIKLIGININ SONUCU SOYLENIYOR. Kayit basarili -- ama saat
        daraltmak, zaten kabul edilmis rezervasyonlari IMKANSIZ hale
        getirebiliyor: check-in kapisi `SHOP_CLOSED` doner ve misafir valiziyle
        tezgahta reddedilir. Esnaf bunu ancak o an ogreniyordu.

        Degisiklik ENGELLENMIYOR (esnafin saatini degistirme hakki var),
        yalnizca sonucu goruniyor ki etkilenen misafirlere ulasabilsin.
      */
      setImpact(shopRes.impact ?? null);

      const phoneRes = await updatePartnerPhoneAction(partnerPhone);
      if (!phoneRes.success) {
        setPhoneError(errorText(phoneRes.error));
        return;
      }
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

  const impactMessages = [
    impact && impact.bookingsOutsideHours > 0
      ? t("settingsImpactHours", { count: impact.bookingsOutsideHours })
      : null,
    impact && impact.bagsOverCapacity > 0
      ? t("settingsImpactCapacity", { count: impact.bagsOverCapacity })
      : null,
  ].filter(Boolean) as string[];

  const wrap = compact ? "flex flex-col gap-6" : "flex flex-col gap-8 max-w-md mx-auto w-full";

  return (
    <section
      className={`bg-white p-8 rounded-4xl shadow-xl border border-gray-50 flex flex-col gap-6 ${compact ? "" : "min-h-[50vh]"}`}
    >
      <h2 className={`font-black tracking-tight ${compact ? "text-lg" : "text-xl"}`}>
        {t("settings")}
      </h2>

      <div className={wrap}>
        <div className="flex flex-col gap-4">
          {/* Kapasite */}
          <div>
            <label className="ui-kicker mb-2 block">
              {t("capacity")}
            </label>
            <div className="flex items-center gap-4">
              <Luggage size={20} className="text-gray-300" />
              <input
                type="number"
                data-testid="partner-settings-capacity"
                value={capacity}
                min={minCapacity}
                max={maxCapacity}
                step={1}
                onChange={(e) => handleCapacityChange(parseInt(e.target.value, 10) || 0)}
                className={`ui-field flex-1 rounded-2xl ${
                  capacityError ? "border-red-400 bg-red-50" : ""
                }`}
              />
            </div>
            {capacityError ? (
              <p className="ui-state ui-state-error mt-1.5">{capacityError}</p>
            ) : (
              <p className="ui-body-sm mt-1.5">
                {t("capacityRangeHint", { min: minCapacity, max: maxCapacity })}
              </p>
            )}
          </div>

          {/* Günlük fiyat */}
          <div>
            <label className="ui-kicker mb-2 block">
              {t("dailyPrice")}
            </label>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-100 flex items-center justify-center rounded-xl text-orange-600 font-black font-sans">
                ₺
              </div>
              <input
                type="number"
                value={pricePerDay}
                min={minPrice}
                max={maxPrice}
                step={1}
                onChange={(e) => handlePriceChange(parseFloat(e.target.value) || 0)}
                className={`ui-field flex-1 rounded-2xl ${
                  priceError ? "border-red-400 bg-red-50" : ""
                }`}
              />
            </div>
            {priceError ? (
              <p className="ui-state ui-state-error mt-1.5">{priceError}</p>
            ) : (
              <p className="ui-body-sm mt-1.5">
                {t("priceRangeHint", { min: minPrice, max: maxPrice })}
              </p>
            )}
          </div>

          {/* SMS telefon */}
          <div>
            {/*
              `htmlFor`/`id` BAGI SART: gorsel bir etiketin yanindaki girdi,
              ekran okuyucu icin etiketli DEGILDIR. Bag kurulmadiginda okuyucu
              yalnizca placeholder'i okur -- o da yazmaya baslayinca kaybolur.
            */}
            <label htmlFor="partner-sms-phone" className="ui-kicker mb-2 block">
              {t("smsNotifyPhone")}
            </label>
            <div className="flex items-center gap-4">
              <Phone size={20} className="text-gray-300 shrink-0" />
              <input
                id="partner-sms-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="5xx xxx xx xx"
                value={partnerPhone}
                onChange={(e) => setPartnerPhone(e.target.value)}
                className="ui-field flex-1 rounded-2xl"
              />
            </div>
            <p className="ui-body-sm mt-1.5">{t("smsNotifyPhoneHint")}</p>
            {phoneError ? (
              <p className="ui-state ui-state-error mt-1.5">{phoneError}</p>
            ) : null}
          </div>

          {/* Çalışma saatleri */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="ui-kicker mb-2 block">
                {t("openingTime")}
              </label>
              <div className="flex items-center gap-4">
                <Clock size={20} className="text-gray-300" />
                <input
                  type="time"
                  value={openingTime}
                  onChange={(e) => setOpeningTime(e.target.value)}
                  className="ui-field w-full rounded-2xl text-center"
                />
              </div>
            </div>
            <div>
              <label className="ui-kicker mb-2 block">
                {t("closingTime")}
              </label>
              <div className="flex items-center gap-4">
                <Clock size={20} className="text-gray-300" />
                <input
                  type="time"
                  value={closingTime}
                  onChange={(e) => setClosingTime(e.target.value)}
                  className="ui-field w-full rounded-2xl text-center"
                />
              </div>
            </div>
          </div>

          {/* ── Konum / Adres bölümü ── */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} className="text-orange-500" />
              <span className="text-sm font-black text-gray-700">Konum & Adres</span>
            </div>
            <LocationPicker value={location} onChange={setLocation} />
          </div>
        </div>

        {saved && (
          <div className="ui-state ui-state-success flex items-center gap-2 rounded-2xl px-4 py-3">
            <CheckCircle size={16} />
            {t("settingsSaved")}
          </div>
        )}

        {/*
          UYARI, HATA DEGIL. Kayit basarili -- ama saat daraltmak zaten kabul
          edilmis rezervasyonlari imkansiz hale getirebiliyor. Esnaf bunu ancak
          tezgahta, misafir valiziyle karsisindayken ogreniyordu.
        */}
        {impactMessages.length > 0 && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              {impactMessages.map((m) => (
                <p key={m}>{m}</p>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={isUpdating || !!priceError || !!capacityError}
          className="btn-ui btn-ui-lg btn-ui-primary w-full rounded-3xl gap-3"
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
