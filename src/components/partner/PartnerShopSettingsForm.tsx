"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Luggage, Settings, CheckCircle, Phone, MapPin } from "lucide-react";
import { updateShopSettingsAction } from "@/actions/shop";
import { updatePartnerPhoneAction } from "@/actions/partner";
import { isValidPartnerTrPhone } from "@/lib/netgsm";
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
  const router = useRouter();
  const [capacity, setCapacity] = useState(initialCapacity);
  const [openingTime, setOpeningTime] = useState(initialOpening);
  const [closingTime, setClosingTime] = useState(initialClosing);
  const [pricePerDay, setPricePerDay] = useState(initialPricePerDay);
  const [partnerPhone, setPartnerPhone] = useState(initialPhone);
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
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const minPrice = Math.round(marketPrice / 2);
  const maxPrice = marketPrice * 2;

  const handlePriceChange = (val: number) => {
    setPricePerDay(val);
    if (val < minPrice || val > maxPrice) {
      setPriceError(t("priceOutOfRange", { min: minPrice, max: maxPrice }));
    } else {
      setPriceError(null);
    }
  };

  const handleSave = async () => {
    if (priceError) return;
    if (pricePerDay < minPrice || pricePerDay > maxPrice) {
      setPriceError(t("priceOutOfRange", { min: minPrice, max: maxPrice }));
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
        setPhoneError(shopRes.error ?? tErrors("generic"));
        return;
      }
      const phoneRes = await updatePartnerPhoneAction(partnerPhone);
      if (!phoneRes.success) {
        const code = phoneRes.error;
        setPhoneError(
          code?.startsWith("Errors.")
            ? tErrors(code.slice("Errors.".length) as Parameters<typeof tErrors>[0])
            : (code ?? tErrors("generic"))
        );
        return;
      }
      router.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setIsUpdating(false);
    }
  };

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
                onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 0)}
                className="ui-field flex-1 rounded-2xl"
              />
            </div>
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
            <label className="ui-kicker mb-2 block">
              {t("smsNotifyPhone")}
            </label>
            <div className="flex items-center gap-4">
              <Phone size={20} className="text-gray-300 shrink-0" />
              <input
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

        <button
          type="button"
          onClick={handleSave}
          disabled={isUpdating || !!priceError}
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
