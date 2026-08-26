import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Gelen webhook imzasının doğrulanması.
 *
 * NEDEN AYRI MODÜL (2026-08-24): bu uç, kimlik doğrulaması olmayan ve
 * veritabanına YAZAN tek genel POST ucu (`/api/webhooks/resend`). Doğrulama
 * mantığı route dosyasının içindeydi ve **hiç testi yoktu**. Buradaki üç
 * fonksiyon saf: gövde, başlıklar ve sır alır, boolean döner.
 */

/**
 * `svix-timestamp` toleransı.
 *
 * NEDEN GEREKLİ (ölçüldü, 2026-08-24): zaman damgası imzalanan içeriğe
 * giriyordu ama TAZELİĞİ hiç kontrol edilmiyordu. Sonuç: geçerli bir isteği bir
 * kez yakalayan biri onu SONSUZA KADAR tekrar oynatabilir — gövde de imza da
 * değişmediği için doğrulama her seferinde geçer. Gelen e-posta yolu
 * `contactMessage.create` çağırıyor ve tekilleştirme yok; yani tek bir yakalanmış
 * istek tekrarlanarak admin gelen kutusu doldurulabilirdi (P1-18 ile aynı kanal).
 */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type WebhookSignatureHeaders = {
  svixId: string;
  svixTs: string;
  signature: string;
};

/** Zaman damgası penceresi dışındaysa `false` — tekrar oynatma (replay) kapanır. */
export function isTimestampFresh(
  svixTs: string,
  nowMs: number,
  toleranceSeconds: number = WEBHOOK_TOLERANCE_SECONDS,
): boolean {
  const ts = Number(svixTs);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const deltaSeconds = Math.abs(nowMs / 1000 - ts);
  return deltaSeconds <= toleranceSeconds;
}

function secretBytes(secret: string): Buffer {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  try {
    return Buffer.from(raw, "base64");
  } catch {
    return Buffer.from(raw);
  }
}

function equalsConstantTime(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Svix imzası. `svix-signature` başlığı BİRDEN ÇOK imza taşıyabilir:
 * `"v1,<base64> v1,<base64>"` — sır döndürülürken (rotation) eski ve yeni sır
 * bir süre birlikte gönderilir. Eski kod `","` ile bölüp ikinci parçayı alıyordu;
 * iki imza geldiğinde parça sayısı 3 oluyor, kod TÜM başlığı imza sanıyor ve
 * doğrulama başarısız oluyordu. Yani sır döndürme anında webhook sessizce kırılırdı.
 * Artık her aday tek tek denenir.
 */
export function verifySvixSignature(
  rawBody: string,
  headers: WebhookSignatureHeaders,
  secret: string,
): boolean {
  const signedContent = `${headers.svixId}.${headers.svixTs}.${rawBody}`;
  const expected = createHmac("sha256", secretBytes(secret))
    .update(signedContent)
    .digest();

  for (const candidate of headers.signature.split(/\s+/).filter(Boolean)) {
    // "v1,<base64>" ya da düz "<base64>"
    const comma = candidate.indexOf(",");
    const provided = comma >= 0 ? candidate.slice(comma + 1) : candidate;
    let providedBytes: Buffer;
    try {
      providedBytes = Buffer.from(provided, "base64");
    } catch {
      continue;
    }
    if (equalsConstantTime(expected, providedBytes)) return true;
  }
  return false;
}

/**
 * Svix ÖNCESİ biçim: gövdenin ham HMAC'i, zaman damgası yok.
 *
 * Zaman damgası olmadığı için bu yolda tekrar oynatma engellenemez. Bu yüzden
 * yalnızca sır bir Svix sırrı DEĞİLSE kabul edilir (`isSvixSecret`); `whsec_`
 * ile başlayan bir sır varken zayıf yola düşmek, güçlü yolu anlamsız kılardı.
 */
export function verifyLegacySignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const provided = signature.replace(/^sha256=/i, "").trim();
  if (!provided) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return equalsConstantTime(Buffer.from(expected), Buffer.from(provided));
}

export function isSvixSecret(secret: string): boolean {
  return secret.startsWith("whsec_");
}

/** Doğrulama sonucu — reddedilme sebebi loglanabilsin diye ayrı ayrı. */
export type WebhookVerdict =
  | { ok: true }
  | { ok: false; reason: "missing_signature" | "stale_timestamp" | "bad_signature" };

export function verifyWebhook(
  rawBody: string,
  headers: WebhookSignatureHeaders | null,
  secret: string,
  nowMs: number,
): WebhookVerdict {
  if (!headers) return { ok: false, reason: "missing_signature" };

  if (headers.svixId) {
    if (!isTimestampFresh(headers.svixTs, nowMs)) {
      return { ok: false, reason: "stale_timestamp" };
    }
    return verifySvixSignature(rawBody, headers, secret)
      ? { ok: true }
      : { ok: false, reason: "bad_signature" };
  }

  // Svix sırrı varken eski/zayıf yola düşülmez.
  if (isSvixSecret(secret)) return { ok: false, reason: "missing_signature" };

  return verifyLegacySignature(rawBody, headers.signature, secret)
    ? { ok: true }
    : { ok: false, reason: "bad_signature" };
}
