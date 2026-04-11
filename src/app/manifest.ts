import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BagajPark",
    short_name: "BagajPark",
    description:
      "Türkiye ve seçili şehirlerde valiz saklama — güvenli rezervasyon. Luggage storage in Turkey and selected cities.",
    lang: routing.defaultLocale,
    dir: "ltr",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ea580c",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
