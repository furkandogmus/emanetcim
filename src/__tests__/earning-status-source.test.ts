import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { EARNING_BOOKING_STATUSES, countsTowardEarnings } from "@/lib/platform-split";
import { stripComments } from "./helpers/strip-comments";

/**
 * PARA SAYAN HER SORGU AYNI STATU KUMESINDEN OKUR.
 *
 * `platform-split.ts` bu kumeyi bir olcumden sonra yazdi: partner ana paneli
 * "CANCELLED olmayan her sey" diyordu ve henuz ODENMEMIS rezervasyonlari da
 * kazanc sayiyordu; kazanc sayfasi yalnizca odenmisleri sayiyordu. Ayni dukkan
 * icin canlida iki farkli net hakedis gorulmustu (2026-08-22, 710 TL / 490 TL).
 *
 * 2026-09-02'de ayni desenin iki kopyasi daha bulundu:
 *
 *   - `mobile/profile/stats`: misafirin "toplam harcama"si `not: "CANCELLED"`
 *     ile hesaplaniyordu, yani hic odeme yapilmamis rezervasyonlar da dahildi.
 *     Misafirin odedigi ile esnafin hakettigi ayni kumedir; ikisinin farkli
 *     tanimi olamaz.
 *   - `mobile/admin/stats`: kumeyi ELLE yaziyordu. Bugun web admin ile ayni
 *     sonucu veriyordu, ama tesaduefen; kume degistigi gun sessizce ayrisirdi.
 *
 * Mandal, para toplayan sorgularin ortak kaynagi kullanmasini olcuyor.
 */

function tsDosyalari(dir: string, out: string[] = []): string[] {
  for (const ad of readdirSync(dir)) {
    const tam = join(dir, ad);
    if (statSync(tam).isDirectory()) {
      if (ad === "node_modules" || ad === "__tests__") continue;
      tsDosyalari(tam, out);
    } else if (/\.tsx?$/.test(ad) && !/\.test\.tsx?$/.test(ad)) {
      out.push(tam);
    }
  }
  return out;
}

/** `_sum` ile `totalPrice` toplayan dosyalar. */
function paraToplayanDosyalar(): { yol: string; src: string }[] {
  const bulunan: { yol: string; src: string }[] = [];
  for (const kok of ["src/app", "src/services", "src/lib"]) {
    for (const f of tsDosyalari(join(process.cwd(), kok))) {
      const src = readFileSync(f, "utf-8");
      if (/_sum:\s*\{[^}]*totalPrice/.test(src)) {
        bulunan.push({ yol: f.replace(process.cwd() + "/", ""), src });
      }
    }
  }
  return bulunan;
}

describe("hakedis statuleri tek kaynaktan", () => {
  const dosyalar = paraToplayanDosyalar();

  it("para toplayan dosya bulundu", () => {
    expect(dosyalar.length).toBeGreaterThan(2);
  });

  it("hicbiri statu listesini ELLE yazmiyor", () => {
    const ihlaller = dosyalar
      .filter(({ src }) =>
        /\[\s*"PAID"\s*,\s*"CHECKED_IN"\s*,\s*"CHECKED_OUT"\s*\]/.test(stripComments(src)),
      )
      .map((d) => d.yol);
    expect(
      ihlaller,
      `statu kumesi elle yazilmis -- EARNING_BOOKING_STATUSES kullanin:\n${ihlaller.join("\n")}`,
    ).toEqual([]);
  });

  it('para toplayan sorgularda `not: "CANCELLED"` yok', () => {
    const ihlaller: string[] = [];
    for (const { yol, src } of dosyalar) {
      // Yorumlar sıyrılır: bu düzeltmenin GEREKÇESİ ihlal metnini içeriyor.
      stripComments(src).split("\n").forEach((satir, i) => {
        if (/not:\s*["']CANCELLED["']/.test(satir)) ihlaller.push(`${yol}:${i + 1}`);
      });
    }
    expect(
      ihlaller,
      `"iptal olmayan her sey" para degildir; odenmemis rezervasyonlari da sayar:\n${ihlaller.join("\n")}`,
    ).toEqual([]);
  });
});

describe("kumenin kendisi odenmemis durumlari icermiyor", () => {
  it.each(["PENDING", "WAITING_APPROVAL", "APPROVED", "CANCELLED"])(
    "%s hakedise sayilmaz",
    (durum) => {
      expect(countsTowardEarnings(durum)).toBe(false);
    },
  );

  it.each([...EARNING_BOOKING_STATUSES])("%s hakedise sayilir", (durum) => {
    expect(countsTowardEarnings(durum)).toBe(true);
  });
});
