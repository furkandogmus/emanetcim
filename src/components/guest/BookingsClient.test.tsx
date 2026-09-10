/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BookingsClient from "./BookingsClient";
import type { PricingRules } from "@/lib/pricing-rules";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "tr",
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const PRICING_RULES = {} as PricingRules;

describe("BookingsClient", () => {
  /*
    REGRESYON (2026-09-10, PRODUCTION'DA yakalandi): taze, hiç rezervasyonu
    olmayan bir hesap "/bookings" sayfasını açtığında beyaz hata ekranı
    görüyordu. Sebep: `featuredBooking = upcomingBookings[0] ?? bookings[0]`
    boş listede `undefined` dönüyordu ve hemen altındaki
    `featuredBooking.id.replace(...)` satırı, bileşenin kendi boş-liste erken
    dönüşünden ÖNCE çalışıyordu — koruma hiç devreye girmeden `undefined.id`
    patlıyordu.
  */
  it("boş rezervasyon listesinde çökmeden boş durumu gösterir", () => {
    render(<BookingsClient bookings={[]} pricingRules={PRICING_RULES} />);

    expect(screen.getByText("noBookingsTitle")).toBeInTheDocument();
    expect(screen.getByText("exploreShops")).toBeInTheDocument();
  });
});
