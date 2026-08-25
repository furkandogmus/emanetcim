/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoyaltyBadge from "@/components/guest/LoyaltyBadge";

/**
 * `User.loyaltyPoints` her rezervasyonda sessizce artıyor (`actions/booking.ts`)
 * ve iptalde azalıyor (`booking/lifecycle.ts`) ama bu bileşen hiçbir sayfada
 * render edilmiyordu — misafir puan kazanıyordu ama bunu asla göremiyordu.
 * Artık `/account`'ta render ediliyor; bu test rozetin kendisini kilitliyor.
 */
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) =>
    ({ loyaltyPoints: "puan", loyaltyDiscount: "indirim" })[key] ?? key,
}));

describe("LoyaltyBadge", () => {
  it("50 puanın altında hiçbir şey render etmez", () => {
    const { container } = render(<LoyaltyBadge points={49} locale="tr" />);
    expect(container.firstChild).toBeNull();
  });

  it("50 puan ve üzerinde puan + TRY karşılığını gösterir", () => {
    render(<LoyaltyBadge points={500} locale="tr" />);
    expect(screen.getByText(/500/)).toBeTruthy();
    expect(screen.getByText(/puan/)).toBeTruthy();
    // 500 puan / 100 = ₺5,00
    expect(screen.getByText(/5,00/)).toBeTruthy();
  });

  it("locale verilmezse tr'ye düşer", () => {
    render(<LoyaltyBadge points={100} />);
    expect(screen.getByText(/1,00/)).toBeTruthy();
  });
});
