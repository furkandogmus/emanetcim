import type { NextRequest } from "next/server";
import { clientIpFromHeaders, getClientIp as getClientIpFromContext } from "@/lib/client-ip";

/**
 * Govde `src/lib/client-ip.ts`te (2026-08-31).
 *
 * Buradaki hali `X-Forwarded-For`in ILK girdisini donduruyordu -- yani
 * istemcinin GONDERDIGI degeri. nginx o basliga EKLIYOR
 * (`$proxy_add_x_forwarded_for`), ezmiyor; dolayisiyla bu fonksiyonu kullanan
 * her hiz siniri, istege bir baslik eklenerek atlanabiliyordu. Yorumu "merkezi
 * ve guvenli IP tespit metodu" diyordu ve ikisi de dogru degildi: ne merkezi
 * (on bes dosyada kopyasi vardi) ne guvenli.
 */
export async function getClientIp(req?: NextRequest | Request): Promise<string> {
  if (req) return clientIpFromHeaders(req.headers);
  return getClientIpFromContext();
}
