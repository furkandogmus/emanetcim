import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  RESPONSE_TIME_MIN_SAMPLES,
  minutesBetween,
  p90Minutes,
} from "@/lib/shop-response-time";

/**
 * P2-7: "yanıt süresi" rozetinin arkasında hiçbir ölçüm yoktu.
 *
 * `Shop.responseTimeMinutes` şemada vardı, rozet arama ve dükkan detayında
 * çiziliyordu, ama `src/` içinde bu kolonu YAZAN tek bir kod yolu yoktu —
 * platform genelinde değer 0'dı. Rozet ya ölçülmüş bir sayıya dayanmalı ya da
 * hiç gösterilmemeli; ikisi arasındaki üçüncü seçenek (elle girilmiş bir sayı)
 * karşılıksız bir güven iddiasıdır.
 */
describe("yanıt süresi hesabı", () => {
  it("örnek yetersizse değer YAZILMAZ", () => {
    const few = Array.from({ length: RESPONSE_TIME_MIN_SAMPLES - 1 }, () => 4);
    expect(p90Minutes(few)).toBeNull();
    expect(p90Minutes([])).toBeNull();
  });

  it("yeterli örnekte p90 döner — ortanca değil", () => {
    // 1..10: ortanca 5.5, p90 9. Rozet "≤ X dk" dediği için üst sınır gerekir.
    const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(p90Minutes(samples)).toBe(9);
  });

  it("tek bir uzun gecikme iddiayı sessizce bozmaz", () => {
    // Dokuz hızlı onay + bir 8 saatlik gecikme: iddia hâlâ örneklerin %90'ında doğru.
    const samples = [3, 3, 4, 4, 5, 5, 6, 6, 7, 480];
    const value = p90Minutes(samples)!;
    expect(value).toBeLessThan(60);
    expect(samples.filter((s) => s <= value).length / samples.length).toBeGreaterThanOrEqual(0.9);
  });

  it("sıfıra yuvarlanmaz — 0 'veri yok' demek", () => {
    // Sema varsayilani 0; hizli bir dukkan icin 0 yazmak "olcum yok" ile karisirdi.
    expect(p90Minutes([0.1, 0.2, 0.2, 0.3, 0.4])).toBe(1);
  });

  it("negatif örnek (saat sapması) elenir", () => {
    expect(minutesBetween(new Date("2026-08-24T10:00:00Z"), new Date("2026-08-24T09:00:00Z"))).toBe(-60);
    expect(p90Minutes([-5, -5, -5, -5, -5])).toBeNull();
  });

  it("dakika farkı gerçek zamandan hesaplanır", () => {
    expect(
      minutesBetween(new Date("2026-08-24T10:00:00Z"), new Date("2026-08-24T10:07:30Z")),
    ).toBe(7.5);
  });

  it("rozet ölçüm yoksa çizilmez", () => {
    const src = fs.readFileSync("src/components/common/TrustBadge.tsx", "utf8");
    expect(src).toMatch(/minutes == null \|\| minutes <= 0\) return null/);
  });

  it("kolonu yazan gerçek bir kod yolu var", () => {
    // Maddenin ta kendisi buydu: kolon vardi, rozet vardi, YAZAN kod yoktu.
    const svc = fs.readFileSync("src/services/ShopService.ts", "utf8");
    expect(svc).toMatch(/responseTimeMinutes:\s*value/);
    expect(fs.existsSync("src/app/api/internal/response-times/route.ts")).toBe(true);
  });
});
