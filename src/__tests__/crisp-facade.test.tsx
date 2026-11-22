/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookie-consent-storage-key";

/**
 * Crisp cephesi: `l.js` hydration'da DEĞİL, yalnızca tıklamada iner; onay
 * kuralı aynı (yalnızca `all`).
 */
vi.mock("next-intl", () => ({ useTranslations: () => (k: string) => k }));

import CrispChat from "@/components/CrispChat";

const crispScript = () => document.querySelector('script[src="https://client.crisp.chat/l.js"]');

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_CRISP_WEBSITE_ID", "site-123");
  localStorage.clear();
  document.head.innerHTML = "";
  (window as { $crisp?: unknown[] }).$crisp = undefined;
  window.CRISP_READY_TRIGGER = undefined;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("CrispChat cephesi", () => {
  it("onaysız: ne düğme ne betik", () => {
    render(<CrispChat />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(crispScript()).toBeNull();
  });

  it("onaylı: düğme var ama betik tıklanana kadar yüklenmiyor", () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "all");
    render(<CrispChat />);
    expect(screen.getByRole("button", { name: "chatOpen" })).toBeInTheDocument();
    expect(crispScript()).toBeNull();
  });

  it("tıklama betiği bir kez ekler, düğme yüklenirken aria-busy ve odakta kalır", () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "all");
    render(<CrispChat />);
    const button = screen.getByRole("button", { name: "chatOpen" });
    button.focus();
    fireEvent.click(button);
    expect(crispScript()).not.toBeNull();
    expect(window.CRISP_WEBSITE_ID).toBe("site-123");
    expect(window.$crisp).toContainEqual(["do", "chat:open"]);
    // Eskiden düğme hemen kalkıyor, odak body'ye düşüyordu.
    expect(screen.getByRole("button", { name: "chatOpen" })).toHaveAttribute("aria-busy", "true");
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(document.querySelectorAll("script[data-bagajpark-crisp]")).toHaveLength(1);
  });

  it("Crisp hazır olunca odak sohbet kutusuna geçer, cephe kalkar", async () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "all");
    render(<CrispChat />);
    fireEvent.click(screen.getByRole("button", { name: "chatOpen" }));
    const box = document.createElement("div");
    box.id = "crisp-chatbox";
    const input = document.createElement("textarea");
    box.appendChild(input);
    document.body.appendChild(box);
    await act(async () => {
      window.CRISP_READY_TRIGGER?.();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("button", { name: "chatOpen" })).toBeNull();
    box.remove();
  });

  it("Crisp odak alamazsa düğme kalır, meşgul değil ve odakta", async () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "all");
    render(<CrispChat />);
    fireEvent.click(screen.getByRole("button", { name: "chatOpen" }));
    await act(async () => {
      window.CRISP_READY_TRIGGER?.();
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    const button = screen.getByRole("button", { name: "chatOpen" });
    expect(button).not.toHaveAttribute("aria-busy");
    expect(document.activeElement).toBe(button);
  });

  it("betik inmezse düğme boşa döner, sonraki tıklama yeniden dener", () => {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "all");
    render(<CrispChat />);
    fireEvent.click(screen.getByRole("button", { name: "chatOpen" }));
    act(() => {
      crispScript()!.dispatchEvent(new Event("error"));
    });
    expect(crispScript()).toBeNull();
    expect(screen.getByRole("button", { name: "chatOpen" })).not.toHaveAttribute("aria-busy");
  });

  it("onay sonradan verilirse düğme belirir, yine betik yok", () => {
    render(<CrispChat />);
    expect(screen.queryByRole("button")).toBeNull();
    act(() => {
      localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "all");
      window.dispatchEvent(new CustomEvent("bagajpark:cookie-consent"));
    });
    expect(screen.getByRole("button", { name: "chatOpen" })).toBeInTheDocument();
    expect(crispScript()).toBeNull();
  });

  it("site kimliği yoksa hiçbir şey çizmez", () => {
    vi.stubEnv("NEXT_PUBLIC_CRISP_WEBSITE_ID", "");
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, "all");
    render(<CrispChat />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
