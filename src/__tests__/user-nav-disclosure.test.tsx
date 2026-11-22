/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Kullanıcı menüsü açıklama (disclosure) deseni: menu/menuitem rolü yok
 * (ok tuşu desteği yoktu), düğme aria-expanded + aria-controls taşır,
 * Escape kapatır ve odağı düğmeye geri verir, dışarı tıklama kapatır.
 */
vi.mock("next-auth/react", () => ({
  signOut: vi.fn(),
  useSession: () => ({
    status: "authenticated",
    data: { user: { name: "Ada Yilmaz", email: "ada@example.com", role: "GUEST" } },
  }),
}));
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));
vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href, onClick, className }: { children: React.ReactNode; href: string; onClick?: () => void; className?: string }) => (
    <a href={href} onClick={onClick} className={className}>{children}</a>
  ),
}));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  return {
    motion: {
      div: ({ initial: _i, animate: _a, exit: _e, ...rest }: Record<string, unknown>) =>
        React.createElement("div", rest),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

import UserNav from "@/components/layout/UserNav";

const toggle = () => screen.getByRole("button", { name: /welcomeGreeting/ });

describe("UserNav", () => {
  it("aria-expanded açılıp kapanırken değişir, aria-controls panele işaret eder", () => {
    render(<UserNav />);
    const button = toggle();
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(button.getAttribute("aria-controls")!);
    expect(panel).not.toBeNull();
    expect(panel).toContainElement(screen.getByText("navBookings"));
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("menu/menuitem rolü yok, bağlantılar düz liste", () => {
    render(<UserNav />);
    fireEvent.click(toggle());
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("link", { name: "navBookings" })).toBeInTheDocument();
  });

  it("Escape kapatır ve odağı düğmeye geri verir", () => {
    render(<UserNav />);
    const button = toggle();
    fireEvent.click(button);
    screen.getByRole("link", { name: "navBookings" }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(button);
  });

  it("dışarı tıklama kapatır", () => {
    render(<UserNav />);
    const button = toggle();
    fireEvent.click(button);
    fireEvent.mouseDown(document.body);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });
});
