import { getPaymentCopyMode, type PaymentCopyMode } from "@/lib/payment-copy";
import { getPricingRules } from "@/lib/platform-settings";

/**
 * Ticari vaatlerin YAPILANDIRMADAN türeyen tek kaynağı.
 *
 * NEDEN VAR: 2026-08-22 denetiminde aynı hata sınıfı iki yerde çıktı —
 * kamuya açık metinler, arkalarındaki yapılandırmadan bağımsız olarak sabit
 * yazılmıştı:
 *   - "kartınıza iade edilir" — hiçbir ödeme sağlayıcısı entegre değilken (P1-19)
 *   - "Sigortalı Emanet" rozeti — `insuranceFeeTry = 0` iken (P1-20)
 *
 * Tek tek düzeltmek yetmez: yapılandırma değiştiğinde metinlerin elle geri
 * alınması gerekir ve biri mutlaka unutulur. Metin, kodun yeteneğinden türemeli;
 * **yalan söylemek için ayrı bir efor gerekmeli, doğru olan varsayılan olmalı.**
 *
 * Sunucuda çözülür, `CommerceProvider` ile istemciye geçer. Public env değişkeni
 * ile ikinci bir doğruluk kaynağı YARATILMAZ — sağlayıcı ve `PlatformSettings`
 * tek kaynaktır.
 */
export type CommerceContextValue = {
  /** "online" = kartla tahsilat var; "onsite" = dükkanda tahsilat. */
  paymentCopyMode: PaymentCopyMode;
  /**
   * Sigorta gerçekten var mı? `insuranceFeeTry > 0` ise evet.
   *
   * Sıfırken "Sigortalı Emanet" rozeti göstermek karşılığı olmayan bir güvence
   * vaadidir: bir bavul kaybolduğunda platformun neye dayanarak ödeme yapacağı
   * belirsizdir (P1-20).
   */
  insuranceEnabled: boolean;
  /** Sigorta ücreti (TRY). Rozet metninde gösterilebilir. */
  insuranceFeeTry: number;
};

export async function resolveCommerceContext(): Promise<CommerceContextValue> {
  const rules = await getPricingRules();
  return {
    paymentCopyMode: getPaymentCopyMode(),
    insuranceEnabled: rules.insuranceFeeTry > 0,
    insuranceFeeTry: rules.insuranceFeeTry,
  };
}
