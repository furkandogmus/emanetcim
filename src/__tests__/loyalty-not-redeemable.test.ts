import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/strip-comments";

/**
 * SADAKAT PUANI HENUZ HARCANAMIYOR -- VE BU BILINEN BIR DURUM.
 *
 * Olculdu (2026-09-02): puan her rezervasyonda artiyor, iptalde geri
 * aliniyor ve `LoyaltyBadge` ile gosteriliyor. Ama harcayacak hicbir yol yok:
 * checkout'ta puan alani yok, `redeemPoints`/`pointsToUse` benzeri bir cagri
 * yok, `Booking` uzerinde harcanan puani tutan alan yok.
 *
 * Buna ragmen iki yerde INDIRIM VAAT EDILIYOR: rozet parasal karsiligi
 * yaziyor, `Guest.loyaltyRewardsBody` ise "indirim olarak kullan, 100 puan =
 * 1 TL indirim" diyor. Misafir bu indirimi checkout'ta arar ve bulamaz.
 *
 * BU TEST BIR KAPI DEGIL, HATIRLATICI. Ozellik eklendigi gun DUSER ve o gun
 * yapilmasi gerekeni soyler: `docs/DEFECT_BACKLOG.md` -> B7 maddesini kapat,
 * iptal/iade yolunda puanin geri verildigini dogrula, ve vaadin artik
 * karsiligi oldugundan emin ol.
 *
 * Karar (2026-09-02): ozellik simdilik eklenmiyor, durum kayda geciyor.
 */

const HARCAMA_IZLERI = [
  "redeemPoints",
  "pointsToUse",
  "loyaltyPointsSpent",
  "usedLoyaltyPoints",
  "loyaltyDiscountAmount",
];

function kaynakDosyalari(): { yol: string; src: string }[] {
  const out: { yol: string; src: string }[] = [];
  const gez = (dir: string) => {
    for (const ad of readdirSync(dir)) {
      const tam = join(dir, ad);
      if (statSync(tam).isDirectory()) {
        if (ad === "node_modules" || ad === "__tests__") continue;
        gez(tam);
      } else if (/\.tsx?$/.test(ad) && !/\.test\.tsx?$/.test(ad)) {
        out.push({
          yol: tam.replace(process.cwd() + "/", ""),
          src: stripComments(readFileSync(tam, "utf-8")),
        });
      }
    }
  };
  gez(join(process.cwd(), "src"));
  return out;
}

describe("sadakat puani harcama yolu", () => {
  it("HENUZ YOK -- eklendiginde bu test duser ve B7'yi hatirlatir", () => {
    const bulunanlar: string[] = [];
    for (const { yol, src } of kaynakDosyalari()) {
      for (const iz of HARCAMA_IZLERI) {
        if (src.includes(iz)) bulunanlar.push(`${yol} (${iz})`);
      }
    }
    expect(
      bulunanlar,
      "Puan harcama yolu eklenmis gorunuyor. Yapilacaklar:\n" +
        "  1. docs/DEFECT_BACKLOG.md -> B7 maddesini kapat\n" +
        "  2. Iptal/iade yolunda harcanan puanin GERI verildigini dogrula\n" +
        "  3. Vaatlerin (LoyaltyBadge, Guest.loyaltyRewardsBody) artik karsiligi var\n" +
        "  4. Bu testi sil\n" +
        `Bulunanlar:\n${bulunanlar.join("\n")}`,
    ).toEqual([]);
  });

  it("puan yine de KAZANILIYOR ve iptalde geri aliniyor", () => {
    // Vaadin yarisi calisiyor; kayit dogru tutuluyor. Eksik olan harcama.
    const lifecycle = stripComments(
      readFileSync(join(process.cwd(), "src/services/booking/lifecycle.ts"), "utf-8"),
    );
    // Kazanma da iade de ayni dosyada: `awardLoyaltyPoints` ve `cancelBooking`.
    expect(lifecycle).toMatch(/"loyaltyPoints" = GREATEST\(0, "loyaltyPoints" - /);
    expect(lifecycle).toMatch(/"loyaltyPoints" = "loyaltyPoints" \+ /);
  });
});
