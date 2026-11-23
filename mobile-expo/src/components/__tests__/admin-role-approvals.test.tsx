/**
 * Rol onaylari ekrani: onay/red sayfa ici onay panelinden gecmeden istek gitmez, kendi
 * istegin onaylanamaz, sunucunun "istek kalkti" kodlari cevrilir ve liste tazelenir,
 * her hata kodunun ceviri metni var.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Alert } from "react-native";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import AdminRoleApprovalsScreen from "@/app/(admin)/admin/role-approvals";
import { ApiError } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import i18n from "@/lib/i18n";
import type { AdminRoleChangeRequest } from "@/lib/types";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock("expo-notifications", () => ({ setNotificationHandler: jest.fn() }));
jest.mock("expo-constants", () => ({ expoConfig: {} }));
jest.mock("@/lib/auth", () => ({ useAuth: () => ({ state: { status: "signedIn", user: { id: "admin-1", role: "ADMIN" } } }) }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

const mockCalls: string[] = [];
let mockHandler: (path: string) => Promise<unknown> = async () => ({});
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: (path: string) => {
      mockCalls.push(path);
      return mockHandler(path);
    },
  };
});

const OTHERS: AdminRoleChangeRequest = {
  id: "r1",
  previousRole: "PARTNER",
  requestedRole: "ADMIN",
  createdAt: "2026-11-23T10:00:00.000Z",
  target: { id: "p1", name: "Ayşe", email: "ayse@example.com", role: "PARTNER" },
  requestedBy: { id: "admin-2", name: "Mehmet", email: "m@example.com" },
  isOwnRequest: false,
};
const MINE: AdminRoleChangeRequest = { ...OTHERS, id: "r2", target: { ...OTHERS.target, id: "p2", name: "Can" }, isOwnRequest: true };

let rows: AdminRoleChangeRequest[] = [];
let qc: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const posts = () => mockCalls.filter((p) => p !== "/admin/role-approvals");
const alertSpy = jest.spyOn(Alert, "alert");

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => qc.clear());
beforeEach(() => {
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  mockCalls.length = 0;
  rows = [OTHERS];
  alertSpy.mockReset();
  mockHandler = async (path) => (path === "/admin/role-approvals" ? rows : { ok: true });
});

async function renderScreen() {
  await render(<AdminRoleApprovalsScreen />, { wrapper });
  await screen.findByTestId(`role-request-${rows[0]?.id ?? "none"}`, undefined, { timeout: 8000 });
}

describe("rol onaylari ekrani", () => {
  it("onay, panelde ikinci dokunus olmadan gitmez; sonra dogru uca gider", async () => {
    await renderScreen();
    fireEvent.press(screen.getAllByRole("button", { name: "Onayla" })[0]);
    expect(posts()).toEqual([]);
    await screen.findByTestId("role-decision-confirm");
    expect(screen.getByText("Ayşe kullanıcısının rolü Esnaf → Yönetici olacak. Açık oturumları hemen kapanır.")).toBeTruthy();

    const buttons = screen.getAllByRole("button", { name: "Onayla" });
    await act(async () => fireEvent.press(buttons[buttons.length - 1]));
    await waitFor(() => expect(posts()).toEqual(["/admin/role-approvals/r1/approve"]));
    expect(alertSpy).toHaveBeenCalledWith("Rol değişikliği uygulandı.", undefined, expect.anything());
  });

  it("red de onay panelinden gecer", async () => {
    await renderScreen();
    fireEvent.press(screen.getAllByRole("button", { name: "Reddet" })[0]);
    await screen.findByText("İstek reddedilsin mi?");
    const buttons = screen.getAllByRole("button", { name: "Reddet" });
    await act(async () => fireEvent.press(buttons[buttons.length - 1]));
    await waitFor(() => expect(posts()).toEqual(["/admin/role-approvals/r1/reject"]));
  });

  it("kendi istegin onaylanamaz, geri cekilebilir", async () => {
    rows = [MINE];
    await renderScreen();
    expect(screen.getByText("Bu isteği sen açtın; başka bir yönetici onaylamalı.")).toBeTruthy();
    const approve = screen.getByRole("button", { name: "Onayla" });
    expect(approve.props.accessibilityState?.disabled).toBe(true);
    // Kendi isteginde red yerine "geri cek" yazar; ayni uca gider.
    expect(screen.queryByRole("button", { name: "Reddet" })).toBeNull();
    fireEvent.press(screen.getByRole("button", { name: "Talebi geri çek" }));
    await screen.findByText("Talep geri çekilsin mi?");
    const buttons = screen.getAllByRole("button", { name: "Talebi geri çek" });
    await act(async () => fireEvent.press(buttons[buttons.length - 1]));
    await waitFor(() => expect(posts()).toEqual(["/admin/role-approvals/r2/reject"]));
    expect(alertSpy).toHaveBeenCalledWith("Talep geri çekildi.", undefined, expect.anything());
  });

  it("istek sunucuda kalktiysa kod cevrilir ve liste yeniden sorulur", async () => {
    await renderScreen();
    mockHandler = async (path) => {
      if (path === "/admin/role-approvals") return rows;
      throw new ApiError(409, "stale");
    };
    fireEvent.press(screen.getAllByRole("button", { name: "Onayla" })[0]);
    await screen.findByTestId("role-decision-confirm");
    const buttons = screen.getAllByRole("button", { name: "Onayla" });
    const listCallsBefore = mockCalls.filter((p) => p === "/admin/role-approvals").length;
    await act(async () => fireEvent.press(buttons[buttons.length - 1]));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith("Kullanıcının rolü bu arada değişmiş; istek kaldırıldı.", undefined, expect.anything()),
    );
    await waitFor(() =>
      expect(mockCalls.filter((p) => p === "/admin/role-approvals").length).toBeGreaterThan(listCallsBefore),
    );
  });

  it("her sunucu hata kodunun ceviri metni var", () => {
    for (const code of ["cannot_self_approve", "stale", "cannot_demote_sole_admin", "not_found"]) {
      expect(errorMessage(new ApiError(409, code), "roleApprovals")).not.toBe(i18n.t("common.genericError"));
    }
  });
});
