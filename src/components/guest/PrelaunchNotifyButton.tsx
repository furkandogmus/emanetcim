"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useModalBehavior } from "@/lib/hooks/useModalBehavior";
import { useActionErrorText } from "@/lib/use-action-error";
import { registerPrelaunchInterestAction } from "@/actions/prelaunch";
import { trackEvent } from "@/lib/analytics-client";

/**
 * Talep testi noktalarinda rezervasyon dugmesinin YERINE gecer.
 *
 * NEDEN BOYLE: bu noktalar aramada normal gorunur ve olculmek istenen sey
 * "kac kisi burada rezervasyon yapmaya kalkisti"dir. Dugme o yuzden rezervasyon
 * dugmesi gibi durur ve basildiginda `prelaunch_booking_attempt` yazilir --
 * ISTE OLCULEN SINYAL BUDUR. Hemen ardindan kisiye durum durustce soylenir:
 * burasi henuz acilmadi, istersen acilinca haber verelim.
 *
 * Kritik olan sinir: kimseye "bavulunu buraya birak" diyen onaylanmis bir
 * rezervasyon verilmez. Sunucu tarafi kapisi ayrica var
 * (`createInitialBooking` -> `BookingShopPrelaunchError`), cunku arayuz tek
 * basina yeterli degil: mobil uc ya da dogrudan API cagrisi ayni yolu deneyebilir.
 */
export default function PrelaunchNotifyButton({
  shopId,
  shopName,
  className,
}: {
  shopId: string;
  shopName: string;
  className?: string;
}) {
  const t = useTranslations("Guest");
  const tCommon = useTranslations("Common");
  const errorText = useActionErrorText();

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useModalBehavior({ open, onClose: () => setOpen(false) });

  function handleOpen() {
    // Rezervasyon KALKISMASI -- e-posta birakilmasa bile olculur. Talep
    // haritasinin ana girdisi bu; e-posta bir adim otesidir.
    trackEvent("prelaunch_booking_attempt", { shopId });
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await registerPrelaunchInterestAction({ shopId, email });
      if (!res.success) {
        toast.error(errorText(res.error));
        return;
      }
      setDone(true);
      toast.success(
        res.alreadyRegistered
          ? t("prelaunchAlreadyRegistered")
          : t("prelaunchRegistered"),
      );
    });
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className={className}>
        {t("prelaunchCta")}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="prelaunch-title"
            className="id-surface bg-white shadow-2xl p-8 w-full max-w-md flex flex-col gap-5"
          >
            <h2 id="prelaunch-title" className="text-xl id-display text-gray-900">
              {t("prelaunchTitle", { shop: shopName })}
            </h2>

            <p className="text-sm text-gray-600">{t("prelaunchBody")}</p>

            {done ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-gray-900 text-white px-6 py-3 rounded-xl text-sm font-bold"
              >
                {tCommon("close")}
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="prelaunch-email"
                    className="text-xs id-eyebrow text-gray-500"
                  >
                    {t("prelaunchEmailLabel")}
                  </label>
                  <input
                    id="prelaunch-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-label={t("prelaunchEmailLabel")}
                    placeholder={t("prelaunchEmailPlaceholder")}
                    className="border border-gray-200 rounded-xl px-4 py-3 text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex-1 id-accent-bg text-white px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-60"
                  >
                    {pending ? tCommon("loading") : t("prelaunchSubmit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="px-6 py-3 rounded-xl text-sm font-bold text-gray-600"
                  >
                    {tCommon("cancel")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
