/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PartnerBookingListItem } from "@/services/BookingService";
import PartnerHistoryTab from "@/components/partner/PartnerHistoryTab";

/**
 * Esnaf geçmişindeki tarih DÜKKANIN diliminde: 21:30Z İstanbul'da ertesi gündür.
 */
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

const booking = {
  id: "b1",
  checkInTime: new Date("2026-08-22T21:30:00Z"),
  checkOutTime: new Date("2026-08-23T10:00:00Z"),
  totalPrice: 100,
  bagCountS: 0,
  bagCountM: 1,
  bagCountXl: 0,
  status: "CHECKED_OUT",
  createdAt: new Date("2026-08-20T10:00:00Z"),
  guest: { name: "Ada" },
} as unknown as PartnerBookingListItem;

function renderTab(timeZone?: string) {
  return render(
    <PartnerHistoryTab
      bookings={[booking]}
      merchantShareRatio={0.5}
      dateLocale="tr-TR"
      overdueOf={() => ({ severity: "none", overdueHours: 0, overdueDays: 0 })}
      checkingOutId={null}
      onCheckout={() => {}}
      timeZone={timeZone}
    />,
  );
}

describe("PartnerHistoryTab saat dilimi", () => {
  it("dilim verilmezse platform dilimi (İstanbul): ertesi gün", () => {
    renderTab();
    expect(screen.getByText("23.08.2026")).toBeInTheDocument();
  });

  it("dükkanın dilimi kullanılır", () => {
    renderTab("Europe/London");
    expect(screen.getByText("22.08.2026")).toBeInTheDocument();
  });
});
