import { Image } from "expo-image";

/** İşaret dikey; kaynak SVG'nin oranı 420:520. */
const ASPECT = 420 / 520;

/**
 * BagajPark marka işareti (valiz + renkli konum pini, 2026-10-18). Görsel web
 * ile aynı SVG'den `scripts/generate-brand-assets.mjs` ile üretilir. Süs
 * görselidir: marka adı yanındaki metinde okunur.
 */
export function BrandMark({ size }: { size: number }) {
  return (
    <Image
      source={require("../../assets/brand-mark.png")}
      style={{ height: size, width: Math.round(size * ASPECT) }}
      contentFit="contain"
      accessible={false}
    />
  );
}
