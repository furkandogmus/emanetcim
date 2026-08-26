import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  WEBHOOK_TOLERANCE_SECONDS,
  isTimestampFresh,
  verifyWebhook,
} from "@/lib/webhook-signature";

/**
 * `/api/webhooks/resend` — kimlik doğrulaması olmayan ve veritabanına YAZAN tek
 * genel POST ucu. 2026-08-24'e kadar HİÇ testi yoktu ve iki açık taşıyordu:
 *
 *  1. `svix-timestamp` imzalanan içeriğe giriyor ama TAZELİĞİ kontrol
 *     edilmiyordu. Geçerli bir isteği bir kez yakalayan biri onu sonsuza kadar
 *     tekrar oynatabilirdi; gelen e-posta yolu tekilleştirme yapmadan
 *     `contactMessage.create` çağırdığı için admin gelen kutusu tek bir
 *     yakalanmış istekle doldurulabilirdi (P1-18 ile aynı kanal).
 *  2. `svix-signature` başlığı sır döndürme sırasında BİRDEN ÇOK imza taşır
 *     ("v1,a v1,b"). Eski kod `","` ile bölüp ikinci parçayı alıyordu; iki imza
 *     geldiğinde tüm başlığı imza sanıp reddediyordu — yani sır döndürme anında
 *     webhook sessizce kırılırdı.
 */

const SVIX_SECRET = "whsec_" + Buffer.from("s3cr3t-key-material").toString("base64");
const BODY = JSON.stringify({ type: "email.delivered", data: { email_id: "e1" } });
const NOW = Date.parse("2026-08-24T12:00:00Z");

function sign(body: string, id: string, ts: string, secret = SVIX_SECRET): string {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  return createHmac("sha256", Buffer.from(raw, "base64"))
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
}

const FRESH_TS = String(Math.floor(NOW / 1000));

function headers(over: Partial<{ svixId: string; svixTs: string; signature: string }> = {}) {
  const svixId = over.svixId ?? "msg_1";
  const svixTs = over.svixTs ?? FRESH_TS;
  return {
    svixId,
    svixTs,
    signature: over.signature ?? `v1,${sign(BODY, svixId, svixTs)}`,
  };
}

describe("webhook imza doğrulaması", () => {
  it("geçerli imzayı kabul eder", () => {
    expect(verifyWebhook(BODY, headers(), SVIX_SECRET, NOW)).toEqual({ ok: true });
  });

  it("gövde değiştirilmişse reddeder", () => {
    const tampered = JSON.stringify({ type: "email.delivered", data: { email_id: "HACKED" } });
    expect(verifyWebhook(tampered, headers(), SVIX_SECRET, NOW)).toEqual({
      ok: false,
      reason: "bad_signature",
    });
  });

  it("imza başlığı yoksa reddeder", () => {
    expect(verifyWebhook(BODY, null, SVIX_SECRET, NOW)).toEqual({
      ok: false,
      reason: "missing_signature",
    });
  });

  it("ESKİ ama geçerli imzalı bir isteği reddeder (tekrar oynatma)", () => {
    // Asil aciktı: gövde ve imza degismedigi icin dogrulama her seferinde geciyordu.
    const oldTs = String(Math.floor(NOW / 1000) - (WEBHOOK_TOLERANCE_SECONDS + 60));
    const captured = headers({ svixTs: oldTs });
    // Imza kendi icinde DOGRU — yalnizca zaman damgasi eski.
    expect(verifyWebhook(BODY, captured, SVIX_SECRET, Date.parse(`2026-08-24T12:00:00Z`))).toEqual({
      ok: false,
      reason: "stale_timestamp",
    });
  });

  it("gelecekten gelen zaman damgasını da reddeder", () => {
    const futureTs = String(Math.floor(NOW / 1000) + (WEBHOOK_TOLERANCE_SECONDS + 60));
    expect(verifyWebhook(BODY, headers({ svixTs: futureTs }), SVIX_SECRET, NOW)).toEqual({
      ok: false,
      reason: "stale_timestamp",
    });
  });

  it("tolerans içindeki zaman damgasını kabul eder", () => {
    const nearTs = String(Math.floor(NOW / 1000) - (WEBHOOK_TOLERANCE_SECONDS - 10));
    expect(verifyWebhook(BODY, headers({ svixTs: nearTs }), SVIX_SECRET, NOW)).toEqual({ ok: true });
  });

  it("sır döndürme sırasındaki ÇOKLU imzayı kabul eder", () => {
    // "v1,<eski> v1,<yeni>" — ikincisi bizim sirrimizla uyusuyor.
    const valid = sign(BODY, "msg_1", FRESH_TS);
    const bogus = Buffer.from("baska-bir-sirla-uretilmis").toString("base64");
    const multi = headers({ signature: `v1,${bogus} v1,${valid}` });
    expect(verifyWebhook(BODY, multi, SVIX_SECRET, NOW)).toEqual({ ok: true });
  });

  it("Svix sırrı varken eski/zayıf imza yoluna düşülmez", () => {
    // Eski yolda zaman damgasi yok, yani tekrar oynatma engellenemiyor.
    const legacy = { svixId: "", svixTs: "", signature: "sha256=deadbeef" };
    expect(verifyWebhook(BODY, legacy, SVIX_SECRET, NOW)).toEqual({
      ok: false,
      reason: "missing_signature",
    });
  });

  it("Svix OLMAYAN sırla eski imza yolu hâlâ çalışır", () => {
    const plain = "plain-shared-secret";
    const sig = createHmac("sha256", plain).update(BODY).digest("hex");
    expect(
      verifyWebhook(BODY, { svixId: "", svixTs: "", signature: `sha256=${sig}` }, plain, NOW),
    ).toEqual({ ok: true });
    expect(
      verifyWebhook(BODY, { svixId: "", svixTs: "", signature: "sha256=00" }, plain, NOW),
    ).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("bozuk zaman damgası taze sayılmaz", () => {
    expect(isTimestampFresh("", NOW)).toBe(false);
    expect(isTimestampFresh("abc", NOW)).toBe(false);
    expect(isTimestampFresh("0", NOW)).toBe(false);
    expect(isTimestampFresh("-1", NOW)).toBe(false);
  });
});
