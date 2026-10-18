import Image from "next/image";

/** `public/brand/logo-mark.svg` viewBox oranı (420:520): işaret dikey. */
const ASPECT = 420 / 520;

/**
 * BagajPark marka işareti: turuncu valiz + renkli konum pini (2026-10-18).
 *
 * Eski işaret turuncu kare içinde lucide `Package` idi ve sekiz yerde ayrı ayrı
 * çiziliyordu; logo değişince hepsi tek tek elden geçiyordu. Artık tek bileşen.
 * Süs görselidir (`alt=""`): marka adı ya yanındaki sözcükte ya da sarmalayan
 * bağlantının `aria-label`'ında okunur.
 *
 * Raster karşılıkları (favicon, PWA ikonları, mobil ikon) aynı SVG'den
 * `scripts/generate-brand-assets.mjs` ile üretilir.
 */
export default function BrandMark({ size, className }: { size: number; className?: string }) {
  return (
    <Image
      src="/brand/logo-mark.svg"
      alt=""
      aria-hidden="true"
      width={Math.round(size * ASPECT)}
      height={size}
      unoptimized
      className={className}
    />
  );
}
