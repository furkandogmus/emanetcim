import { getPaymentProvider } from "@/lib/payments";

/**
 * Kamuya açık para metinlerinin hangi sürümünün gösterileceğini sağlayıcı belirler.
 *
 * NEDEN: 2026-08-22 denetiminde sayfalar "Visa/Mastercard ile online ödeme alınır,
 * nakit kabul edilmez" ve "tutarın tamamı kartınıza iade edilir" diyordu — hiçbir
 * ödeme sağlayıcısı entegre değilken. Bu, kodun eksikliği değil METNİN yalanıydı ve
 * tek tek düzeltilse bile entegrasyon gelince yine elle geri alınması gerekecekti.
 *
 * Çözüm: metin sürümünü sağlayıcının yeteneğine bağla. `PAYMENT_PROVIDER=iyzico`
 * yazıldığı gün kartlı metinler kendiliğinden geri gelir; hiçbir çeviri dosyası
 * elle değişmez. Yalan söylemek için ayrı bir efor gerekir — doğru olan varsayılandır.
 */
export type PaymentCopyMode = "online" | "onsite";

export function getPaymentCopyMode(): PaymentCopyMode {
  return getPaymentProvider().capabilities.capturesOnline ? "online" : "onsite";
}

/**
 * Çeviri anahtarını moda göre seçer.
 *
 *   paymentCopyKey("cancellationEstimateCard")
 *     -> "cancellationEstimateCard"        (online)
 *     -> "cancellationEstimateCardOnsite"  (dükkanda tahsilat)
 */
export function paymentCopyKey(baseKey: string, mode = getPaymentCopyMode()): string {
  return mode === "online" ? baseKey : `${baseKey}Onsite`;
}
