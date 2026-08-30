"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, MapPinPlus } from "lucide-react";
import { useActionErrorText } from "@/lib/use-action-error";
import {
  registerPrelaunchInterestAction,
  registerPrelaunchWantAction,
} from "@/actions/prelaunch";
import { trackEvent } from "@/lib/analytics-client";

/**
 * Talep testi noktasinin ASIL yuzeyi — sayfanin icinde, gorunur.
 *
 * NEDEN MODALIN YERINE (2026-08-31): once "Yakinda" yazan bir dugme vardi, ona
 * basinca modal aciliyor, modalda e-posta isteniyordu. Yani olcmek istedigimiz
 * sinyalin onune IKI adim koymustuk ve ikincisi (e-posta) yuksek surtunmeli.
 * Sorulacak ilk soru ucuz olmali: "burada bir nokta olsun mu?" Tek tik onu
 * sorar; sayi ANINDA artar ve misafir kendi tikladiginin sayildigini gorur.
 *
 * IKI AYRI SINYAL, KARISTIRILMAZ:
 *   tek tik  -> ilginin GENISLIGI  (`PrelaunchWant`, cerezle dedupe)
 *   e-posta  -> niyetin DERINLIGI  (`PrelaunchInterest`, e-posta ile dedupe)
 * E-posta formu tikin ARDINDAN degil, YANINDA duruyor: isteyen kisi ikinci bir
 * dugme kesfetmek zorunda kalmasin diye.
 */
export default function PrelaunchDemandPanel({
  shopId,
  shopName,
  initialWantCount,
}: {
  shopId: string;
  shopName: string;
  initialWantCount: number;
}) {
  const t = useTranslations("Guest");
  const errorText = useActionErrorText();

  const [count, setCount] = useState(initialWantCount);
  const [wanted, setWanted] = useState(false);
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleWant() {
    if (wanted) return;
    // Merak sinyali: e-posta birakilmasa bile olculur.
    trackEvent("prelaunch_booking_attempt", { shopId });
    startTransition(async () => {
      const res = await registerPrelaunchWantAction({ shopId });
      if (!res.success) {
        toast.error(errorText(res.error));
        return;
      }
      /*
        Sunucudan donen TAZE toplam yaziliyor, yerel bir `count + 1` degil:
        ayni tarayici daha once tiklamissa sayi artmamali ve ekranda gercek
        rakam durmali.
      */
      setCount(res.count);
      setWanted(true);
      toast.success(t("prelaunchWantDone"));
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await registerPrelaunchInterestAction({ shopId, email });
      if (!res.success) {
        toast.error(errorText(res.error));
        return;
      }
      setSubscribed(true);
      toast.success(
        res.alreadyRegistered
          ? t("prelaunchAlreadyRegistered")
          : t("prelaunchRegistered"),
      );
    });
  }

  return (
    <section
      data-testid="prelaunch-demand-panel"
      className="id-surface border border-gray-100 bg-white p-6 shadow-sm flex flex-col gap-4"
      aria-labelledby="prelaunch-demand-title"
    >
      <div className="flex flex-col gap-1">
        <span className="text-xs id-eyebrow id-accent">
          {t("prelaunchBadge")}
        </span>
        <h2 id="prelaunch-demand-title" className="text-lg id-display text-gray-900">
          {t("prelaunchTitle", { shop: shopName })}
        </h2>
        <p className="text-sm text-gray-600">{t("prelaunchBody")}</p>
      </div>

      <button
        type="button"
        onClick={handleWant}
        disabled={pending || wanted}
        data-testid="prelaunch-want-button"
        className="btn-ui btn-ui-lg btn-ui-primary w-full flex items-center justify-center gap-2"
      >
        {wanted ? <Check size={18} /> : <MapPinPlus size={18} />}
        {wanted ? t("prelaunchWantDone") : t("prelaunchWantCta")}
      </button>

      <p className="text-sm text-gray-500" aria-live="polite">
        {count > 0 ? t("prelaunchWantCount", { count }) : t("prelaunchWantFirst")}
      </p>

      {/*
        E-posta formu KAPALI DEGIL, acikta. Onceki halinde modalin dibindeydi ve
        oraya ulasmak icin once baska bir dugmeye basmak gerekiyordu; ikinci ve
        daha degerli sinyal bu yuzden neredeyse hic toplanmiyordu.
      */}
      <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
        <p className="text-sm text-gray-600">{t("prelaunchEmailHint")}</p>
        {subscribed ? (
          <p className="text-sm text-emerald-700 font-bold">
            {t("prelaunchRegistered")}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <label htmlFor="prelaunch-email" className="sr-only">
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
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={pending}
              className="btn-ui btn-ui-md btn-ui-secondary shrink-0"
            >
              {t("prelaunchSubmit")}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
