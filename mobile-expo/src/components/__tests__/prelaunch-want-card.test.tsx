/**
 * Talep testi karti: girissiz tik -> giris -> "Haber ver" ayni cihaz kimligiyle
 * yalniz haber verme kaydi ister (sayac ikinci kez artmaz, sunucu cihazla tekillestirir).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { PrelaunchWantCard } from "@/components/PrelaunchWantCard";
import i18n from "@/lib/i18n";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => "11111111-1111-4111-8111-111111111111",
  setItemAsync: async () => undefined,
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

let mockSignedIn = false;
jest.mock("@/lib/auth", () => ({
  useAuth: () => ({ state: mockSignedIn ? { status: "signedIn", user: { id: "u1", role: "GUEST" } } : { status: "signedOut" } }),
}));

const mockCalls: { path: string; body: { deviceId: string; notify: boolean } }[] = [];
jest.mock("@/lib/api", () => {
  const actual = jest.requireActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: async (path: string, opts: { body: { deviceId: string; notify: boolean } }) => {
      mockCalls.push({ path, body: opts.body });
      return { count: 3, alreadyCounted: mockCalls.length > 1, subscribed: opts.body.notify ? "new" : null };
    },
  };
});

let qc: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

beforeAll(async () => {
  await i18n.changeLanguage("tr");
});
afterEach(() => qc.clear());
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  mockCalls.length = 0;
  mockSignedIn = false;
});

describe("PrelaunchWantCard", () => {
  it("girissiz tik, sonra giris: 'Haber ver' ayni cihaz kimligiyle yalniz abonelik ister", async () => {
    const view = await render(<PrelaunchWantCard shopId="s1" initialCount={2} />, { wrapper });
    await fireEvent.press(screen.getByText("Açılınca haber ver"));
    await waitFor(() => expect(screen.getByText("Açıldığında e-postayla haber almak için giriş yap.")).toBeTruthy());
    expect(mockCalls[0].body).toMatchObject({ notify: false });

    mockSignedIn = true;
    await view.rerender(<PrelaunchWantCard shopId="s1" initialCount={2} />);
    await fireEvent.press(screen.getByText("Açılınca e-postayla haber ver"));
    await waitFor(() => expect(screen.getByText("Açıldığında hesabındaki e-postaya haber vereceğiz.")).toBeTruthy());
    expect(mockCalls[1].body).toMatchObject({ notify: true, deviceId: mockCalls[0].body.deviceId });
    expect(screen.queryByText("Açılınca e-postayla haber ver")).toBeNull();
  });

  it("girisli tik: tek istekte sayilir ve abone olur", async () => {
    mockSignedIn = true;
    await render(<PrelaunchWantCard shopId="s1" initialCount={0} />, { wrapper });
    await fireEvent.press(screen.getByText("Açılınca haber ver"));
    await waitFor(() => expect(screen.getByText("Açıldığında hesabındaki e-postaya haber vereceğiz.")).toBeTruthy());
    expect(mockCalls).toHaveLength(1);
    expect(screen.queryByText("Açılınca e-postayla haber ver")).toBeNull();
  });
});
