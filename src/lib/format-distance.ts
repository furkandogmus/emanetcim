/**
 * Mesafeyi okunabilir bir birime indirir.
 *
 * NEDEN GEREKLİ: arama listesi mesafeyi HER ZAMAN metreye çeviriyordu
 * (`distanceKm * 1000`) ve birim çeviri metnine gömülüydü. Yakındaki bir dükkan
 * için doğru ("155 m uzakta"), ama 482 talep noktası KÜRESEL: İstanbul'da arama
 * yapan bir misafir "TÜM NOKTALAR" sekmesinde Paris'i **"2259759 m uzakta"**
 * diye görüyordu (2026-08-31 ekran görüntüsü). Yedi haneli bir metre değeri
 * okunmuyor -- büyüklüğü tahmin etmek için insanın basamak sayması gerekiyor.
 *
 * Kırılım noktaları:
 *   < 1 km   -> metre, tam sayı        (155 m)
 *   < 10 km  -> kilometre, bir ondalık (2,3 km)
 *   >= 10 km -> kilometre, tam sayı    (2.260 km)
 *
 * Ondalık yalnızca yakın mesafede: 2,3 km ile 2,4 km arasındaki fark yürüme
 * kararını değiştirir, 2.260 km ile 2.261 km arasındaki fark hiçbir şeyi
 * değiştirmez.
 *
 * Sayı da burada biçimlendiriliyor, `formatDecimal` ile DEĞİL: o işlev alt ve
 * üst ondalık sınırını birlikte sabitliyor (puanlarda "4,7" için doğru) ve
 * mesafede "2,0 km" gibi gereksiz bir sıfır üretiyordu. Burada alt sınır 0,
 * yani "2 km" ve "2,3 km" birlikte doğru çıkıyor. Binlik ayıracı dile bağlı
 * olduğu için (`2.260` tr, `2,260` en) `Intl` kullanılıyor.
 */
export type DistanceDisplay = {
  unit: "m" | "km";
  amount: number;
  fractionDigits: number;
};

export function distanceDisplay(km: number): DistanceDisplay {
  const safe = Number.isFinite(km) && km >= 0 ? km : 0;
  if (safe < 1) {
    return { unit: "m", amount: Math.round(safe * 1000), fractionDigits: 0 };
  }
  if (safe < 10) {
    return { unit: "km", amount: safe, fractionDigits: 1 };
  }
  return { unit: "km", amount: Math.round(safe), fractionDigits: 0 };
}

/** Çeviri anahtarı + biçimlenmiş sayı. Bileşen ikisini birleştirir. */
export function formatDistance(
  km: number,
  locale: string,
): { key: "awayMeters" | "awayKm"; value: string } {
  const d = distanceDisplay(km);
  const value = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: d.fractionDigits,
  }).format(d.amount);
  return { key: d.unit === "m" ? "awayMeters" : "awayKm", value };
}
