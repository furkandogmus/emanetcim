import { deepLinkHref } from "./deep-link-target";
import { rememberInvite, rememberReferral } from "./pending-referral";

/**
 * Web baglantisini uygulama yoluna cevirir: https://bagajpark.com/tr/shop/abc -> /shop/abc.
 * Sunucu tarafi dogrulama dosyalari `src/lib/app-links.ts` (kok proje). Dil oneki atilir;
 * uygulama kendi dilini kullanir. Tanimadigi yolu oldugu gibi birakir.
 *
 * Oturum burada bilinmez: rezervasyon, araci paneli ve kayit `/link` ekranina gider; rol
 * uyusmazligi ve girissiz acilis orada cozulur (`deep-link-target.ts`).
 */
const WEB_HOSTS = new Set(["bagajpark.com", "www.bagajpark.com"]);
const ID = /^[A-Za-z0-9_-]+$/;

export function appPathFromLink(path: string): string {
  let url: URL;
  try {
    url = new URL(path);
  } catch {
    return path;
  }
  if (!/^https?:$/.test(url.protocol) || !WEB_HOSTS.has(url.hostname)) return path;
  // Araci kodu (`?aff=`, `/r/<kod>` ekler): odeme ekraninda "Referans kodu"na dolar.
  rememberReferral(url.searchParams.get("aff"));
  const [, ...rest] = url.pathname.split("/").filter(Boolean);
  const route = rest.join("/");

  if (rest.length === 2 && rest[0] === "shop" && ID.test(rest[1])) return `/shop/${rest[1]}`;
  // `bookings/lookup` ve `bookings/manage/<jeton>` hesapsiz misafirin web akisi; burada eslesmez.
  if (rest.length === 2 && rest[0] === "bookings" && rest[1] !== "lookup" && ID.test(rest[1])) {
    return deepLinkHref({ kind: "booking", id: rest[1] });
  }
  if (rest.length === 3 && rest[0] === "partner" && rest[1] === "bookings" && ID.test(rest[2])) {
    return deepLinkHref({ kind: "partner-booking", id: rest[2] });
  }
  if (route === "account/affiliate") return deepLinkHref({ kind: "affiliate" });
  if (route === "register") {
    const ref = url.searchParams.get("ref");
    const partnerRef = url.searchParams.get("partnerref");
    if (partnerRef || url.searchParams.get("role")?.toUpperCase() === "PARTNER") {
      const code = partnerRef ?? ref;
      return deepLinkHref({ kind: "partner-invite", ...(code && ID.test(code) ? { id: code } : {}) });
    }
    // `?ref=` kullanici davet kodudur: araci alanina degil, indirim kodu alanina dolar.
    rememberInvite(ref);
    return deepLinkHref({ kind: "register" });
  }
  // `/auth/*` jetonlu baglantilar tarayicida kalir (AASA dislar); gelirse ana ekran.
  return "/";
}
