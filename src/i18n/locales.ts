/**
 * Uygulamanın dil listesi — TEK KAYNAK, ağır bağımlılıksız.
 *
 * NEDEN AYRI DOSYA (2026-09-02): liste `routing.ts` içindeydi ve o dosya
 * `createNavigation()` çağırıyor, yani `next/navigation`ı çekiyor. Sunucu
 * tarafı bir yardımcı (`request-locale.ts`) diller için `routing`i import
 * edince o zincir de geliyordu; vitest ortamında `next/navigation` çözülemiyor
 * ve İLGİSİZ dört test birden düştü (`PartnerActions`, `AuditFixes`).
 *
 * Liste burada, saf bir sabit olarak durur. `routing.ts` onu yayar, dile
 * ihtiyacı olan sunucu kodu doğrudan buradan okur. Tek kaynak korunur,
 * navigasyon bağımlılığı yayılmaz.
 */
export const APP_LOCALES = ["tr", "en", "de", "fr", "ja", "fa"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_APP_LOCALE: AppLocale = "tr";
