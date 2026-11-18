/**
 * Web baglantisini uygulama yoluna cevirir: https://bagajpark.com/tr/shop/abc -> /shop/abc.
 * Sunucu tarafi dogrulama dosyalari `src/lib/app-links.ts` (kok proje). Dil oneki atilir;
 * uygulama kendi dilini kullanir. Tanimadigi yolu oldugu gibi birakir.
 */
const WEB_HOSTS = new Set(["bagajpark.com", "www.bagajpark.com"]);

export function appPathFromLink(path: string): string {
  let url: URL;
  try {
    url = new URL(path);
  } catch {
    return path;
  }
  if (!/^https?:$/.test(url.protocol) || !WEB_HOSTS.has(url.hostname)) return path;
  const parts = url.pathname.split("/").filter(Boolean);
  // Yalnizca /<dil>/shop/<id> uygulamaya gelir (app.json intentFilters, AASA).
  const [, section, id] = parts;
  if (parts.length >= 3 && section === "shop" && id && /^[A-Za-z0-9_-]+$/.test(id)) return `/shop/${id}`;
  return "/";
}
