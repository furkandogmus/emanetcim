"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, X } from "lucide-react";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";

export type CheckoutSeal = { sealNumber: number; bagIndex: number; bagSize: string };

interface CheckoutSealsDialogProps {
  bookingId: string;
  seals: CheckoutSeal[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (bookingId: string) => void;
}

/**
 * Teslim onayı: check-in'de kaydedilen mühürler tek tek işaretlenir.
 *
 * Mührün kanıt zinciri iki uçludur — giriş kaydı tek başına yarım. Esnaf
 * hangi mührü geri verdiğini görmeden "teslim ettim" derse, çıkışta mührün
 * sağlam olup olmadığı hiçbir yerde teyit edilmemiş olur.
 */
export default function CheckoutSealsDialog({
  bookingId,
  seals,
  busy,
  onClose,
  onConfirm,
}: CheckoutSealsDialogProps) {
  const t = useTranslations("Partner");
  useModalBehavior({ open: true, onClose });
  const [confirmed, setConfirmed] = useState<number[]>([]);

  const toggleCheckoutSeal = (sealNumber: number) => {
    setConfirmed((prev) =>
      prev.includes(sealNumber) ? prev.filter((n) => n !== sealNumber) : [...prev, sealNumber],
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-checkout-seals-title"
        aria-describedby="partner-checkout-seals-desc"
        className="ui-card my-8 flex w-full max-w-md flex-col gap-5 p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3
              id="partner-checkout-seals-title"
              className="text-lg font-black tracking-tight text-gray-900"
            >
              {t("checkoutSealsTitle")}
            </h3>
            <p
              id="partner-checkout-seals-desc"
              className="text-xs leading-relaxed text-gray-500"
            >
              {t("checkoutSealConfirmEach")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("checkoutCancel")}
            className="shrink-0 rounded-full bg-gray-100 p-2 text-gray-500 transition-colors hover:bg-gray-200"
          >
            <X size={18} />
          </button>
        </div>

        <ul className="flex flex-col gap-2">
          {seals.map((seal) => {
            const checked = confirmed.includes(seal.sealNumber);
            return (
              <li key={`${seal.bagIndex}-${seal.sealNumber}`}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                    checked
                      ? "border-orange-200 bg-orange-50"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleCheckoutSeal(seal.sealNumber)}
                    className="h-5 w-5 shrink-0 accent-orange-600"
                  />
                  <span className="flex-1 text-xs font-bold text-gray-600">
                    {t("sealRowLabel", {
                      index: seal.bagIndex + 1,
                      size: seal.bagSize,
                    })}
                  </span>
                  <span className="text-sm font-black tabular-nums text-gray-900">
                    {t("sealNumberShort")}
                    {seal.sealNumber}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={
              confirmed.length !== seals.length ||
              busy
            }
            onClick={() => onConfirm(bookingId)}
            className="btn-ui btn-ui-md btn-ui-primary w-full disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              t("confirmCheckoutSeals")
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-ui btn-ui-md btn-ui-ghost w-full"
          >
            {t("checkoutCancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
