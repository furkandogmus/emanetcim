"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { reviseBagsAction } from "@/actions/partner";
import { useActionErrorText } from "@/lib/use-action-error";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";
import { formatTryCurrency } from "@/lib/currency";
import { bcp47ForUiLocale } from "@/lib/intl-locale";

/**
 * Valiz sayısı düzeltmesi — tezgahtaki en sık sürtünme.
 *
 * NEDEN VAR (2026-09-01): misafir 3 valiz için rezervasyon yapıp 4'le geliyor.
 * Bu işlem MOBİLDE vardı, WEBDE HİÇ YOKTU: üç server action yazılmış ve test
 * edilmişti ama `.tsx` içinden çağıran sıfırdı. Check-in ekranı da rezerve
 * edilen sayıdan mühür satırı ürettiği için dördüncü valize mühür bile
 * takılamıyordu.
 */

type Counts = { bagCountS: number; bagCountM: number; bagCountXl: number };

type Props = {
  bookingId: string;
  initial: Counts;
  unitPrice: number;
  onClose: () => void;
};

/** Boy başına çarpan görsel bir tahmin DEĞİL — fark sunucuda hesaplanır. */
const SIZES = [
  { key: "bagCountS" as const, label: "smallBag" },
  { key: "bagCountM" as const, label: "mediumBag" },
  { key: "bagCountXl" as const, label: "xlBag" },
];

export default function BagRevisionDialog({ bookingId, initial, unitPrice, onClose }: Props) {
  const t = useTranslations("Partner");
  const tGuest = useTranslations("Guest");
  /*
    `cancel` ve `close` `Partner` degil `Common` altinda. Ilk yazimda
    `t("cancel")` cagrilmisti ve ekranda ham anahtar ("Partner.cancel")
    goruntuleniyordu -- `locales` mandali bunu yakalayamaz cunku eksik anahtar
    EKLENMEDI, VAR OLMAYAN bir anahtar CAGRILDI. Tarayicida gorulup duzeltildi.
  */
  const tCommon = useTranslations("Common");
  const errorText = useActionErrorText();
  const bcp47 = bcp47ForUiLocale(useLocale());
  const [counts, setCounts] = useState<Counts>(initial);
  const [pending, startTransition] = useTransition();
  useModalBehavior({ open: true, onClose });

  const total = counts.bagCountS + counts.bagCountM + counts.bagCountXl;
  const initialTotal = initial.bagCountS + initial.bagCountM + initial.bagCountXl;
  const changed = total !== initialTotal || SIZES.some((s) => counts[s.key] !== initial[s.key]);

  function bump(key: keyof Counts, by: number) {
    setCounts((c) => ({ ...c, [key]: Math.max(0, Math.min(50, c[key] + by)) }));
  }

  function submit() {
    startTransition(async () => {
      const res = await reviseBagsAction({ bookingId, ...counts });
      if (res.success) {
        toast.success(
          t("bagRevisionSaved", { total: formatTryCurrency(res.newTotal, bcp47) }),
        );
        onClose();
      } else {
        toast.error(errorText(res.error));
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bag-revision-title"
        /* Yuzey KIMLIK KATMANINDAN (`.id-surface`): yaricap, kenarlik, golge
           ve zemin tek yerden gelir. Sabit bir yaricap sinifi yazmak o katmani
           baypas eder -- `design-tokens` mandali bunu sayiyor (yorumlari
           ayiklamadigi icin bu cumlede sinif ADI da yazilmiyor). */
        className="id-surface w-full max-w-md p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="bag-revision-title" className="text-lg font-black text-gray-900">
              {t("bagRevisionTitle")}
            </h2>
            <p className="mt-1 text-xs text-gray-500">{t("bagRevisionHint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2">
          {SIZES.map((s) => (
            <div key={s.key} className="flex items-center justify-between rounded-2xl bg-gray-50 px-4 py-3">
              <span className="text-sm font-semibold text-gray-700">{tGuest(s.label)}</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => bump(s.key, -1)}
                  disabled={counts[s.key] === 0 || pending}
                  aria-label={`${tGuest(s.label)} −`}
                  className="id-control flex h-8 w-8 items-center justify-center border border-gray-200 bg-white disabled:opacity-40"
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center text-base font-black tabular-nums">
                  {counts[s.key]}
                </span>
                <button
                  type="button"
                  onClick={() => bump(s.key, 1)}
                  disabled={pending}
                  aria-label={`${tGuest(s.label)} +`}
                  className="id-control flex h-8 w-8 items-center justify-center border border-gray-200 bg-white disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/*
          FARK TUTARI GOSTERILMIYOR, yalnizca valiz farki. Fiyat sunucuda
          yeniden hesaplaniyor (boy carpanlari, sigorta, `PlatformSettings`) ve
          burada tahmin uretmek, tezgahta misafire YANLIS rakam soyletebilirdi.
          Kesin tutar islem sonucunda donuyor.
        */}
        {changed && (
          <p className="mt-3 text-center text-xs font-bold text-amber-700">
            {t("bagRevisionDelta", { from: initialTotal, to: total })}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="id-control flex-1 border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700"
          >
            {tCommon("cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!changed || total === 0 || pending}
            className="id-accent-bg id-control flex-1 py-3 text-sm font-black disabled:opacity-50"
          >
            {pending ? "…" : t("bagRevisionApply")}
          </button>
        </div>
        {/* `unitPrice` yalnizca ebeveynin gecirdigi baglam; hesap sunucuda. */}
        <span className="sr-only">{unitPrice}</span>
      </div>
    </div>
  );
}
