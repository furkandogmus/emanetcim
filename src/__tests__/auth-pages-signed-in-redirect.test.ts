import { describe, it, expect, vi, beforeEach } from "vitest";

/** Oturum acikken /login ve /register `callbackUrl`e doner, /search'e degil. */
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: m.auth }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/app/[locale]/login/LoginClient", () => ({ default: () => null }));
vi.mock("@/app/[locale]/register/RegisterClient", () => ({ default: () => null }));
vi.mock("@/lib/auth-providers", () => ({ isAppleOAuthConfigured: () => false, isAuthDemoUiEnabled: () => false }));
vi.mock("@/lib/seo-alternates", () => ({ alternatesForPath: vi.fn() }));
vi.mock("@/lib/guest-static-seo", () => ({ getGuestStaticSeo: vi.fn() }));
vi.mock("@/lib/site-urls", () => ({ getSiteBaseUrl: () => "https://example.test" }));
vi.mock("@/lib/social-metadata", () => ({ socialMetadata: vi.fn() }));

import LoginPage from "@/app/[locale]/login/page";
import RegisterPage from "@/app/[locale]/register/page";

const params = Promise.resolve({ locale: "tr" });
const cb = "/tr/checkout/s1?checkIn=2030-05-01&bagM=2";

beforeEach(() => {
  vi.clearAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u1", role: "USER" } });
});

describe.each([
  ["login", LoginPage],
  ["register", RegisterPage],
] as const)("/%s oturum acikken", (_name, Page) => {
  it("callbackUrl'e yonlenir", async () => {
    await expect(Page({ params, searchParams: Promise.resolve({ callbackUrl: cb }) })).rejects.toThrow(`REDIRECT:${cb}`);
  });

  it("dis site callbackUrl'i yok sayilir, rol sayfasina gider", async () => {
    await expect(
      Page({ params, searchParams: Promise.resolve({ callbackUrl: "//evil.com" }) }),
    ).rejects.toThrow("REDIRECT:/tr/search");
  });

  it("oturum yoksa yonlendirme yok", async () => {
    m.auth.mockResolvedValue(null);
    await Page({ params, searchParams: Promise.resolve({ callbackUrl: cb }) });
    expect(m.redirect).not.toHaveBeenCalled();
  });
});
