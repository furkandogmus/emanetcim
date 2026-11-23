/**
 * Yorum satirinda "Bildir" ve "Bu kullanicinin yorumlarini gizle" (App Review 1.2):
 * neden secilmeden bildirim gitmez, secilen neden ve not uca gider, gizleme onayla
 * gider ve dukkanin yorum listesini tazeler. Oturumsuz goruntuleyen girise yonlenir.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { ReviewActions } from "@/components/ReviewActions";
import i18n from "@/lib/i18n";

jest.setTimeout(20_000);

const mockPush = jest.fn();
let mockSignedIn = true;
jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-router", () => ({ router: { push: (...a: unknown[]) => mockPush(...a), back: jest.fn() } }));
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ state: mockSignedIn ? { status: "signedIn", user: { id: "u1", role: "GUEST" } } : { status: "signedOut" } }),
}));

type Call = { path: string; method?: string; body?: unknown };
const mockCalls: Call[] = [];
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: async (path: string, opts: { method?: string; body?: unknown } = {}) => {
      mockCalls.push({ path, method: opts.method, body: opts.body });
      return { ok: true, autoHidden: false };
    },
  };
});

const alertSpy = jest.spyOn(Alert, "alert");
let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => qc.clear());
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  mockCalls.length = 0;
  mockSignedIn = true;
  mockPush.mockClear();
  alertSpy.mockReset();
});

describe("ReviewActions", () => {
  it("neden secilince bildirim nedeni ve notla gider", async () => {
    await render(<ReviewActions reviewId="r1" shopId="s1" />, { wrapper });
    await fireEvent.press(screen.getAllByRole("button", { name: "Bildir" })[0]);
    await screen.findByText("Yorumu bildir");

    const send = () => screen.getAllByRole("button", { name: "Bildir" }).at(-1)!;
    expect(send().props.accessibilityState?.disabled).toBe(true);

    await fireEvent.press(screen.getByRole("radio", { name: "Küfür veya hakaret" }));
    await fireEvent.changeText(screen.getByLabelText("Açıklama (isteğe bağlı)"), "  hakaret var  ");
    await fireEvent.press(send());

    await waitFor(() =>
      expect(mockCalls).toContainEqual({
        path: "/reviews/r1/report",
        method: "POST",
        body: { reason: "OFFENSIVE", note: "hakaret var" },
      }),
    );
    await waitFor(() => expect(alertSpy.mock.calls.at(-1)?.[0]).toBe("Teşekkürler, bildirimin ekibimize ulaştı."));
  });

  it("gizleme onaydan sonra gider ve dukkan yorumlarini tazeler", async () => {
    const invalidate = jest.spyOn(qc, "invalidateQueries");
    await render(<ReviewActions reviewId="r1" shopId="s1" />, { wrapper });
    await fireEvent.press(screen.getByRole("button", { name: "Bu kullanıcının yorumlarını gizle" }));
    const buttons = (alertSpy.mock.calls.at(-1)?.[2] ?? []) as { text?: string; onPress?: () => void }[];
    buttons.find((b) => b.text === "Gizle")?.onPress?.();

    await waitFor(() => expect(mockCalls).toContainEqual({ path: "/reviews/r1/block", method: "POST", body: undefined }));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["shops", "s1", "reviews"] }));
  });

  it("oturumsuz goruntuleyen girise gider, istek atilmaz", async () => {
    mockSignedIn = false;
    await render(<ReviewActions reviewId="r1" shopId="s1" />, { wrapper });
    await fireEvent.press(screen.getByRole("button", { name: "Bildir" }));
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(mockCalls).toEqual([]);
  });
});
