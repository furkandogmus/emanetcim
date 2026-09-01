import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * KVKK SİLME HAKKI — kullanıcıya bağlı HER tablo bilinçli bir karar taşımalı.
 *
 * NEDEN VAR (2026-09-01'de ölçüldü): `MobilePushToken` silme yolunda YOKTU.
 * Modelde `onDelete: Cascade` var ama hesap SİLİNMİYOR, ANONİMLEŞTİRİLİYOR
 * (`user.update`) — yani cascade hiç ateşlenmiyor ve cihaz token'ları
 * anonimleştirilmiş kullanıcıya bağlı kalıyordu. `PushSubscription` zaten
 * siliniyordu, yani niyet açıktı; `MobilePushToken` sonradan eklenmiş ve iki
 * silme yolu da güncellenmemişti.
 *
 * Asıl kusur unutulan tablo değil, UNUTMANIN MÜMKÜN OLMASIYDI: yeni bir
 * kişisel veri tablosu eklemek, kimseyi silme yolunu güncellemeye zorlamıyordu.
 * Bu mandal onu zorlar — listede olmayan bir tablo testi kırar.
 */

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

/** Kullanıcıyı işaret eden alan adları. */
const USER_REF = /^(userId|guestId|ownerId|actorUserId)\b/;

/** Anonimleştirmede SİLİNEN tablolar. */
const ERASED = new Set([
  "Account",
  "Session",
  "Review",
  "LegalAcceptance",
  "PushSubscription",
  "MobilePushToken",
]);

/**
 * BİLEREK saklanan tablolar ve sebepleri.
 *
 * Saklamak da bir karardır ve gerekçesi yazılı olmalı — "unutulmuş" ile
 * "bilerek bırakılmış" arasındaki farkı ancak bu ayırır.
 */
const KEPT: Record<string, string> = {
  User: "Satır anonimleştirilir, silinmez: rezervasyon geçmişi ve esnaf hakedişi ona bağlı.",
  Shop: "Dükkan bir işletme kaydıdır; anonimleştirme aktif rezervasyonu olan hesabı zaten reddeder.",
  Booking: "Ticari kayıt — muhasebe/yasal saklama ve esnafın hakediş defteri buna dayanır.",
  AuditLog: "Denetim izi. Silinebilen bir denetim izi denetim değildir.",
  AnalyticsEvent:
    "Ürün analitiği. SİLİNMİYOR — gerekçesi zayıf ve gözden geçirilmeli (DEFECT_BACKLOG 2026-09-01).",
};

function modelsWithUserRef(): string[] {
  const out: string[] = [];
  for (const [, name, body] of SCHEMA.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g)) {
    const hasRef = body
      .split("\n")
      .some((line) => USER_REF.test(line.trim()));
    if (hasRef || name === "User") out.push(name);
  }
  return out;
}

describe("hesap anonimleştirmesi: kullanıcıya bağlı her tablo kararlı", () => {
  it("kullanıcıya bağlı HER tablo ya siliniyor ya da gerekçesiyle saklanıyor", () => {
    const unaccounted = modelsWithUserRef().filter(
      (m) => !ERASED.has(m) && !(m in KEPT),
    );
    expect(
      unaccounted,
      "Bu tablolar kullanıcıya bağlı ama anonimleştirmede ne siliniyor ne de " +
        "gerekçesiyle saklanıyor. Yeni bir kişisel veri tablosu eklediyseniz " +
        "`src/actions/account-privacy.ts` ve `src/app/api/mobile/account/delete` " +
        "yollarını güncelleyin, ya da buraya gerekçesini yazın:\n" +
        unaccounted.join("\n"),
    ).toEqual([]);
  });

  it("silme gövdesi TEK YERDE ve silinmesi gereken her tabloyu siliyor", () => {
    /*
      Govde `AccountPrivacyService`e tasindi. Onceden iki tasiyicida ayri
      yaziliydi ve IKISI DE `MobilePushToken`i atliyordu -- kopyalar tutarliydi
      ama ikisi de eksikti, yani "birini guncelleyip digerini unutmak" bu sefer
      kok sebep DEGILDI. Yine de tek govde, bir sonraki eksigin yarisini bastan
      imkansiz kilar.
    */
    const service = fs.readFileSync(
      path.join(process.cwd(), "src/services/AccountPrivacyService.ts"),
      "utf8",
    );
    const missing = [...ERASED]
      .filter((m) => m !== "User")
      .map((m) => m[0].toLowerCase() + m.slice(1))
      .filter((prop) => !new RegExp(`prisma\\.${prop}\\.deleteMany`).test(service));
    expect(
      missing,
      "`AccountPrivacyService` bu tabloları silmiyor:\n" + missing.join("\n"),
    ).toEqual([]);
  });

  it.each([
    ["web", "src/actions/account-privacy.ts"],
    ["mobil", "src/app/api/mobile/account/delete/route.ts"],
  ])("%s taşıyıcısı KENDİ silme kopyasını yazmıyor", (_label, file) => {
    // Kopya yeniden dogarsa ayrisma da yeniden mumkun olur.
    const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    const copies = [...ERASED]
      .filter((m) => m !== "User")
      .map((m) => m[0].toLowerCase() + m.slice(1))
      .filter((prop) => new RegExp(`prisma\\.${prop}\\.deleteMany`).test(src));
    expect(
      copies,
      `${file} silme gövdesinin kendi kopyasını yazıyor. Gövde ` +
        "`AccountPrivacyService.anonymizeSelf`te:\n" + copies.join("\n"),
    ).toEqual([]);
  });
});
