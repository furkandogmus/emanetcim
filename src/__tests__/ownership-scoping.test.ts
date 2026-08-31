import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * ISTEMCIDEN GELEN `shopId` SAHIPLIK KONTROLU OLMADAN KULLANILMAZ.
 *
 * NEDEN VAR (2026-08-31'de olculdu): `src/lib/action-auth.ts` ROL kapisini tek
 * yere aldi ve o is bitti -- ama rol, sahiplikle ayni sey degil.
 * `requirePartner()` "esnaf mi" diye sorar; "BU dukkanin esnafi mi" diye
 * sormaz. Bir action `shopId`yi istemciden alip dogrulamadan kullaninca, her
 * esnaf her dukkan uzerinde islem yapabilir hale gelir.
 *
 * Somut hali `reportFaultySealAction`ti: `shopId` istemciden geliyordu ve
 * hicbir kontrolden gecmiyordu, yani bir esnaf BASKA bir dukkanin muhurlerini
 * arizali isaretleyebiliyordu. Etkisi envanterle sinirli degil -- FAULTY muhur
 * check-in'de reddedildigi icin hedef dukkanin teslim alma akisi duruyordu.
 * Seri numaralari ardisik tam sayi, dukkan kimlikleri de herkese acik
 * sayfalarda: ikisini de tahmin etmek gerekmiyor.
 *
 * Iki ayrinti bu bulguyu ogretici yapiyor:
 *
 *   - **Hemen ustundeki komsusu (`getNextAvailableSealsAction`) kontrolu
 *     YAPIYORDU.** Yani kural biliniyordu, bir dosyada iki satir arayla bir
 *     uygulanip bir uygulanmisti.
 *   - **Mobil karsiligi 2026-08-25'te kapatilmisti** ve yorumunda saldiriyi
 *     tarif ediyordu; web action'i kapatilmamisti. `CLAUDE.md`'nin "bir is
 *     kuralini iki tasiyicida ayri yazma" kuralinin bedeli.
 *
 * Bu tarama, `shopId` parametresi alan her server action'in ya sahipligi
 * dogrulamasini ya da dogruladigi bilinen bir servise devretmesini sart kosar.
 */

const ROOT = path.resolve(__dirname, "../..");
const ACTIONS_DIR = path.join(ROOT, "src/actions");

/** Sahipligi KENDI icinde dogrulayan servis cagrilari — devretmek yeterlidir. */
const OWNERSHIP_AWARE_CALLS = [
  // `actor.role === 'PARTNER'` ise sorguya `ownerId` kosulu ekler.
  "sealService.createRequest",
  // Talebin dukkanini okur ve `shop.ownerId !== actor.id` ise reddeder.
  "sealService.confirmDelivery",
  // `actor` alir ve ADMIN degilse dukkan sahipligini dogrular.
  "sealService.markSealAsFaulty",
];

/** Sahiplik dogrulamasinin kaynakta birakmasi gereken izler. */
const OWNERSHIP_PATTERNS = [
  /ownerId:\s*auth\.actor\.id/,
  /ownerId:\s*session\.user\.id/,
  /shop\.ownerId\s*!==\s*auth\.actor\.id/,
  /shop\.ownerId\s*!==\s*session\.user\.id/,
];

/**
 * UCUNCU cozum: istemciden gelen `shopId`yi hic kullanmamak.
 *
 * `addReviewAction` boyle yapiyor: govdedeki `shopId`yi aliyor ama servise
 * gecerken `shopId: booking.shopId` ile EZIYOR -- yani gercek kaynak, sahipligi
 * zaten dogrulanmis rezervasyon. Sahiplik kontrolu yok cunku gerekmiyor: kural
 * "misafir kendi rezervasyonunu degerlendirir" ve o kontrol (`booking.guestId
 * !== session.user.id`) zaten var.
 *
 * Bu bicimi kurala yazmak, taramanin gercek bir aciga isaret etmedigi halde
 * kirmizi kalmasini onluyor. Kirmizi kalan bir mandal, bir sure sonra
 * gevsetilir.
 */
const SERVER_DERIVED_OVERRIDE = /shopId:\s*(booking|b|shop|row)\.\w+/;

function actionFiles(): string[] {
  return fs
    .readdirSync(ACTIONS_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join(ACTIONS_DIR, f));
}

/** Bir `export async function ...` govdesini bir sonraki export'a kadar alir. */
function splitActions(src: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  const re = /export async function (\w+)\s*\(/g;
  const starts: Array<{ name: string; index: number }> = [];
  for (const m of src.matchAll(re)) {
    starts.push({ name: m[1], index: m.index! });
  }
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1].index : src.length;
    out.push({ name: starts[i].name, body: src.slice(starts[i].index, end) });
  }
  return out;
}

describe("istemciden gelen dukkan kimligi sahiplikle dogrulanir", () => {
  const offenders: string[] = [];

  for (const file of actionFiles()) {
    const src = fs.readFileSync(file, "utf8");
    const rel = path.relative(ROOT, file);
    for (const { name, body } of splitActions(src)) {
      // Yalnizca `shopId` PARAMETRESI alan action'lar; govdede uretilenler degil.
      const signature = body.slice(0, body.indexOf(")") + 1);
      if (!/\bshopId\b/.test(signature)) continue;

      // ADMIN kapisindan gecen action'larda sahiplik zaten yok (admin her dukkani gorur).
      if (/requireAdmin\(\)|assertAdmin\(\)|ensureAdmin\(\)/.test(body)) continue;

      const delegates = OWNERSHIP_AWARE_CALLS.some((c) => body.includes(c));
      const checksInline = OWNERSHIP_PATTERNS.some((p) => p.test(body));
      const overridden = SERVER_DERIVED_OVERRIDE.test(body);
      if (!delegates && !checksInline && !overridden) {
        offenders.push(`${rel} → ${name}`);
      }
    }
  }

  it("hicbir action `shopId`yi dogrulamadan kullanmiyor", () => {
    expect(
      offenders,
      "Bu action'lar `shopId`yi ISTEMCIDEN aliyor ama cagiranin o dukkanin " +
        "sahibi oldugunu dogrulamiyor. `requirePartner()` ROL kapisidir, " +
        "sahiplik kapisi degil: her esnaf her dukkan uzerinde islem yapabilir " +
        "hale gelir. Uc kabul edilen cozum var: (a) sahipligi burada dogrula, " +
        "(b) dogruladigi bilinen bir servise devret, (c) istemciden gelen " +
        "degeri sunucudan turetilen bir degerle EZ.\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });

  it("mühür arizali isaretleme kurali SERVISTE duruyor", () => {
    /*
      Iki tasiyici (web action + mobil uc) ayni kurali ayri yazdiginda biri
      duzeltilip digeri unutuldu -- tam olarak bu oldu. Kural servise
      tasindi ki ucuncu bir tasiyici da atlayamasin.
    */
    const svc = fs.readFileSync(path.join(ROOT, "src/services/SealService.ts"), "utf8");
    const fn = svc.match(/async markSealAsFaulty\([\s\S]*?\n  \}/);
    expect(fn).not.toBeNull();
    expect(fn![0], "markSealAsFaulty `actor` almali").toMatch(/actor:\s*\{/);
    expect(fn![0], "ADMIN disindaki aktor icin dukkan sahipligi dogrulanmali").toMatch(
      /ownerId:\s*actor\.id/,
    );
  });
});
