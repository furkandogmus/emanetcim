import { describe, it, expect } from "vitest";
import { computeOverdue } from "@/lib/overdue-display";
import { OVERDUE_TIERS } from "@/services/OverdueBookingService";

/**
 * Partner panelindeki gecikme rozeti.
 *
 * Neden var: prod'da 19 rezervasyonun 18'i çıkış saatini geçmiş hâlde açıktı,
 * üçü Haziran'dan beri (P1-6, P1-22). Kodu okuyarak doğruladım: çıkış butonu
 * **vardı** ve liste tarih filtresi taşımıyordu — yani o kayıtlar butonlarıyla
 * birlikte ekrandaydı. Sorun görünürlük değil **ayırt edilebilirlikti**: bir
 * Haziran rezervasyonu listede dünkü bir rezervasyondan hiçbir farkla
 * görünmüyordu.
 */

const NOW = new Date("2026-08-22T12:00:00.000Z");
const H = 60 * 60 * 1000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * H);

describe("computeOverdue", () => {
  it("çıkış saati gelmemişse gecikme yok", () => {
    const future = new Date(NOW.getTime() + 5 * H);
    expect(computeOverdue(future, NOW).severity).toBe("none");
  });

  it("tam çıkış anında henüz gecikme yok", () => {
    expect(computeOverdue(NOW, NOW).severity).toBe("none");
  });

  it.each([
    [1, "due"],
    [23, "due"],
    [24, "late"],
    [71, "late"],
    [72, "critical"],
    [1700, "critical"],
  ])("%s saatlik gecikme → %s", (hours, expected) => {
    expect(computeOverdue(ago(hours as number), NOW).severity).toBe(expected);
  });

  it("gün sayısını doğru verir — rozet metni bunu kullanıyor", () => {
    expect(computeOverdue(ago(25), NOW).overdueDays).toBe(1);
    expect(computeOverdue(ago(47), NOW).overdueDays).toBe(1);
    expect(computeOverdue(ago(48), NOW).overdueDays).toBe(2);
  });

  it("2026-08-22'deki gerçek durumu sınıflandırır (Haziran'dan beri açık)", () => {
    // 12 Haziran'dan 22 Agustos'a ~1700 saat.
    const info = computeOverdue(ago(1700), NOW);
    expect(info.severity).toBe("critical");
    expect(info.overdueDays).toBeGreaterThan(60);
  });

  it("ISO metin girdisini de kabul eder", () => {
    expect(computeOverdue(ago(30).toISOString(), NOW).severity).toBe("late");
  });

  it("bozuk tarihte ÇÖKMEZ ve gecikme uydurmaz", () => {
    expect(computeOverdue("bu bir tarih degil", NOW).severity).toBe("none");
    expect(computeOverdue(new Date(NaN), NOW).overdueHours).toBe(0);
  });

  it("eşikler sunucu tarafındaki tarama ile HİZALI", () => {
    // OverdueBookingService ayni esikleri kullaniyor; ayrisirlarsa partner
    // "kritik" goren bir kayit icin sunucu hicbir olay yazmiyor olabilir.
    const serverHours = OVERDUE_TIERS.map((t) => t.hours);
    expect(serverHours).toContain(24);
    expect(serverHours).toContain(72);
  });
});
