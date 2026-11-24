/** Kilit kimseyi disari kilitlemez; taze giriste ve goruntulemede yeniden kilitlemez. */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import "@/lib/i18n";
import { AppLockGate } from "@/components/AppLockGate";

type User = { id: string; role: string };
type AuthMock = { state: { status: string; user?: User }; impersonating: { user: User } | null; signOut: () => Promise<void> };
const mockSignOut = jest.fn(async () => undefined);
let mockAuthState: AuthMock;
jest.mock("@/lib/auth", () => ({ useAuth: () => mockAuthState }));

let mockPath = "/";
const mockDismissAll = jest.fn();
const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  usePathname: () => mockPath,
  router: { canDismiss: () => true, dismissAll: () => mockDismissAll(), push: (p: string) => mockPush(p) },
}));

const mockAuthenticate = jest.fn(async (): Promise<"ok" | "cancel" | "unavailable"> => "cancel");
const mockCanLock = jest.fn(async () => true);
const mockReadPref = jest.fn(async (_id: string): Promise<boolean | null> => null);
jest.mock("@/lib/app-lock", () => {
  const real = jest.requireActual<typeof import("@/lib/app-lock")>("@/lib/app-lock");
  return {
    ...real,
    deviceCanLock: () => mockCanLock(),
    authenticate: () => mockAuthenticate(),
    readLockPref: (id: string) => mockReadPref(id),
    writeLockPref: async () => undefined,
  };
});
jest.mock("lucide-react-native", () => ({ LockKeyhole: () => null }));
jest.mock("expo-secure-store", () => ({ getItemAsync: async () => null, setItemAsync: async () => undefined }));

const signedIn = (user: User, impersonating: User | null = null): AuthMock => ({
  state: { status: "signedIn", user: impersonating ?? user },
  impersonating: impersonating ? { user: impersonating } : null,
  signOut: mockSignOut,
});

async function ui() {
  return await render(
    <AppLockGate>
      <Text>icerik</Text>
    </AppLockGate>,
  );
}

describe("AppLockGate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPath = "/";
    mockAuthState = signedIn({ id: "admin1", role: "ADMIN" });
  });

  it("yonetici soguk acilista kilitli; iptal kilitte birakir, cikis calisir", async () => {
    await ui();
    await waitFor(() => expect(mockAuthenticate).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText("Unlock").length).toBeGreaterThan(0);
    fireEvent.press(screen.getAllByText("Sign out")[0]);
    expect(mockSignOut).toHaveBeenCalled();
  });

  it("dogrulama basarili olunca kilit kalkar", async () => {
    mockAuthenticate.mockResolvedValueOnce("ok");
    await ui();
    await waitFor(() => expect(screen.queryAllByText("Unlock")).toHaveLength(0));
    expect(screen.getByText("icerik")).toBeTruthy();
  });

  it("kilitliyken biyometri/kod kaldirildiysa kilit kalkar (tuzak yok)", async () => {
    mockAuthenticate.mockResolvedValueOnce("unavailable");
    mockCanLock.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await ui();
    await waitFor(() => expect(screen.queryAllByText("Unlock")).toHaveLength(0));
  });

  it("taze giristen hemen sonra kilitlemez", async () => {
    mockAuthState = { state: { status: "signedOut" }, impersonating: null, signOut: mockSignOut };
    const r = await ui();
    mockAuthState = signedIn({ id: "admin1", role: "ADMIN" });
    await r.rerender(
      <AppLockGate>
        <Text>icerik</Text>
      </AppLockGate>,
    );
    await waitFor(() => expect(mockReadPref).toHaveBeenCalled());
    await act(async () => undefined);
    expect(screen.queryAllByText("Unlock")).toHaveLength(0);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it("goruntulemede tercih yoneticinin kimligiyle okunur, yeniden kilitlemez", async () => {
    mockAuthenticate.mockResolvedValueOnce("ok");
    const r = await ui();
    await waitFor(() => expect(screen.queryAllByText("Unlock")).toHaveLength(0));
    mockAuthState = signedIn({ id: "admin1", role: "ADMIN" }, { id: "partner9", role: "PARTNER" });
    await r.rerender(
      <AppLockGate>
        <Text>icerik</Text>
      </AppLockGate>,
    );
    await act(async () => undefined);
    expect(mockReadPref).toHaveBeenCalledTimes(1);
    expect(mockReadPref).toHaveBeenCalledWith("admin1");
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it("kilitliyken modal ekran kapatilir; acilinca geri acilir", async () => {
    mockPath = "/profile";
    mockAuthenticate.mockResolvedValueOnce("ok");
    const r = await ui();
    await waitFor(() => expect(mockDismissAll).toHaveBeenCalled());
    // Modal kapandi: kok rota.
    mockPath = "/";
    await r.rerender(
      <AppLockGate>
        <Text>icerik</Text>
      </AppLockGate>,
    );
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/profile"));
  });

  it("misafir ve kimlik dogrulamasi olmayan cihaz kilitlenmez", async () => {
    mockAuthState = signedIn({ id: "g1", role: "GUEST" });
    await ui();
    expect(screen.getByText("icerik")).toBeTruthy();
    expect(screen.queryAllByText("Unlock")).toHaveLength(0);
    mockAuthState = signedIn({ id: "admin1", role: "ADMIN" });
    mockCanLock.mockResolvedValueOnce(false);
    await ui();
    await waitFor(() => expect(mockCanLock).toHaveBeenCalled());
    await act(async () => undefined);
    expect(screen.queryAllByText("Unlock")).toHaveLength(0);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});
