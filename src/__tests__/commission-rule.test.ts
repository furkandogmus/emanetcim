import { describe, it, expect } from "vitest";
import {
  effectiveCommissionRate,
  computeSplit,
  getMerchantShareRatio,
} from "@/lib/platform-split";
import { safeTimezone } from "@/services/PartnerEarningsService";

/**
 * TAHSİLAT YAPAMAYAN PLATFORM KOMİSYON DA ALAMAZ.
 *
 * Üretimde `PlatformSettings.platformCommissionRate` **0.5000** duruyordu ve aktif
 * sağlayıcı `manual`'di (para dükkanda, esnafın kasasına). Bu ikisi bir araya
 * gelince her tahsilatta `PaymentSplit`'e hiç tahsil edilmeyecek %50'lik bir
 * alacak donuyor, esnaf panelinde "net hakediş" kasadakinin yarısı görünüyor ve
 * `become-partner` sayfası kazanmaya çalıştığı esnafa %50 komisyon vaat ediyordu.
 */
describe("yürürlükteki komisyon oranı", () => {
  it("platform tahsilat YAPMIYORSA oran sıfırdır — ayarda ne yazarsa yazsın", () => {
    for (const configured of [0.5, 0.2, 1, 0.0001]) {
      expect(effectiveCommissionRate(configured, false), `oran=${configured}`).toBe(0);
    }
  });

  it("platform tahsilat YAPIYORSA ayardaki oran uygulanır", () => {
    expect(effectiveCommissionRate(0.2, true)).toBe(0.2);
    expect(effectiveCommissionRate(0.5, true)).toBe(0.5);
  });

  it("aralık dışı oran yine 0..1'e çekilir — zarar platformda kalır", () => {
    expect(effectiveCommissionRate(1.5, true)).toBe(1);
    expect(effectiveCommissionRate(-0.3, true)).toBe(0);
    expect(effectiveCommissionRate(Number.NaN, true)).toBe(0);
  });

  it("komisyonsuz dönemde esnafın payı brütün TAMAMIDIR", () => {
    const rate = effectiveCommissionRate(0.5, false);
    expect(getMerchantShareRatio(rate)).toBe(1);

    const split = computeSplit(1520, rate);
    expect(split.merchantAmount).toBe(1520);
    // Asil sart: defterde karsiligi olmayan bir alacak DOGMAMALI.
    expect(split.platformCommission).toBe(0);
  });

  it("brüt = komisyon + esnaf payı, her iki durumda da", () => {
    // Kurus kacagi mutabakatta aranan seydir; `computeSplit` farktan yuvarlar.
    for (const gross of [1520, 120.005, 33.33, 0.01, 99999.99]) {
      for (const capturesOnline of [true, false]) {
        const rate = effectiveCommissionRate(0.5, capturesOnline);
        const s = computeSplit(gross, rate);
        expect(
          Math.round((s.platformCommission + s.merchantAmount) * 100) / 100,
          `brüt=${gross} online=${capturesOnline}`,
        ).toBe(s.grossAmount);
      }
    }
  });
});

/**
 * `AT TIME ZONE`'a giden değer. Postgres tanımadığı bir ad görürse sorgu patlar
 * ve esnaf kazanç sayfasını TAMAMEN kaybeder; bozuk bir `Shop.timezone` yüzünden
 * sayfayı kaybetmektense varsayılana düşmek doğru.
 */
describe("dükkan saat dilimi süzgeci", () => {
  it("geçerli IANA adlarını geçirir", () => {
    for (const tz of ["Europe/Istanbul", "America/New_York", "Asia/Tokyo", "America/Argentina/Salta"]) {
      expect(safeTimezone(tz), tz).toBe(tz);
    }
  });

  it("boş / bozuk / enjeksiyon denemelerini varsayılana düşürür", () => {
    for (const bad of [null, undefined, "", "   ", "Europe/Istanbul'; DROP TABLE", "../etc", "12345"]) {
      expect(safeTimezone(bad as string | null | undefined), String(bad)).toBe("Europe/Istanbul");
    }
  });
});
