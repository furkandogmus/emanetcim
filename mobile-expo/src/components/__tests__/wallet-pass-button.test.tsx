/** Cuzdan dugmesi: sunucu bayragi + platform kapisi, bag tarayicida acilir. */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Linking, Platform } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { WalletPassButton } from "@/components/WalletPassButton";

jest.setTimeout(20_000);

jest.mock("expo-secure-store", () => ({}));
jest.mock("expo-haptics", () => ({ selectionAsync: () => Promise.resolve() }));
const mockConfig: { data: Record<string, unknown> | undefined } = { data: undefined };
const mockFetch = jest.fn<(id: string, kind: string) => Promise<{ kind: string; url: string; expiresAt: string }>>();
jest.mock("@/lib/queries", () => ({
  useAppConfig: () => mockConfig,
  fetchWalletLink: (id: string, kind: string) => mockFetch(id, kind),
}));

beforeEach(() => {
  mockFetch.mockReset();
  mockConfig.data = undefined;
});

describe("WalletPassButton", () => {
  it("bayrak kapaliyken ya da eski sunucuda cizilmez", async () => {
    mockConfig.data = { minAppVersion: null, latestAppVersion: null };
    await render(<WalletPassButton bookingId="bk-1" status="APPROVED" />);
    expect(screen.queryByTestId("wallet-pass-button")).toBeNull();
  });

  it("platformun cuzdani acikken bagi alip tarayicida acar", async () => {
    mockConfig.data = { walletApple: true, walletGoogle: true };
    const kind = Platform.OS === "ios" ? "apple" : "google";
    mockFetch.mockResolvedValue({ kind, url: "https://example.test/api/wallet/x?t=abc", expiresAt: "2026-12-01T00:00:00Z" });
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    await render(<WalletPassButton bookingId="bk-1" status="APPROVED" />);
    await act(async () => {
      await fireEvent.press(screen.getByTestId("wallet-pass-button"));
    });
    expect(mockFetch).toHaveBeenCalledWith("bk-1", kind);
    expect(open).toHaveBeenCalledWith("https://example.test/api/wallet/x?t=abc");
  });
});
