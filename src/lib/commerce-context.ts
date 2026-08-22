import { getPaymentCopyMode, type PaymentCopyMode } from "@/lib/payment-copy";
import type { PricingRules } from "@/lib/pricing-rules";

/**
 * Ticari vaatlerin YAPILANDIRMADAN türeyen tek kaynağı.
 *
 * NEDEN VAR: 2026-08-22 denetiminde aynı hata sınıfı iki yerde çıktı — kamuya açık
 * metinler, arkalarındaki yapılandırmadan bağımsız olarak sabit yazılmıştı:
 *   - "kartınıza iade edilir" — hiçbir ödeme sağlayıcısı entegre değilken (P1-19)
 *   - "Sigortalı Emanet" rozeti — `insuranceFeeTry = 0` iken (P1-20)
 *
 * Metin, kodun yeteneğinden türemeli; **yalan söylemek için ayrı bir efor gerekmeli,
 * doğru olan varsayılan olmalı.**
 *
 * KÖK LAYOUT'TA VERİTABANI SORGUSU YOK — bilinçli.
 * İlk tasarımda sigorta durumu da buradan geliyordu ve kök layout her sayfa
 * render'ında `PlatformSettings` okuyordu. İki maliyeti vardı:
 *   1. Her sayfa isteğinde bir DB turu (önbellekli olsa bile gereksiz bağımlılık).
 *   2. **Statik üretimi imkânsız kılıyordu**: `/about`, `/faq`, `/hotels` gibi
 *      tamamen içerik sayfaları bile build zamanında veritabanı istiyordu.
 * Ödeme modu ortam değişkeninden gelir (ucuz, deterministik); sigorta durumunu ise
 * ona İHTİYACI OLAN iki yüzey kendi zaten yüklediği kurallardan türetir.
 */
export type CommerceContextValue = {
  /** "online" = kartla tahsilat var; "onsite" = dükkanda tahsilat. */
  paymentCopyMode: PaymentCopyMode;
};

/** Kök layout için — DB'ye dokunmaz. */
export function resolveCommerceContext(): CommerceContextValue {
  return { paymentCopyMode: getPaymentCopyMode() };
}

/**
 * Sigorta gerçekten var mı? `insuranceFeeTry > 0` ise evet.
 *
 * Sıfırken "Sigortalı Emanet" rozeti göstermek karşılığı olmayan bir güvence
 * vaadidir: bir bavul kaybolduğunda platformun neye dayanarak ödeme yapacağı
 * belirsizdir (P1-20).
 *
 * Kuralları zaten elinde olan yüzeyler bunu doğrudan çağırır; ayrı bir sorgu
 * gerekmez.
 */
export function isInsuranceEnabled(rules: Pick<PricingRules, "insuranceFeeTry">): boolean {
  return rules.insuranceFeeTry > 0;
}
