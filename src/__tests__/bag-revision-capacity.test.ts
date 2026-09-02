import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * VALIZ DUZELTMESI SLOT DEFTERINI DE GUNCELLER.
 *
 * Olculdu (2026-09-02): `applyBagRevision` `Booking.bagCountS/M/XL`i
 * guncelliyor, `ReservationSlot.bagCount`a hic dokunmuyordu. Musaitlik hesabi
 * ise slot tabanli rezervasyonlarda O DEFTERI okuyor
 * (`getSlotAvailabilityForShops` -> `reservationSlot.groupBy(_sum: bagCount)`);
 * `Booking.bagCount*` yalnizca slotu OLMAYAN eski kayitlar icin kullaniliyor.
 *
 * Sonuc kapasitenin IKI KEZ SATILMASI:
 *
 *   kapasite 10 · A 2 valizle rezerve eder  -> defter: 2
 *   esnaf 8 valize cikarir                  -> Booking: 8, defter: 2
 *   sistem 8 yer bos sanir, B 8 valiz alir  -> dukkanda 16 valiz
 *
 * Tasma tezgahin basinda ortaya cikar ve bir yazilim hatasi gibi gorunmez.
 *
 * Ustelik hicbir KAPASITE KONTROLU yoktu: esnaf sayiyi dukkanin kapasitesinin
 * ustune cikarabiliyordu.
 */

const oku = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), "utf-8"));

describe("valiz duzeltmesi kapasiteyi koruyor", () => {
  const revizyon = oku("src/services/booking/bag-revision.ts");
  const slotServisi = oku("src/services/SlotService.ts");

  it("slot defteri guncelleniyor", () => {
    expect(revizyon).toContain("updateReservedBags");
  });

  it("rezervasyon ve defter AYNI islemde yaziliyor", () => {
    /*
      Ayri yazilirsa surec arada olurse misafirin odedigi tutar ile yer
      kaplamasi ayrisir.

      Kontrol YALNIZCA `applyBagRevision` govdesinde: ayni dosyadaki
      `proposeBagRevision` ve `clearBagRevision` de `prisma.booking.update`
      cagiriyor ama ikisi de valiz SAYISINI degistirmiyor (biri bekleyen
      oneriyi yazar, digeri siler), yani slot defterini ilgilendirmiyorlar.
      Ilk yazdigim genis kontrol onlari da ihlal sayiyordu.
    */
    const govde = revizyon.slice(
      revizyon.indexOf("export async function applyBagRevision"),
    );
    const applyGovde = govde.slice(0, govde.indexOf("\nexport "));
    expect(applyGovde).toMatch(/prisma\.\$transaction\(async \(tx\) => \{/);
    expect(applyGovde).toMatch(/tx\.booking\.update/);
    expect(applyGovde).not.toMatch(/await prisma\.booking\.update\(/);
  });

  it("kapasite asimi ayri bir kod donduruyor", () => {
    expect(revizyon).toContain("CAPACITY_EXCEEDED");
  });

  it("sayimdan rezervasyonun KENDI payi dusuluyor", () => {
    // Yoksa kendi valizleri iki kez sayilir ve her artis reddedilirdi.
    expect(slotServisi).toMatch(/bookingId:\s*\{\s*not:\s*bookingId\s*\}/);
  });

  it("defter ve rezervasyon ayni statu kumesini sayiyor", () => {
    // `reserveSlots` ile `updateReservedBags` ayni "yer kapliyor mu" sorusunu
    // soruyor; ayri tanimlari olamaz.
    const kalip = /status:\s*\{\s*in:\s*\["PAID",\s*"CHECKED_IN",\s*"APPROVED"\]\s*\}/g;
    expect((slotServisi.match(kalip) ?? []).length).toBeGreaterThanOrEqual(3);
  });
});

describe("her iki tasiyici da yeni kodu isliyor", () => {
  it("mobil uc HTTP karsiligini tanimliyor", () => {
    const mobil = oku("src/app/api/mobile/partner/bookings/[id]/bag-revision/route.ts");
    expect(mobil).toContain("CAPACITY_EXCEEDED");
    // 409: istek gecerli, kaynagin su anki durumu kabul etmiyor.
    expect(mobil).toMatch(/CAPACITY_EXCEEDED:\s*\{\s*status:\s*409/);
  });

  it("web haritasi SIKI tiplenmis -- yeni kod sessizce dusemez", () => {
    /*
      Harita `Record<string, string>` idi ve servise yeni bir kod eklendiginde
      web sessizce genel hataya duserdi. Mobil karsiligi zaten sikiydi; ayni
      kural iki tasiyicida farkli sikilikta tutuluyordu.
    */
    const web = oku("src/actions/partner.ts");
    expect(web).toMatch(
      /BAG_REVISION_CODE_TO_KEY:\s*Record<BagRevisionErrorCode, string>/,
    );
    expect(web).toContain("Errors.insufficientCapacity");
  });
});
