"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useTranslations } from "next-intl";

/**
 * Rezervasyon detayında checkout ile aynı QR içeriği (qrCodeToken).
 */
export default function BookingQrDisplay({ token }: { token: string | null }) {
  const t = useTranslations("Guest");
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    QRCode.toDataURL(token, { width: 220, margin: 2 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [token]);

  if (!token) {
    return (
      <p className="text-xs text-center text-gray-400 font-medium px-4">{t("qrPending")}</p>
    );
  }

  if (!dataUrl) {
    return (
      <div className="w-48 h-48 bg-gray-50 rounded-3xl animate-pulse border border-gray-100" />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt={t("qrAlt")} className="w-48 h-48 object-contain rounded-2xl" />
  );
}
