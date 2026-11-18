import { useState } from "react";
import { PixelRatio } from "react-native";
import { Image, type ImageProps } from "expo-image";

import { resolveImage, thumbUrl } from "@/lib/images";

/**
 * Sunucudaki fotograf (dukkan, galeri): gosterildigi boyuta kucultulmus surumu indirir,
 * bellek + diskte tutar. Adresler degismez (her yukleme yeni bir nesne), yani diskteki
 * kopya hicbir zaman bayatlamaz: yeni fotograf yeni adresle gelir ve o indirilir.
 * Ayrica "gunde bir kontrol" gerekmez. Kucultme ucu hata verirse asil adrese duser.
 */
export function RemoteImage({
  src,
  width,
  placeholderWidth,
  ...rest
}: Omit<ImageProps, "source" | "placeholder"> & {
  src: string | null | undefined;
  width: number;
  /** Buyuk surum inerken diskteki kucuk kare gosterilsin (izgaradan acilan onizleme gibi). */
  placeholderWidth?: number;
}) {
  const [fallback, setFallback] = useState(false);
  const uri = fallback ? resolveImage(src) : thumbUrl(src, width, PixelRatio.get());
  if (!uri) return null;
  return (
    <Image
      {...rest}
      source={{ uri }}
      placeholder={placeholderWidth ? { uri: thumbUrl(src, placeholderWidth, PixelRatio.get()) ?? undefined } : undefined}
      placeholderContentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={src ?? undefined}
      transition={120}
      onError={(e) => {
        if (!fallback) setFallback(true);
        rest.onError?.(e);
      }}
    />
  );
}
