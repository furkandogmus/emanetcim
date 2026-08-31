import { describe, it, expect } from "vitest";
import { nextMilestone } from "@/lib/partner-milestones";

/**
 * Kilometre taşı eşikleri. Amaç motive etmek; yanlış seçilmiş bir eşik tam
 * tersini yapar.
 */
describe("kilometre taşı", () => {
  it("ilk valizde ulaşılabilir bir hedef gösterir", () => {
    // Sabit aralik (her 100'de bir) yeni esnafa 100'u hedef gosterirdi:
    // caydirici. Esikler seyreklesiyor.
    expect(nextMilestone(0)).toEqual({ target: 10, pct: 0 });
    expect(nextMilestone(3)).toEqual({ target: 10, pct: 30 });
  });

  it("eşik geçilince BİR SONRAKİNE atlar", () => {
    expect(nextMilestone(10)?.target).toBe(25);
    expect(nextMilestone(25)?.target).toBe(50);
    expect(nextMilestone(51)?.target).toBe(100);
  });

  it("son eşiği de geçen esnafa hedef göstermez", () => {
    // Ulasilamaz bir hedef ya da "%100 tamamlandi" diye donmus bir cubuk
    // gostermektense blogu gizlemek dogru.
    expect(nextMilestone(5000)).toBeNull();
    expect(nextMilestone(99999)).toBeNull();
  });

  it("yüzde hiçbir zaman 100'ü aşmaz", () => {
    for (const n of [9, 24, 49, 99, 249]) {
      const m = nextMilestone(n);
      expect(m!.pct, `${n}`).toBeLessThanOrEqual(100);
      expect(m!.pct).toBeGreaterThanOrEqual(0);
    }
  });
});
