import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * AYRISMA DEFTERI.
 *
 * Bu oturumda bulunan hatalarin buyuk bolumu tek bir bicimde ortaya cikti:
 * ayni gercegi tutan iki kayittan biri guncellendi, digeri geride kaldi.
 *
 *   - valiz duzeltmesi `Booking.bagCount*`i yazip slot defterine dokunmuyordu
 *   - tarih degisince slot satirlari ESKI saatte kaliyordu
 *   - teslim alinmis valizin sayisi artirilabiliyordu (muhursuz valiz)
 *   - koordinatsiz dukkan onaylanabiliyordu (hicbir aramada cikmaz)
 *
 * Hepsi kodda duzeltildi. Ama duzeltmeler yalnizca BUNDAN SONRASINI korur:
 * hata surerken uretilmis kayitlar veritabaninda durur ve hicbir ekran onlari
 * gostermez. Bu servis onlari SAYAR.
 *
 * Sorgular gercek Postgres'e karsi kosuldu (2026-09-02): temiz veritabaninda
 * `clean: true`, elle uretilen bir ayrisma ve koordinatsiz aktif dukkan
 * BULUNDU, temizlik sonrasi yine `clean: true`.
 */

const servis = stripComments(
  readFileSync(join(process.cwd(), "src/services/ConsistencyService.ts"), "utf-8"),
);

describe("tutarlilik denetimi", () => {
  it.each([
    "slot_bag_mismatch",
    "unsealed_checked_in_bags",
    "active_shop_without_coordinates",
    "captured_amount_mismatch",
  ])("`%s` bulgusu taniniyor", (kind) => {
    expect(servis).toContain(kind);
  });

  it("HICBIR SEY YAZMIYOR -- yalnizca okur", () => {
    /*
      Otomatik onarim bilerek yok: her tutarsizligin dogru cevabi farkli ve
      bazilari fiziksel gercege bagli ("rafta kac valiz var?"). Sayi gorunur
      oldugunda karar insanindir.
    */
    expect(servis).not.toMatch(/\.(update|updateMany|create|createMany|delete|deleteMany|upsert)\(/);
  });

  it("enum karsilastirmasi `::text` ile yapiliyor", () => {
    /*
      `Booking.status` bir Postgres ENUM'u. Ham SQL'de metin dizisiyle
      karsilastirmak `operator does not exist: "BookingStatus" = text` verir --
      ilk yazilista tam olarak bu hatayi aldim ve sorgu calismadi.
    */
    expect(servis).toMatch(/b\.status::text/);
  });

  it("ornekler SINIRLI -- log satiri sisirilmiyor", () => {
    expect(servis).toMatch(/SAMPLE_LIMIT = 10/);
  });
});

describe("is kayit defterine bagli", () => {
  const registry = stripComments(
    readFileSync(join(process.cwd(), "src/lib/jobs/registry.ts"), "utf-8"),
  );

  it("kayitli", () => {
    expect(registry).toContain('name: "consistency-check"');
  });

  it("temiz sonuc da loglaniyor", () => {
    /*
      "Hicbir sey yazmayan is" ile "calismayan is" birbirinden ayirt
      edilemez; bu ayrim bu depoda daha once sekiz isten dordunu sessizce olu
      birakmisti.
    */
    const uc = stripComments(
      readFileSync(join(process.cwd(), "src/app/api/internal/consistency-check/route.ts"), "utf-8"),
    );
    expect(uc).toContain("consistency_check_clean");
    expect(uc).toContain("withJobRun");
  });
});
