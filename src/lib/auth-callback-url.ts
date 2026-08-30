/** Tarayıcının URL ayrıştırıcısı bu karakterleri URL'den ATAR (WHATWG). */
const URL_STRIPPED_CHARS = /[\t\n\r]/g;

/**
 * NextAuth `callbackUrl` — iç bind (0.0.0.0:3000), localhost vb. tam URL’leri
 * yalnızca path + query’ye indirger; open redirect riskini azaltır.
 *
 * TERS BÖLÜ VE KONTROL KARAKTERLERİ (2026-08-31'de yakalandı): yalnızca `//`
 * kontrol etmek YETMİYOR. WHATWG URL ayrıştırıcısı, http(s) gibi "özel"
 * şemalarda ters bölüyü eğik çizgiyle EŞ sayar ve tab/satır başı karakterlerini
 * tamamen atar. Ölçüldü:
 *
 *   girdi `/\evil.com`   → eski sanitize `/\evil.com` → tarayıcı https://evil.com/
 *   girdi `/\tevil`      → eski sanitize `/\tevil`    → tarayıcı https://tevil/
 *
 * Yani `//` ile başlamayan ama tarayıcıda protokol-göreli hâle gelen değerler
 * süzgeçten geçiyordu: giriş sayfasına `?callbackUrl=/\evil.com` ile gelen bir
 * kullanıcı, giriş sonrası saldırganın sitesine yollanabilirdi (kimlik avı).
 *
 * Artık önce normalleştiriliyor, sonra sonuç `URL` ile ÇÖZÜLEREK aynı origin'de
 * kaldığı doğrulanıyor — desen ezberlemek yerine tarayıcının kendi kuralına
 * soruyoruz.
 */
export function sanitizeAuthCallbackUrl(raw: string | null | undefined): string {
  if (raw == null || raw === "") return "/";
  const trimmed = raw
    .trim()
    .replace(URL_STRIPPED_CHARS, "")
    .replace(/\\/g, "/");
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//")) return "/";
    return assertSameOrigin(trimmed);
  }

  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase();
    const bad =
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host === "localhost" ||
      host === "[::1]" ||
      /^192\.168\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

    const path = assertSameOrigin(`${u.pathname}${u.search}` || "/");
    if (bad) return path;

    // Dış origin (ör. ngrok): yine de sadece path kullan — tarayıcıdaki gerçek host ile uyumlu
    return path;
  } catch {
    return "/";
  }
}

/**
 * SON KAPI: aday yolu sahte bir origin'e göre çözer ve origin DEĞİŞMEDİĞİNİ
 * doğrular. Kalıp kontrolü (`//`, `\\`) her zaman bir sonraki kaçış yolunu
 * kaçırır; tarayıcının kendi ayrıştırıcısına sormak kaçırmaz.
 */
const SAME_ORIGIN_PROBE = "https://callback-url-probe.invalid";

function assertSameOrigin(candidate: string): string {
  try {
    const resolved = new URL(candidate, SAME_ORIGIN_PROBE);
    if (resolved.origin !== SAME_ORIGIN_PROBE) return "/";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "/";
  }
}
