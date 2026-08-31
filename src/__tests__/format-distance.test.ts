import { describe, it, expect } from "vitest";
import { formatDistance, distanceDisplay } from "@/lib/format-distance";

/**
 * Bu testin koruduğu şey bir sayı değil, OKUNABİLİRLİK.
 *
 * Arama listesi mesafeyi her zaman metreye çeviriyordu. Yakındaki bir dükkan
 * için doğru ("155 m"), ama 482 talep noktası küresel: İstanbul'da arama yapan
 * bir misafir Paris'i **"2259759 m uzakta"** diye görüyordu (2026-08-31 ekran
 * görüntüsü). Yedi haneli bir metre değeri okunmaz -- büyüklüğü anlamak için
 * basamak saymak gerekir.
 */
describe("mesafe biçimi", () => {
  it("bir kilometrenin altı metre, tam sayı", () => {
    expect(distanceDisplay(0.155)).toEqual({ unit: "m", amount: 155, fractionDigits: 0 });
    expect(formatDistance(0.155, "tr")).toEqual({ key: "awayMeters", value: "155" });
  });

  it("yürüme mesafesinde bir ondalık kalıyor -- 2,3 ile 2,4 kararı değiştirir", () => {
    expect(formatDistance(2.34, "tr").value).toBe("2,3");
    expect(formatDistance(2.34, "en").value).toBe("2.3");
  });

  it("tam kilometrede gereksiz sıfır yazılmıyor", () => {
    // `formatDecimal` alt ve üst sınırı birlikte sabitledigi icin "2,0" veriyordu.
    expect(formatDistance(2, "tr").value).toBe("2");
  });

  it("uzak mesafede ondalık düşüyor ve binlik ayıracı dile göre geliyor", () => {
    expect(distanceDisplay(2259.759).unit).toBe("km");
    expect(formatDistance(2259.759, "tr")).toEqual({ key: "awayKm", value: "2.260" });
    expect(formatDistance(2259.759, "en").value).toBe("2,260");
  });

  it("hatalı girdi çökertmiyor", () => {
    expect(formatDistance(Number.NaN, "tr").key).toBe("awayMeters");
    expect(formatDistance(-5, "tr").value).toBe("0");
  });
});
