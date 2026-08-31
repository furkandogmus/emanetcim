import { headers } from "next/headers";

/**
 * ISTEMCI IP'SI — tek yer, ve GUVEN MODELI acikca yazili.
 *
 * NEDEN VAR (2026-08-31'de olculdu): on bes dosya IP'yi kendisi cikariyordu ve
 * HEPSI ayni sekilde YANLIS yapiyordu:
 *
 *     h.get("x-forwarded-for")?.split(",")[0]?.trim()
 *
 * `X-Forwarded-For` basliginin ILK girdisi, istemcinin GONDERDIGI degerdir.
 * `nginx/conf.d/default.conf` bu basligi soyle kuruyor:
 *
 *     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 *
 * `$proxy_add_x_forwarded_for` EKLER, ezmez: istemci `X-Forwarded-For: 9.9.9.9`
 * gonderdiginde uygulamaya `9.9.9.9, <gercek-ip>` ulasir ve `[0]` saldirganin
 * yazdigi degeri dondurur.
 *
 * SONUCU: uygulamadaki BUTUN IP hiz sinirlari her istekte rastgele bir baslik
 * gondererek atlanabiliyordu -- giris (sifre serpmesi kovasi),
 * `bookings/lookup` (rezervasyon kodu kaba kuvveti), kayit, OTP, token
 * yenileme, sifre sifirlama, iletisim formu, `admin/setup`. Depo acik kaynak:
 * saldirganin bunu bulmasi icin iki dosya okumasi yetiyor.
 *
 * GUVENILEN BASLIK `X-Real-IP`:
 *
 *     proxy_set_header X-Real-IP $remote_addr;
 *
 * `proxy_set_header` EZER, yani istemcinin gonderdigi `X-Real-IP` uygulamaya
 * ulasmaz. Ve `$remote_addr` dogru: ayni dosyada `real_ip_header
 * CF-Connecting-IP` + Cloudflare aralikları icin `set_real_ip_from` var, yani
 * baglanti bir Cloudflare adresinden geldiginde nginx `$remote_addr`i gercek
 * istemci adresiyle degistiriyor.
 *
 * `CF-Connecting-IP` DOGRUDAN OKUNMAZ: nginx onu `proxy_set_header` ile
 * ezmiyor, yani istemciden geldigi gibi geciyor ve uydurulabilir.
 *
 * Uygulama konteynerinin host portu yok (`docker-compose.yml`): tek giris
 * nginx. Node surecine dogrudan ulasilabilseydi hicbir baslik guvenilir
 * olmazdi.
 *
 * XFF'e YEDEK OLARAK bakilir ama SON girdisinden: `$proxy_add_x_forwarded_for`
 * gercek adresi sona ekler. Yine de `X-Real-IP` tercih edilir, cunku son-girdi
 * kurali vekil zincirinin bicimine baglidir ve zincir degisince sessizce
 * yanlislanir.
 */

const UNKNOWN = "unknown";

type HeaderReader = { get(name: string): string | null };

export function clientIpFromHeaders(h: HeaderReader): string {
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  /*
    Yedek yol. ILK degil SON girdi: ilk girdi istemcinin yazdigi, sonuncusu
    en yakin vekilin ekledigi degerdir.
  */
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }

  return UNKNOWN;
}

/** `NextRequest` / `Request` tasiyan yerler (API uclari). */
export function clientIpFromRequest(req: { headers: HeaderReader }): string {
  return clientIpFromHeaders(req.headers);
}

/** Server action'lar: istek nesnesi yok, `next/headers` uzerinden okunur. */
export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}

/** `null` isteyen cagiranlar icin (denetim kaydi `ip` alani gibi). */
export async function getClientIpOrNull(): Promise<string | null> {
  const ip = await getClientIp();
  return ip === UNKNOWN ? null : ip;
}
