import type { MetadataRoute } from "next";
import { APP_LOCALES, DEFAULT_APP_LOCALE, type AppLocale } from "@/i18n/locales";

/**
 * Dile gore PWA manifest'i — tek kaynak.
 *
 * NEDEN (2026-09-23): `public/manifest.json` tek dilliydi (`lang: "tr"`,
 * kisayollar "Nokta Ara" / "Rezervasyonlarim") ve site alti dilde. Almanca
 * bir ziyaretci uygulamayi kurunca Turkce kisayollar goruyordu. Next'in
 * `app/manifest.ts` kurali yalnizca kokte calisir, dil basina uretemez; bu
 * yuzden iki route handler bu fonksiyonu cagiriyor:
 *   /manifests/<dil>.webmanifest  -- layout her dilde kendisininkini baglar
 *   /manifest.json                -- eski kurulumlar ve dis baglantilar (tr)
 *
 * `id` her dilde "/" -- ayni uygulama; dil degisince ikinci bir kurulum olusmaz.
 * `start_url` `utm_source=pwa` tasir: Plausible kurulu uygulamadan gelen
 * trafigi ayri gosterir (duz `?source=` sorgusunu Plausible yok sayar).
 */
type PwaCopy = {
  name: string;
  description: string;
  shortcutSearchName: string;
  shortcutSearchShort: string;
  shortcutSearchDesc: string;
  shortcutBookingsName: string;
  shortcutBookingsShort: string;
  shortcutBookingsDesc: string;
  screenshotSearch: string;
  screenshotHome: string;
};

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}

async function loadCopy(locale: AppLocale): Promise<PwaCopy> {
  const messages = (await import(`@/locales/${locale}.json`)).default as { Pwa: PwaCopy };
  return messages.Pwa;
}

export async function buildManifest(
  locale: AppLocale = DEFAULT_APP_LOCALE,
): Promise<MetadataRoute.Manifest> {
  const c = await loadCopy(locale);
  const shortcutIcon = [{ src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" }];
  return {
    id: "/",
    name: c.name,
    short_name: "BagajPark",
    description: c.description,
    lang: locale,
    dir: locale === "fa" ? "rtl" : "ltr",
    start_url: `/${locale}?utm_source=pwa`,
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "window-controls-overlay"],
    orientation: "portrait-primary",
    categories: ["travel", "business", "utilities"],
    background_color: "#fafaf9",
    theme_color: "#ea580c",
    icons: [
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192x192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512x512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    /*
      Ekran goruntuleri Chrome'un zengin kurulum penceresini acar (Android'de
      `narrow`, masaustunde `wide`). Goruntuler Turkce arayuzden; uretimi
      `scripts/pwa-screenshots.mjs`.
    */
    screenshots: [
      { src: "/screenshots/narrow-search.jpg", sizes: "780x1688", type: "image/jpeg", form_factor: "narrow", label: c.screenshotSearch },
      { src: "/screenshots/narrow-home.jpg", sizes: "780x1688", type: "image/jpeg", form_factor: "narrow", label: c.screenshotHome },
      { src: "/screenshots/wide-search.jpg", sizes: "1280x800", type: "image/jpeg", form_factor: "wide", label: c.screenshotSearch },
    ],
    shortcuts: [
      {
        name: c.shortcutSearchName,
        short_name: c.shortcutSearchShort,
        description: c.shortcutSearchDesc,
        url: `/${locale}/search?utm_source=pwa`,
        icons: shortcutIcon,
      },
      {
        name: c.shortcutBookingsName,
        short_name: c.shortcutBookingsShort,
        description: c.shortcutBookingsDesc,
        url: `/${locale}/bookings?utm_source=pwa`,
        icons: shortcutIcon,
      },
    ],
  };
}

export function manifestResponse(manifest: MetadataRoute.Manifest): Response {
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Tarayici gunde bir kez yeniler; degisiklik deploy sonrasi en gec bir gunde yayilir.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
