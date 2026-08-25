"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, Check, Gift } from "lucide-react";
import { getOrCreateReferralCodeAction } from "@/actions/referral";

type ReferralCodeCardProps = {
  locale: string;
  title: string;
  body: string;
  revealLabel: string;
  loadingLabel: string;
  copyTitle: string;
};

export default function ReferralCodeCard({
  locale,
  title,
  body,
  revealLabel,
  loadingLabel,
  copyTitle,
}: ReferralCodeCardProps) {
  const tErrors = useTranslations("Errors");
  const tCommon = useTranslations("Common");
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
        // `res.error` bir "Errors.x" anahtaridir, ham metin degil.
        const key = res.error === "Errors.authRequired" ? "authRequired" : "referralCodeFailed";
        setError(tErrors(key));
      }
    });
  };

  const handleCopy = async () => {
    if (!code) return;
    // Paylaşılan link, misafirin AN O ANKİ dilinde açılmalı — sabit `/tr`
    // İngilizce/diğer dillerdeki kullanıcıyı yanlış locale'e yönlendiriyordu.
    const shareUrl = `${baseUrl}/${locale}?ref=${code}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // `clipboard.writeText` reddedilirse (izin yok, guvensiz baglam vb.)
      // hicbir sey olmuyordu -- kullanici kopyaladigini sanip yapistiriyordu.
      setError(tCommon("linkCopyFailed"));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-orange-100 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Gift size={18} className="text-orange-500" />
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">{body}</p>

      {!code ? (
        <button
          type="button"
          onClick={handleReveal}
          disabled={isPending}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? loadingLabel : revealLabel}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-center">
            <span className="font-mono font-bold text-orange-700 tracking-widest text-base">{code}</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copyTitle}
            className="p-2.5 bg-orange-100 hover:bg-orange-200 rounded-xl transition-colors"
            title={copyTitle}
          >
            {copied ? (
              <Check size={18} className="text-green-600" />
            ) : (
              <Copy size={18} className="text-orange-600" />
            )}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
