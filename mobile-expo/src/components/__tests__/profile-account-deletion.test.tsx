/**
 * Profil: esnaf/yonetici hesabini uygulama icinden silme talebiyle kapatir (App Store
 * 5.1.1(v)); talep sonrasi "N gun icinde silinir" onayi ve bekleyen talebin son gunu
 * gorunur. Destek bolumunde KVKK aydinlatma metni baglantisi var.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert, Linking } from "react-native";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { ProfileView } from "@/components/ProfileView";
import i18n from "@/lib/i18n";

jest.setTimeout(20_000);

let mockRole = "PARTNER";
jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: () => Promise.resolve({ granted: true }),
}));
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.0" } }));
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({
    state: { status: "signedIn", user: { id: "p1", role: mockRole, name: "Ayse", email: "ayse@example.com", phone: null } },
    signOut: jest.fn(),
    impersonating: false,
  }),
}));
jest.mock("@/components/ReferralCard", () => ({ ReferralCard: () => null }));
jest.mock("@/components/Avatar", () => ({ Avatar: () => null }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

type Call = { path: string; method?: string; body?: unknown };
const mockCalls: Call[] = [];
let mockMine: Record<string, unknown> = { status: null, requestedAt: null, dueAt: null, slaDays: 30 };
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: async (path: string, opts: { method?: string; body?: unknown } = {}) => {
      mockCalls.push({ path, method: opts.method, body: opts.body });
      if (path === "/account/deletion-request" && opts.method === "POST") {
        return { status: "PENDING", requestedAt: "2026-11-23T10:00:00.000Z", dueAt: "2026-12-23T10:00:00.000Z", slaDays: 30 };
      }
      if (path === "/account/deletion-request") return mockMine;
      return {};
    },
  };
});

const alertSpy = jest.spyOn(Alert, "alert");
const openSpy = jest.spyOn(Linking, "openURL").mockResolvedValue(true);

let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
async function pressAlertButton(text: string) {
  const buttons = (alertSpy.mock.calls.at(-1)?.[2] ?? []) as { text?: string; onPress?: () => void }[];
  const b = buttons.find((x) => x.text === text);
  if (!b?.onPress) throw new Error(`Alert dugmesi yok: ${text}`);
  // Mutasyon act disinda baslar; sonucu `waitFor` bekler (ic ice act React'i bozuyor).
  b.onPress();
}

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => qc.clear());
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
  mockCalls.length = 0;
  mockRole = "PARTNER";
  mockMine = { status: null, requestedAt: null, dueAt: null, slaDays: 30 };
  alertSpy.mockReset();
  openSpy.mockClear();
});

describe("esnaf hesap silme talebi", () => {
  it("onaydan sonra talep gider ve 30 gun icinde silinecegi soylenir", async () => {
    await render(<ProfileView asTab />, { wrapper });
    const button = await screen.findByRole("button", { name: "Hesabımı sil" });
    await fireEvent.press(button);
    expect(alertSpy.mock.calls.at(-1)?.[0]).toBe("Hesabın silinsin mi?");
    await pressAlertButton("Silme talebi gönder");

    const post = mockCalls.find((c) => c.method === "POST");
    expect(post).toMatchObject({ path: "/account/deletion-request", body: { locale: "tr" } });
    await waitFor(() =>
      expect(alertSpy.mock.calls.at(-1)?.slice(0, 2)).toEqual([
        "Talebin alındı",
        "Talebin alındı; 30 gün içinde hesabın silinir, tamamlanınca e-posta gelir.",
      ]),
    );
    expect(await screen.findByText(/Silme talebin alındı\. Hesabın en geç/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hesabımı sil" })).toBeNull();
  });

  it("bekleyen talep varsa dugme yerine son gun gorunur", async () => {
    mockMine = { status: "PENDING", requestedAt: "2026-11-23T10:00:00.000Z", dueAt: "2026-12-23T10:00:00.000Z", slaDays: 30 };
    await render(<ProfileView asTab />, { wrapper });
    expect(await screen.findByText(/Silme talebin alındı\. Hesabın en geç/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hesabımı sil" })).toBeNull();
  });

  it("misafir talep ucunu hic cagirmaz (aninda silme yolu)", async () => {
    mockRole = "GUEST";
    await render(<ProfileView asTab />, { wrapper });
    await screen.findByRole("button", { name: "Hesabımı sil" });
    expect(mockCalls.some((c) => c.path === "/account/deletion-request")).toBe(false);
  });
});

describe("destek baglantilari", () => {
  it("KVKK aydinlatma metni tarayicida /kvkk acar", async () => {
    await render(<ProfileView asTab />, { wrapper });
    await fireEvent.press(await screen.findByText("KVKK aydınlatma metni"));
    expect(String(openSpy.mock.calls.at(-1)?.[0])).toMatch(/\/kvkk$/);
  });
});
