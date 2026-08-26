/**
 * Yakalanan bir hatayı GÜVENLE gösterilebilir bir çeviri anahtarına çevirir.
 *
 * NEDEN VAR (2026-08-24'te ölçüldü): 12 yönetim ekranı `catch` bloğunda
 * `toast.error(error instanceof Error ? error.message : String(error))` yazıyordu.
 * İki ayrı sorun:
 *
 * 1. **Prod'da o metin hiç ulaşmıyor.** Next 16'da bir server action'dan fırlayan
 *    hata istemciye kırpılarak gider; React'in ürettiği gövde şudur:
 *      "An error occurred in the Server Components render. The specific message is
 *       omitted in production builds to avoid leaking sensitive details. …"
 *    (`node_modules/next/dist/compiled/react-server-dom-turbopack/.../client.browser.production.js`)
 *    Yani yönetici, geçersiz bir kapasite girdiğinde bu İngilizce paragrafı bir
 *    toast'ta görüyordu — 6 dilin hepsinde, ne olduğunu söylemeden.
 * 2. **Geliştirmede ham anahtar sızıyor.** `admin-management.ts` `Errors.invalidData`
 *    diye fırlatıyor; `.message` doğrudan basıldığı için ekranda birebir
 *    "Errors.invalidData" yazıyor.
 *
 * Bu yüzden `catch` yolu artık HİÇBİR ZAMAN ham metin basmaz: tanınan bir anahtar
 * varsa o, yoksa yerelleştirilmiş genel hata. Belirli bir sebebin kullanıcıya
 * ulaşması gerekiyorsa doğru yol fırlatmak değil, projenin kendi kalıbı olan
 * `{ success: false, error: "Errors.x" }` dönüşüdür — kırpılmadan gider.
 */

/** İstemciye gösterilmesi güvenli, `Errors` namespace'inde karşılığı olan anahtarlar. */
const KNOWN_KEYS = new Set([
  "invalidData",
  "unauthorized",
  "notAuthorizedAdmin",
  "notAuthorizedPartner",
  "authRequired",
  "bookingNotFound",
  "bookingStateConflict",
]);

/** `Errors` namespace'i içindeki anahtar — `useTranslations("Errors")` ile kullanılır. */
export function actionErrorKey(e: unknown): string {
  const raw = e instanceof Error ? e.message : "";
  const bare = raw.startsWith("Errors.") ? raw.slice("Errors.".length) : raw;
  return KNOWN_KEYS.has(bare) ? bare : "generic";
}

/* ═══════════════════════════════════════════════════════════════
   DÖNÜŞ YOLU — `{ success: false, error: ... }`
   ═══════════════════════════════════════════════════════════════

   Yukarıdaki `actionErrorKey` FIRLATILAN hata içindi. Asıl sızıntı burada:
   action'lar `error` alanında üç ayrı biçim döndürüyordu ve ekranlar ne
   gelirse aynen basıyordu (2026-08-25'te ölçüldü):

     1. `"Errors.bookingNotFound"` — çeviri ANAHTARI. `BookingDetailActions`
        bunu `toast.error(res.error)` ile basıyordu, yani misafir ekranda
        birebir "Errors.bookingNotFound" görüyordu. Altı dilin hepsinde.
     2. `"tracking_number_required"` — `seal.ts`'in snake_case kodu. Aynı
        şekilde ham basılıyordu.
     3. `"Rezervasyon bulunamadı."` — servisin TÜRKÇE cümlesi
        (`partner.ts` `result.message`'ı doğrudan geçiriyordu). Japonca
        arayüzdeki bir esnaf Türkçe hata okuyordu.

   Çözüm tek yerde: gelen değer NE OLURSA OLSUN bir `Errors` anahtarına
   indirgenir; tanınmayan her şey `generic`e düşer. Ham metin asla geçmez.
   ═══════════════════════════════════════════════════════════════ */

/**
 * `seal.ts` ve benzeri eski snake_case kodların `Errors` karşılıkları.
 *
 * Kodlar KORUNDU, çevrilmedi: mobil/API tarafı da aynı action'ları çağırabilsin
 * diye dönüş sözleşmesi sabit kaldı; eşleme yalnızca GÖSTERİM anında yapılır.
 */
const LEGACY_CODE_TO_KEY: Record<string, string> = {
  unauthorized: "unauthorized",
  unknown: "generic",
  not_found: "bookingNotFound",
  request_not_found: "sealRequestNotFound",
  request_not_pending: "sealRequestNotPending",
  request_not_shipped: "sealRequestNotShipped",
  shop_not_found: "shopNotFound",
  tracking_number_required: "sealTrackingRequired",
  invalid_serial_range: "sealSerialRangeInvalid",
  invalid_quantity: "sealQuantityInvalid",
  // Misafir iptal ucunun (`/api/bookings/guest-cancel`) sabit kodlari.
  email_mismatch: "unauthorized",
  booking_not_found: "bookingNotFound",
  cancel_not_allowed: "modificationNotAllowed",
  cancel_refund_failed: "cancelRefundFailed",
  cancel_failed: "generic",
  lookup_failed: "generic",
  // Misafir sorgu token'i: baglanti eskimis ya da hic gonderilmemis.
  missing_token: "guestLinkExpired",
  invalid_token: "guestLinkExpired",
  server_error: "generic",
};

/**
 * Bir action'ın `error` alanını `Errors` namespace'indeki ÇIPLAK anahtara indirger.
 *
 * `null` döndürmesi "bunu gösterme, çağıranın yedek metnini kullan" demektir —
 * serbest metin (boşluk içeren, cümle gibi görünen) hiçbir zaman anahtar değildir.
 */
export function returnedErrorKey(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;

  if (value.startsWith("Errors.")) return value.slice("Errors.".length) || null;

  const legacy = LEGACY_CODE_TO_KEY[value];
  if (legacy) return legacy;

  /*
    Buraya düşen şey ya bir servis cümlesi ya da `Error.message`. İkisi de
    kullanıcıya gösterilmez: anahtar YOK demek, çağıranın yerelleştirilmiş
    yedek metnini kullanması demektir.
  */
  return null;
}
