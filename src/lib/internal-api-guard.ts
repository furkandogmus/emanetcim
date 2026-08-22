import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** true = limit aşıldı, 429 dönmelisiniz */
export async function isRateLimited(
  req: NextRequest,
  keyPrefix: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const ip = clientIp(req);
  return !(await rateLimit(`${keyPrefix}:${ip}`, max, windowMs));
}

/** Uzunluk farkı sızdırmadan sabit zamanlı karşılaştırma. */
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * `/api/internal/*` uçlarının ortak yetkilendirmesi: `CRON_SECRET`, ya
 * `Authorization: Bearer <secret>` ya da `X-Cron-Secret: <secret>` ile.
 *
 * Neden burada: bu mantık dört uçta birbirinin kopyasıydı ve BEŞİNCİSİ
 * (`generate-slots`) hiç korunmuyordu — isimsiz herhangi biri binlerce satırlık
 * slot üretimini tetikleyebiliyordu (2026-08-22 denetimi). Tek yere alındı ki
 * yeni bir iç uç eklemek korumayı unutmayı gerektirmesin.
 *
 * `proxy.ts` içindeki `/api/internal` kontrolü yalnızca başlığın VARLIĞINA
 * bakar, değerine bakmaz — yani gerçek savunma burasıdır, orası değil.
 *
 * Dönen değer: `null` = yetkili. Aksi halde döndürülecek hata durumu.
 *   - `"not_configured"`: `CRON_SECRET` tanımsız → uç kapalı sayılır (503)
 *   - `"unauthorized"`: sır yanlış veya yok (401)
 */
export function authorizeCron(
  req: NextRequest,
): null | "not_configured" | "unauthorized" {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return "not_configured";

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const header = req.headers.get("x-cron-secret")?.trim() ?? "";

  if (bearer && secretsMatch(bearer, secret)) return null;
  if (header && secretsMatch(header, secret)) return null;
  return "unauthorized";
}
