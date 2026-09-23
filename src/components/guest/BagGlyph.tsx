import Image from "next/image";

export type BagSize = "s" | "m" | "xl";

/**
 * Valiz boyu gorseli. Uc boy AYNI serinin 3D render'lari (ayni isik, ayni
 * kil dokusu), yani yan yana konunca bir set gibi okunur; arka plan saydam.
 *
 * Kaynak: Pixabay, kullanici izhar-ahamed, Pixabay Content License (ticari
 * kullanim serbest, atif gerekmez):
 *   s  -> pixabay.com/illustrations/rucksack-student-channel-back-9536181/
 *   m  -> pixabay.com/illustrations/ai-generated-suitcase-3d-luggage-9551231/
 *   xl -> pixabay.com/illustrations/suitcase-luggage-wheels-traveler-9587657/
 * Kirpilip 360 px yukseklikte WebP'ye cevrildi (`public/bags/`).
 */
const SRC: Record<BagSize, { src: string; width: number; height: number }> = {
  s: { src: "/bags/s.webp", width: 322, height: 360 },
  m: { src: "/bags/m.webp", width: 187, height: 360 },
  xl: { src: "/bags/xl.webp", width: 187, height: 360 },
};

/**
 * Gorunen yukseklik oranlari (gercek hayattaki gibi): sirt cantasi ~45 cm,
 * kabin valizi ~55 cm, kargo valizi ~75 cm.
 */
export const BAG_HEIGHT_UNITS: Record<BagSize, number> = { s: 60, m: 78, xl: 100 };

export default function BagGlyph({
  size,
  className,
  style,
}: {
  size: BagSize;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { src, width, height } = SRC[size];
  return (
    <Image
      src={src}
      width={width}
      height={height}
      alt=""
      aria-hidden="true"
      className={`object-contain ${className ?? ""}`}
      style={style}
    />
  );
}
