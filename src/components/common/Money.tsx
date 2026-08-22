"use client";

import { useLocale } from "next-intl";
import { formatTryCurrency } from "@/lib/currency";

/**
 * Para gösteriminin tek yeri.
 *
 * NEDEN VAR: 2026-08-22'de uygulamada para 17 yerde ham olarak `₺{sayı}` şeklinde
 * basılıyordu, 11 yerde ise `formatTryCurrency` ile. Sonuçlar tutarsızdı:
 *
 *   ham `₺{1520}`   → "₺1520"      doğrusu → "₺1.520,00"
 *   ham `₺{12.5}`   → "₺12.5"      doğrusu → "₺12,50"   (TR'de ondalık ayracı virgül)
 *   ham `₺{50}`     → "₺50"        doğrusu → "₺50,00"
 *
 * Binlik ayracı olmayan dört haneli bir tutar okunması zor; nokta ile yazılan
 * ondalık ise Türkçe'de **binlik ayracı** gibi görünür — yani `₺12.5` bazı
 * kullanıcılar için "12 bin 5" diye okunur. Para gösteriminde bu kabul edilemez.
 *
 * Ayrıca `ShopDetailClient` zaten biçimlendirilmiş bir değerin başına bir `₺` daha
 * ekliyordu ve dükkan detayının yapışkan fiyat çubuğunda **"₺₺50,00"** yazıyordu.
 *
 * `src/lib/currency.ts` "başka para birimi eklenirse burada genişletilir" diyor;
 * bu bileşen o genişlemenin tek dokunma noktası olmasını sağlıyor.
 */
export default function Money({
  amount,
  className,
  /** Kuruşları gizle (ör. dar liste kartlarında). Yine binlik ayracı uygulanır. */
  compact = false,
}: {
  amount: number;
  className?: string;
  compact?: boolean;
}) {
  const locale = useLocale();
  const safe = Number.isFinite(amount) ? amount : 0;
  const text = formatTryCurrency(
    safe,
    locale,
    compact
      ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : undefined,
  );
  // Tutar hiçbir zaman satır kırmasın: "₺1.520," / "00" diye bölünmesi okunamaz.
  return <span className={className} style={{ whiteSpace: "nowrap" }}>{text}</span>;
}
