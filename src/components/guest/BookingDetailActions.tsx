"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { buildDirectionsUrl } from "@/lib/directions-url";
import { waMeUrl } from "@/lib/whatsapp";
import { XCircle, Calendar as CalendarIcon, Phone, ExternalLink, MessageCircle } from "lucide-react";
import { cancelBookingAction } from "@/actions/booking";
import { toast } from "sonner";
import { useActionErrorText } from "@/lib/use-action-error";

type Props = {
  bookingId: string;
  canCancel: boolean;
  checkInIso: string;
  checkOutIso: string;
  shopName: string;
  shopAddress: string | null;
  shopLat?: number | null;
  shopLng?: number | null;
  shopPhone: string | null;
};

export default function BookingDetailActions({
  bookingId,
  canCancel,
  checkInIso,
  checkOutIso,
  shopName,
  shopAddress,
  shopLat,
  shopLng,
  shopPhone,
}: Props) {
  const t = useTranslations("Guest");
  /*
    Hazir metin: misafirin dil bilmeden bile bir seyler yazabilmesi icin. Kisa
    kod esnafin panelinde de arattigi referans.
  */
  const shopWaUrl = waMeUrl(
    shopPhone,
    t("whatsAppShopMessage", { code: bookingId.slice(0, 8).toUpperCase() }),
  );
  const errorText = useActionErrorText();
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    if (!confirm(t("cancelBookingConfirm"))) return;
    setCancelling(true);
    /*
      `cancelBookingAction` `getBookingDetails` cagrisi kendi try/catch'inin
      DISINDA -- beklenmedik bir DB hatasinda hala firlar. try/catch olmadan
      setCancelling hic sifirlanmiyor, buton "iptal ediliyor" durumunda
      SONSUZA dek kaliyordu.
    */
    try {
      const res = await cancelBookingAction(bookingId);
      if (res.success) {
        toast.success(t("bookingCancelled"));
        window.location.reload();
      } else {
        // `res.error` bir `Errors.*` ANAHTARI; eskiden ekrana aynen basiliyordu.
        toast.error(errorText(res.error, t("cancelFailed")));
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : undefined;
      toast.error(errorText(raw, t("cancelFailed")));
    } finally {
      setCancelling(false);
    }
  };

  const googleCalUrl = () => {
    const start = new Date(checkInIso);
    const end = new Date(checkOutIso);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: `${t("luggageStorageAt")} ${shopName}`,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: `${t("bookingDetailCalendarDesc")}: ${shopName}${shopAddress ? `, ${shopAddress}` : ""}`,
      location: shopAddress ?? "",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  };
  /*
    Koordinat varsa koordinat: adres metni Google tarafında yeniden geocode
    ediliyor ve bizim `address` alanımız çoğu zaman ilçe/şehir kadar kaba.
    Misafir valizini taşırken tahmini bir noktaya yönlendirilmemeli.
  */
  const directionsUrl = buildDirectionsUrl({
    latitude: shopLat,
    longitude: shopLng,
    address: shopAddress,
  });


  return (
    <div className="flex flex-col gap-3">
      {canCancel && (
        <button
          type="button"
          onClick={handleCancel}
          disabled={cancelling}
          className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl border border-red-200 bg-red-50 text-red-700 text-xs id-eyebrow hover:bg-red-100 transition-colors disabled:opacity-50"
        >
          {cancelling ? (
            <div className="w-4 h-4 border-2 border-red-300 border-t-red-700 rounded-full animate-spin" />
          ) : (
            <XCircle size={16} />
          )}
          {t("cancelBooking")}
        </button>
      )}

      <a
        href={googleCalUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs id-eyebrow hover:bg-gray-50 transition-colors"
      >
        <CalendarIcon size={16} />
        {t("addToCalendar")}
      </a>

      {shopPhone && (
        <a
          href={`tel:${shopPhone}`}
          className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs id-eyebrow hover:bg-gray-50 transition-colors"
        >
          <Phone size={16} />
          {shopPhone}
        </a>
      )}

      {/*
        Dukkana WHATSAPP'tan yazma. Misafirlerin cogu yabanci: Turkiye'ye
        uluslararasi arama pahali ve karsilikli dil bilinmeden ise yaramiyor.
        Esnaf tarafinda kacan cagri = bulunamayan misafir = iptal; bu dugme iki
        tarafin da isine yariyor. Numara wa.me bicimine cevrilemezse cizilmez.
      */}
      {shopWaUrl && (
        <a
          href={shopWaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 py-3.5 text-xs id-eyebrow text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <MessageCircle size={16} />
          {t("whatsAppShop")}
        </a>
      )}

      {directionsUrl && (
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center justify-center gap-2 py-3.5 rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs id-eyebrow hover:bg-gray-50 transition-colors"
        >
          <ExternalLink size={16} />
          {t("getDirections")}
        </a>
      )}
    </div>
  );
}
