"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Users } from "lucide-react";
import { getOrCreateReferralCodeAction } from "@/actions/referral";
import { useTranslations, useLocale } from "next-intl";
import { useActionErrorText } from "@/lib/use-action-error";

/**
 * Esnaf-esnaf davet: `User.referralCode` alanını (misafir indirim koduyla
 * PAYLAŞIYOR, anlamı farklı) kullanarak paylaşılabilir bir başvuru linki
 * üretir. Link doğrudan `/register?role=PARTNER&ref=CODE`'a gidiyor —
 * `RegisterClient.tsx` `ref` parametresini okuyup başvuruya ekliyor,
 * `registerPartnerApplicationAction` de yalnızca gerçekten PARTNER rolündeki
 * bir kullanıcının kodu ise `referredByPartnerId`'yi dolduruyor.
 *
 * BİLEREK yok: otomatik bir ödül/indirim. Bu bir iş kararı — şimdilik yalnızca
 * atıf toplanıyor, admin dilerse manuel değerlendirir.
 */
export default function PartnerReferralCard() {
  const t = useTranslations("Partner");
  const errorText = useActionErrorText();
  const locale = useLocale();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://bagajpark.com";

  const handleReveal = () => {
    startTransition(async () => {
      const res = await getOrCreateReferralCodeAction();
      if (res.success) {
        setCode(res.code);
      } else {
        // `res.error` bir `Errors.*` ANAHTARI; ham basiliyordu.
        setError(errorText(res.error));
      }
    });
  };

  const handleCopy = async () => {
    if (!code) return;
    const shareUrl = `${baseUrl}/${locale}/register?role=PARTNER&ref=${code}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ui-card p-5 md:rounded-4xl md:p-6">
      <div className="mb-2 flex items-center gap-2">
        <Users size={18} className="text-orange-500" />
        <h2 className="text-sm font-bold text-gray-900">{t("referralTitle")}</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500">{t("referralBody")}</p>

      {!code ? (
        <button
          onClick={handleReveal}
          disabled={isPending}
          className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
        >
          {isPending ? t("referralLoading") : t("referralReveal")}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-center">
            <span className="font-mono text-base font-bold tracking-widest text-orange-700">
              {code}
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="rounded-xl bg-orange-100 p-2.5 transition-colors hover:bg-orange-200"
            title={t("referralCopyTitle")}
          >
            {copied ? (
              <Check size={18} className="text-green-600" />
            ) : (
              <Copy size={18} className="text-orange-600" />
            )}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
