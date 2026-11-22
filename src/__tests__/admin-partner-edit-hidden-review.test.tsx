/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

/** Web admin dukkan duzenleme: mobilde gizlenen yorum isaretsiz gorunmesin (QA, 2026-11-23). */
vi.mock("next-intl", () => {
  const t = Object.assign((key: string, v?: Record<string, string>) => (v ? `${key}:${JSON.stringify(v)}` : key), {
    has: () => true,
  });
  return { useTranslations: () => t, useLocale: () => "tr" };
});
vi.mock("@/i18n/routing", () => ({
  Link: ({ children }: { children: unknown }) => children,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/actions/admin-management", () => ({ updateShopAction: vi.fn(), deleteReviewAction: vi.fn() }));
vi.mock("@/components/common/StarRating", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminPartnerEditClient from "@/components/admin/AdminPartnerEditClient";

const review = (id: string, comment: string, hidden: boolean) => ({
  id,
  rating: 1,
  comment,
  createdAt: "2026-11-20T10:00:00Z",
  hiddenAt: hidden ? "2026-11-21T10:00:00Z" : null,
  hiddenReason: hidden ? "Hakaret" : null,
  guest: { name: "Ada" },
});

const shop = {
  id: "s1",
  name: "Dukkan",
  address: null,
  latitude: null,
  longitude: null,
  capacity: 10,
  pricePerDay: 100,
  isActive: true,
  isTest: false,
  isVerified: false,
  rating: 4,
  owner: { name: "Esnaf", phone: null },
  reviews: [review("r1", "Gizlenen metin", true), review("r2", "Gorunen metin", false)],
  _count: { bookings: 0 },
};

describe("AdminPartnerEditClient gizli yorum", () => {
  it("yalnizca gizlenen yorumda Gizli rozeti ve nedeni var", () => {
    render(<AdminPartnerEditClient shop={shop} />);
    const badges = screen.getAllByText("reviewHiddenBadge");
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveAttribute("title", 'reviewHiddenReason:{"reason":"Hakaret"}');
    const hiddenCard = screen.getByText(/Gizlenen metin/).closest("div.group");
    expect(hiddenCard).toContainElement(badges[0]);
  });
});
