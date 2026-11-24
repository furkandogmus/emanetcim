/**
 * `/link` ekrani: girissiz acilan web baglantisi saklanip girise gider, misafir esnaf
 * baglantisinda aciklama ve hesap degistirme gorur, esnaf daveti web formuna yonlenir.
 */
import { fireEvent, render, screen } from "@testing-library/react-native";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import DeepLinkScreen from "@/app/link";
import { takePendingLink } from "@/lib/deep-link-target";
import i18n from "@/lib/i18n";

const BK = "0f8fad5b-d9cb-469f-a165-70867728950e";

jest.mock("expo-secure-store", () => ({}));
const mockRedirect = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));
let mockAuth: { state: unknown; signOut: () => Promise<void>; impersonating: unknown };
jest.mock("@/lib/auth", () => ({ useAuth: () => mockAuth }));
const mockOpenSite = jest.fn();
jest.mock("@/lib/site-page", () => ({ openSitePage: (...a: unknown[]) => mockOpenSite(...a) }));

const signedIn = (role: string) => ({ status: "signedIn", user: { id: "u1", role } });

beforeEach(() => {
  mockRedirect.mockReset();
  mockOpenSite.mockReset();
  takePendingLink();
  void i18n.changeLanguage("tr");
});

describe("DeepLinkScreen", () => {
  it("girissizse hedef saklanir ve giris acilir", async () => {
    mockParams = { kind: "booking", id: BK };
    mockAuth = { state: { status: "signedOut" }, signOut: jest.fn(async () => undefined), impersonating: null };
    await render(<DeepLinkScreen />);
    expect(mockRedirect).toHaveBeenCalledWith("/login");
    expect(takePendingLink()).toEqual({ kind: "booking", id: BK });
  });

  it("rolu tutan kullanici dogrudan ekrana gider", async () => {
    mockParams = { kind: "partner-booking", id: BK };
    mockAuth = { state: signedIn("PARTNER"), signOut: jest.fn(async () => undefined), impersonating: null };
    await render(<DeepLinkScreen />);
    expect(mockRedirect).toHaveBeenCalledWith(`/partner/${BK}`);
    expect(takePendingLink()).toBeNull();
  });

  it("misafir esnaf baglantisinda aciklama gorur; hesap degistirince hedef korunur", async () => {
    mockParams = { kind: "partner-booking", id: BK };
    const signOut = jest.fn(async () => undefined);
    mockAuth = { state: signedIn("GUEST"), signOut, impersonating: null };
    await render(<DeepLinkScreen />);
    expect(screen.getByText(i18n.t("deepLink.partnerOnlyTitle"))).toBeTruthy();
    await fireEvent.press(screen.getByText(i18n.t("deepLink.switchAccount")));
    expect(signOut).toHaveBeenCalled();
    expect(takePendingLink()).toEqual({ kind: "partner-booking", id: BK });
  });

  it("goruntuleme modunda hesap degistirme sunulmaz", async () => {
    mockParams = { kind: "partner-booking", id: BK };
    mockAuth = { state: signedIn("GUEST"), signOut: jest.fn(async () => undefined), impersonating: { userId: "x" } };
    await render(<DeepLinkScreen />);
    expect(screen.queryByText(i18n.t("deepLink.switchAccount"))).toBeNull();
  });

  it("esnaf daveti web kayit formunu kodla acar", async () => {
    mockParams = { kind: "partner-invite", id: "ABCD2345" };
    mockAuth = { state: { status: "signedOut" }, signOut: jest.fn(async () => undefined), impersonating: null };
    await render(<DeepLinkScreen />);
    await fireEvent.press(screen.getByText(i18n.t("deepLink.openOnWeb")));
    expect(mockOpenSite).toHaveBeenCalledWith("register?role=PARTNER&ref=ABCD2345", "tr");
  });

  it("bozuk parametre ana ekrana duser", async () => {
    mockParams = { kind: "booking", id: "../x" };
    mockAuth = { state: signedIn("GUEST"), signOut: jest.fn(async () => undefined), impersonating: null };
    await render(<DeepLinkScreen />);
    expect(mockRedirect).toHaveBeenCalledWith("/");
  });
});
