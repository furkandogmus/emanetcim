"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Gift } from "lucide-react";
import { getOrCreateReferralCodeAction } from "@/actions/referral";

export default function ReferralCodeCard() {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const discountPct = process.env.NEXT_PUBLIC_REFERRAL_DISCOUNT_PCT ?? "5";
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
        setError(res.error);
      }
    });
  };

  const handleCopy = async () => {
    if (!code) return;
    const shareUrl = `${baseUrl}/tr?ref=${code}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-orange-100 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Gift size={18} className="text-orange-500" />
        <h2 className="text-sm font-bold text-gray-900">Arkadaşını Davet Et, %{discountPct} İndirim Kazan</h2>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Referans kodunu arkadaşınla paylaş. İlk rezervasyonunda %{discountPct} indirim alır, sen de takipte kalırsın.
      </p>

      {!code ? (
        <button
          onClick={handleReveal}
          disabled={isPending}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? "Yükleniyor..." : "Referans Kodumu Göster"}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 text-center">
            <span className="font-mono font-bold text-orange-700 tracking-widest text-base">{code}</span>
          </div>
          <button
            onClick={handleCopy}
            className="p-2.5 bg-orange-100 hover:bg-orange-200 rounded-xl transition-colors"
            title="Linki kopyala"
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
