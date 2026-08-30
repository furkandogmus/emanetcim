import { describe, it, expect } from "vitest";
import { clusterByScreenDistance } from "@/components/guest/SearchMap";

/**
 * HARİTA PİNLERİNİN ÇAKIŞMASI.
 *
 * NEDEN (2026-08-31 mobil ölçümü): talep testi 50 noktadan 482'ye çıkınca
 * İstanbul gibi yoğun bir merkezde altı "Yakında" etiketi birbirinin üstüne
 * biniyor ve HİÇBİRİ okunmuyordu. Nokta eklemek haritayı okunmaz yapmamalı —
 * yoksa ölçmek için eklenen noktalar, ölçmek istediğimiz davranışı engeller.
 *
 * Kümeleme EKRAN PİKSELİYLE yapılıyor, coğrafi mesafeyle değil: çakışma bir
 * görüntü olayı. Aynı iki nokta z=10'da üst üste binerken z=16'da rahatça ayrı
 * durur; coğrafi bir eşik yakınlaştırmadan bağımsız olur ve ya erken kümeler
 * ya da hiç kümelemez.
 */
const p = (id: string, x: number, y: number) => ({ id, x, y });

describe("clusterByScreenDistance", () => {
  it("uzak noktalar ayri kalir", () => {
    const groups = clusterByScreenDistance([p("a", 0, 0), p("b", 200, 200)]);
    expect(groups).toHaveLength(2);
  });

  it("ust uste binenler TEK gruba iner", () => {
    const groups = clusterByScreenDistance([
      p("a", 100, 100),
      p("b", 110, 105),
      p("c", 120, 100),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it("esik degeri disari acik ve uygulanir", () => {
    const pts = [p("a", 0, 0), p("b", 50, 0)];
    expect(clusterByScreenDistance(pts, 44)).toHaveLength(2);
    expect(clusterByScreenDistance(pts, 60)).toHaveLength(1);
  });

  it("grubun TEMSILCISI listenin ilk ogesidir", () => {
    /**
     * Liste mesafeye/puana göre sıralı geliyor; kümenin pin'i o yüzden en
     * alakalı noktanın konumunda duruyor. Sıraya bağlı olması kasıtlı ve
     * kararlı: her `moveend`'de yeniden hesaplanıyor, pin'ler zıplamamalı.
     */
    const groups = clusterByScreenDistance([p("yakin", 0, 0), p("uzak", 10, 10)]);
    expect(groups[0][0].id).toBe("yakin");
  });

  it("bos liste bos donus", () => {
    expect(clusterByScreenDistance([])).toEqual([]);
  });

  it("her nokta TAM BIR kez yer alir", () => {
    // Bir noktanın iki gruba birden düşmesi, haritada iki kez çizilmesi demek.
    const pts = Array.from({ length: 30 }, (_, i) => p(`s${i}`, (i % 6) * 20, Math.floor(i / 6) * 20));
    const groups = clusterByScreenDistance(pts);
    const ids = groups.flat().map((g) => g.id);
    expect(ids).toHaveLength(30);
    expect(new Set(ids).size).toBe(30);
  });
});
