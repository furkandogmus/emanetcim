/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useState, useEffect, useCallback } from "react";
import { computeOverdue } from "@/lib/overdue-display";

/**
 * P1-15 (DEFECT_BACKLOG) — Partner panelinde React #418 hydration hatası.
 *
 * `PartnerClient.tsx` gecikme durumunu `useState(() => new Date())` ile
 * başlatıyordu: bu başlangıç değeri sunucuda VE istemcinin hydration
 * render'ında AYRI AYRI hesaplanır. Aralarındaki fark (ağ + JS ayrıştırma)
 * bir rezervasyonun saat sınırını geçirirse `overdueHours` sunucuda "3",
 * istemcide "4" basar — metin içeriği uyuşmaz.
 *
 * Düzeltilen kalıp: `nowRef` mount öncesi `null` (sunucu ve ilk istemci
 * render'ı bu yüzden HER ZAMAN aynı "nötr" sonucu üretir), gerçek an
 * `useEffect`'te (mount sonrası, karşılaştırma dışı) atanır.
 */
function overdueOfOrNeutral(checkOutTime: string | Date, nowRef: Date | null) {
  return nowRef
    ? computeOverdue(checkOutTime, nowRef)
    : { severity: "none" as const, overdueHours: 0, overdueDays: 0 };
}

describe("overdueOfOrNeutral — düzeltilen mantık", () => {
  it("nowRef null iken (mount öncesi) çok gecikmiş bir rezervasyon bile 'none' döner", () => {
    const longOverdue = new Date(Date.now() - 100 * 60 * 60 * 1000);
    expect(overdueOfOrNeutral(longOverdue, null)).toEqual({
      severity: "none",
      overdueHours: 0,
      overdueDays: 0,
    });
  });

  it("nowRef atandıktan sonra gerçek gecikme durumunu hesaplar", () => {
    const now = new Date("2026-08-25T12:00:00Z");
    const threeHoursAgo = new Date("2026-08-25T09:00:00Z");
    expect(overdueOfOrNeutral(threeHoursAgo, now)).toEqual({
      severity: "due",
      overdueHours: 3,
      overdueDays: 0,
    });
  });
});

/**
 * Minimal bileşen: PartnerClient'in TAMAMINI render etmiyor (QR tarayıcı,
 * router, dialoglar gibi ağır bağımlılıkları var); yalnızca düzeltilen
 * `nowRef` state geçişini (null → gerçek an) uçtan uca doğruluyor.
 */
function MinimalOverdueDisplay({ checkOutTime }: { checkOutTime: string }) {
  const [nowRef, setNowRef] = useState<Date | null>(null);
  useEffect(() => {
    queueMicrotask(() => setNowRef(new Date()));
  }, []);
  const overdueOf = useCallback(
    (t: string | Date) => overdueOfOrNeutral(t, nowRef),
    [nowRef],
  );
  const info = overdueOf(checkOutTime);
  return <span>severity:{info.severity} hours:{info.overdueHours}</span>;
}

describe("MinimalOverdueDisplay — mount sonrası güncelleme", () => {
  it("mount sonrası gerçek gecikme durumuna geçer", async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    render(<MinimalOverdueDisplay checkOutTime={threeHoursAgo} />);
    await waitFor(() =>
      expect(screen.getByText(/severity:due hours:[23]/)).toBeTruthy(),
    );
  });
});
