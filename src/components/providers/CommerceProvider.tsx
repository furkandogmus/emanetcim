"use client";

import { createContext, useContext } from "react";
import type { CommerceContextValue } from "@/lib/commerce-context";
import { paymentCopyKey } from "@/lib/payment-copy";

/**
 * Ticari vaatlerin istemci tarafındaki okuma noktası.
 *
 * Değer SUNUCUDA çözülür (`resolveCommerceContext`) ve layout'tan geçer. İstemci
 * kendi başına sağlayıcıyı sorgulayamaz; public env değişkeni ile ikinci bir
 * doğruluk kaynağı yaratmak da bilerek reddedildi — bir metnin doğru olup
 * olmadığı, hangi katmandan bakıldığına göre değişmemeli (P1-19, P1-20).
 */

/**
 * Sağlayıcı sarmalanmamışsa kullanılan güvenli varsayılan.
 *
 * İHTİYATLI TARAFA kurulu: ödeme dükkanda, sigorta yok. Bir vaat, sarmalayıcı
 * unutulduğu için ortaya çıkmamalı.
 */
const FALLBACK: CommerceContextValue = {
  paymentCopyMode: "onsite",
  insuranceEnabled: false,
  insuranceFeeTry: 0,
};

const CommerceContext = createContext<CommerceContextValue>(FALLBACK);

export function CommerceProvider({
  value,
  children,
}: {
  value: CommerceContextValue;
  children: React.ReactNode;
}) {
  return (
    <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>
  );
}

export function useCommerce(): CommerceContextValue {
  return useContext(CommerceContext);
}

/**
 * Çeviri anahtarını aktif ödeme moduna göre seçer.
 *
 *   const k = usePaymentCopyKey();
 *   t(k("cancellationEstimateCard"))
 *     -> "cancellationEstimateCard"        (online)
 *     -> "cancellationEstimateCardOnsite"  (dükkanda tahsilat)
 */
export function usePaymentCopyKey(): (baseKey: string) => string {
  const { paymentCopyMode } = useCommerce();
  return (baseKey: string) => paymentCopyKey(baseKey, paymentCopyMode);
}
