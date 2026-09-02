import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { formatDateTimeInZone, bookingTimeZone } from "@/lib/format-datetime";
import { PLATFORM_TIMEZONE } from "@/lib/datetime-local";
import { stripComments } from "./helpers/strip-comments";

/**
 * SUNUCUDA TARIH BICIMLENDIRMESI SAAT DILIMI ISTER.
 *
 * Olculdu (2026-09-02): sunucuda kosan kod `d.toLocaleString("tr-TR")`
 * yaziyordu. `timeZone` verilmeyince `Intl` SURECI CALISTIRAN MAKINENIN saat
 * dilimini kullanir; uretim konteynerinde `TZ` tanimli degil, yani UTC.
 * Istanbul'da 13:00 olan bir check-in, misafire giden hatirlatma e-postasinda
 * 10:00 yaziyordu -- uc saat geri.
 *
 * Uc yuzeyde birden yanlisti ve ucu de kullaniciya bir SAAT SOZU veriyor:
 * hatirlatma e-postalari, esnafin rezervasyon listesi/detayi, misafirin
 * rezervasyon detayi. Kimsenin cihazi UTC degil, dolayisiyla hicbir okuyucu
 * icin dogru degildi.
 *
 * Mandal `toLocaleDateString` / `toLocaleTimeString` icin TAVANI 0 tutuyor:
 * ikisi de her zaman tarihtir, sayi olamaz. `toLocaleString` sayi
 * bicimlendirmesinde de kullanildigi icin ayrik sayilmiyor -- onun yerine
 * `Date` uzerinde cagrildigi acik olan bicimler araniyor.
 */

const SUNUCU_KOKLERI = ["src/app", "src/services", "src/lib"];

/**
 * ISTEMCI TARAFI DA MISAFIR YUZEYINDE AYNI KURALA TABI (2026-09-02'de eklendi).
 *
 * Ilk yazilisinda bu mandal `"use client"` dosyalarini "ayri bir tartisma"
 * diye disariya almisti. Degildi: `datetime-local.ts` kurali coktan koymus --
 * "rezervasyon saatleri DUKKANIN yerel saatidir, misafirin cihazininki degil"
 * -- ve o kural GIRDI tarafinda uygulanmisken (`parseDatetimeLocalInTimeZone`)
 * GOSTERIM tarafinda uygulanmamisti.
 *
 * En agiri `ManageBookingClient`ti: saati `checkIn.getHours()` ile yaziyordu,
 * yani ziyaretcinin CIHAZ saatiyle. Berlin'deki bir misafir Istanbul'daki
 * dukkana 14:00 rezervasyon yapip kendi "rezervasyonumu yonet" ekraninda
 * 13:00 goruyordu -- kendi sectigi saatten farkli. Tokyo'da 20:00.
 *
 * Kapsam MISAFIR yuzeyi (`components/guest`): admin ve esnaf panelleri kendi
 * borc listelerinde duruyor.
 */
const ISTEMCI_KOKLERI = ["src/components/guest"];

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

function sunucuDosyalari(): string[] {
  const hepsi: string[] = [];
  for (const kok of SUNUCU_KOKLERI) {
    for (const f of tsDosyalari(join(process.cwd(), kok))) {
      const src = readFileSync(f, "utf-8");
      if (/^\s*["']use client["']/m.test(src.slice(0, 200))) continue;
      hepsi.push(f);
    }
  }
  // Misafir yuzeyindeki istemci bilesenleri: gerekce ISTEMCI_KOKLERI'nde.
  for (const kok of ISTEMCI_KOKLERI) {
    hepsi.push(...tsDosyalari(join(process.cwd(), kok)));
  }
  return hepsi;
}

describe("sunucuda tarih bicimlendirmesi saat dilimi tasiyor", () => {
  const dosyalar = sunucuDosyalari();

  it("taranacak sunucu dosyasi bulundu", () => {
    expect(dosyalar.length).toBeGreaterThan(20);
  });

  /*
    Olcut CAGRI BICIMI DEGIL, `timeZone`UN VARLIGI. `booking-holidays.ts` zaten
    `d.toLocaleDateString("en-CA", { timeZone })` yaziyor ve DOGRU -- dilimi
    cagirandan aliyor. Yasak olan sey dilimi hic vermemek, cunku o zaman deger
    sureci calistiran makineye gore degisir.

    Cok satirli cagrilarda secenek nesnesi asagi satirlara dagilir; bu yuzden
    cagriyi iceren satir ve ardindaki uc satir birlikte okunuyor.
  */
  function ihlalleriTopla(desen: RegExp): string[] {
    const ihlaller: string[] = [];
    for (const f of dosyalar) {
      // Yorumlar sıyrılır (satır numaraları korunur): bu mandalların
      // gerekçeleri ihlal ettikleri kalıbı metin olarak içeriyor.
      const satirlar = stripComments(readFileSync(f, "utf-8")).split("\n");
      satirlar.forEach((satir, i) => {
        if (!desen.test(satir)) return;
        const pencere = satirlar.slice(i, i + 4).join("\n");
        if (!/timeZone/.test(pencere)) {
          ihlaller.push(`${f.replace(process.cwd() + "/", "")}:${i + 1}`);
        }
      });
    }
    return ihlaller;
  }

  it("toLocaleDateString / toLocaleTimeString saat dilimi tasiyor (tavan 0)", () => {
    const ihlaller = ihlalleriTopla(/\.toLocale(Date|Time)String\s*\(/);
    expect(
      ihlaller,
      `saat dilimsiz tarih bicimlendirmesi -- \`formatDateTimeInZone\` kullanin:\n${ihlaller.join("\n")}`,
    ).toEqual([]);
  });

  it("tarih bicimli toLocaleString saat dilimi tasiyor", () => {
    // `dateStyle`/`timeStyle` gecen bir cagri kesinlikle tarihtir; sayi
    // bicimlendirmesi bu secenekleri almaz.
    const ihlaller = ihlalleriTopla(/\.toLocaleString\s*\([^)]*(dateStyle|timeStyle)/);
    expect(ihlaller, ihlaller.join("\n")).toEqual([]);
  });
});

describe("formatDateTimeInZone makinenin dilimine bakmaz", () => {
  it("ayni an, farkli dilimlerde farkli saat verir", () => {
    const an = new Date("2026-09-02T10:00:00Z");
    expect(
      formatDateTimeInZone(an, { locale: "tr-TR", timeZone: "Europe/Istanbul", timeStyle: "short" }),
    ).toContain("13:00");
    expect(
      formatDateTimeInZone(an, { locale: "tr-TR", timeZone: "UTC", timeStyle: "short" }),
    ).toContain("10:00");
  });

  it("dukkanin dilimi yoksa platform dilimine duser", () => {
    expect(bookingTimeZone({ timezone: "Europe/Amsterdam" })).toBe("Europe/Amsterdam");
    expect(bookingTimeZone({ timezone: null })).toBe(PLATFORM_TIMEZONE);
    expect(bookingTimeZone(null)).toBe(PLATFORM_TIMEZONE);
  });
});

describe("misafir yuzeyi cihazin saatini okumuyor", () => {
  /*
    `d.getHours()` / `getMinutes()` CIHAZIN dilimini okur. Bir rezervasyon
    saatini boyle yazmak, misafire kendi sectigi saatten farkli bir saat
    gostermek demekti (`ManageBookingClient`, 2026-09-02).
  */
  it("saat parcalari elle kurulmuyor", () => {
    const ihlaller: string[] = [];
    for (const kok of ISTEMCI_KOKLERI) {
      for (const f of tsDosyalari(join(process.cwd(), kok))) {
        const satirlar = stripComments(readFileSync(f, "utf-8")).split("\n");
        satirlar.forEach((satir, i) => {
          if (/\.get(Hours|Minutes)\s*\(\s*\)/.test(satir)) {
            ihlaller.push(`${f.replace(process.cwd() + "/", "")}:${i + 1}`);
          }
        });
      }
    }
    expect(
      ihlaller,
      `cihazin saati okunuyor -- \`formatDateTimeInZone\` kullanin:\n${ihlaller.join("\n")}`,
    ).toEqual([]);
  });
});
